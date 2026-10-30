/*
 * SPDX-FileCopyrightText: 2026 Euro-Office contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

#include <gtest/gtest.h>
#include "../src/portalauthorization.h"

// Which requests get a cloud's Authorization header (src/portalauthorization.cpp,
// CAscApplicationManager::SetPortalAuthorization). The initiator is the origin of the
// page that started a request, as CEF passes it; frames a page creates (about:blank,
// about:srcdoc) have that page's origin, data: frames the opaque origin "null".

namespace {

const std::string PORTAL = "https://Cloud.example.com/nc";
const std::string ORIGIN = "https://cloud.example.com";
const std::string AUTH = "Basic SECRET";

class PortalAuthorizationTest : public ::testing::Test
{
protected:
    void SetUp() override { m_auth.Set(PORTAL, AUTH); }

    std::string get(const std::string& url, const std::string& initiator = "") const
    {
        return m_auth.Get(url, initiator);
    }

    CPortalAuthorization m_auth;
};

} // namespace

TEST(PortalAuthorizationPrefix, LowercasesSchemeAndHostAndEndsWithSlash)
{
    EXPECT_EQ(CPortalAuthorization::NormalizePrefix("HTTPS://Cloud.Example.com/NC"), "https://cloud.example.com/NC/");
    EXPECT_EQ(CPortalAuthorization::NormalizePrefix("https://cloud.example.com"), "https://cloud.example.com/");
    EXPECT_EQ(CPortalAuthorization::NormalizePrefix("https://cloud.example.com/nc/"), "https://cloud.example.com/nc/");
}

TEST(PortalAuthorizationPrefix, RejectsWhatIsNoUrl)
{
    EXPECT_EQ(CPortalAuthorization::NormalizePrefix(""), "");
    EXPECT_EQ(CPortalAuthorization::NormalizePrefix("about:blank"), "");
    EXPECT_EQ(CPortalAuthorization::NormalizePrefix("https://"), "");
    EXPECT_EQ(CPortalAuthorization::NormalizePrefix("://cloud.example.com"), "");
}

TEST_F(PortalAuthorizationTest, AppNavigationsToThePortalGetTheHeader)
{
    EXPECT_EQ(get("https://cloud.example.com/nc"), AUTH);
    EXPECT_EQ(get("https://cloud.example.com/nc/index.php/apps/files"), AUTH);
    EXPECT_EQ(get("https://CLOUD.example.com/nc/remote.php/dav/files/me/a.docx"), AUTH);
    EXPECT_EQ(get("https://cloud.example.com/nc?x=1"), AUTH);
    EXPECT_EQ(get("https://cloud.example.com/nc#top"), AUTH);
}

TEST_F(PortalAuthorizationTest, OtherAddressesDontGetIt)
{
    EXPECT_EQ(get("https://cloud.example.com.evil.org/nc/"), "");
    EXPECT_EQ(get("https://evil.org/https://cloud.example.com/nc/"), "");
    EXPECT_EQ(get("http://cloud.example.com/nc/"), "");
    EXPECT_EQ(get("https://cloud.example.com:8443/nc/"), "");
    EXPECT_EQ(get("https://cloud.example.com/ncevil/"), "");
    EXPECT_EQ(get("https://cloud.example.com/"), "");
    EXPECT_EQ(get("about:blank"), "");
}

TEST_F(PortalAuthorizationTest, ThePortalsOwnPagesGetIt)
{
    EXPECT_EQ(get("https://cloud.example.com/nc/remote.php/dav/", ORIGIN), AUTH);
    EXPECT_EQ(get("https://cloud.example.com/nc/remote.php/dav/", "HTTPS://Cloud.Example.com"), AUTH);
}

TEST_F(PortalAuthorizationTest, OtherPagesAndTheFramesTheyCreateDont)
{
    // also about:blank and about:srcdoc frames of evil.org, which have its origin
    EXPECT_EQ(get("https://cloud.example.com/nc/remote.php/dav/", "https://evil.example.org"), "");
    // another cloud the user added
    EXPECT_EQ(get("https://cloud.example.com/nc/remote.php/dav/", "https://other-cloud.example.com"), "");
    // data: frames and sandboxed pages
    EXPECT_EQ(get("https://cloud.example.com/nc/remote.php/dav/", "null"), "");
    EXPECT_EQ(get("https://cloud.example.com/nc/remote.php/dav/", "https://cloud.example.com:8443"), "");
}

TEST_F(PortalAuthorizationTest, AnEmptyHeaderRemovesThePortal)
{
    m_auth.Set("https://cloud.example.com/nc/", "");

    EXPECT_EQ(get("https://cloud.example.com/nc/"), "");
    EXPECT_TRUE(m_auth.IsEmpty());
}

TEST_F(PortalAuthorizationTest, EachPortalGetsItsOwnHeader)
{
    m_auth.Set("https://cloud.example.com/other", "Basic OTHER");

    EXPECT_EQ(get("https://cloud.example.com/nc/a"), AUTH);
    EXPECT_EQ(get("https://cloud.example.com/other/a"), "Basic OTHER");
}

TEST_F(PortalAuthorizationTest, ThePortalsHeaderIsMisplacedElsewhere)
{
    // e.g. after a redirect from the portal to an object store
    EXPECT_TRUE(m_auth.IsMisplaced("https://s3.example.net/bucket/a.docx", AUTH));
    EXPECT_FALSE(m_auth.IsMisplaced("https://cloud.example.com/nc/a.docx", AUTH));
}

TEST_F(PortalAuthorizationTest, OtherHeadersAreNeverMisplaced)
{
    EXPECT_FALSE(m_auth.IsMisplaced("https://s3.example.net/bucket/a.docx", "Bearer PAGE-OWN-TOKEN"));
}

TEST(PortalAuthorizationEmpty, NothingSetMeansNoHeader)
{
    CPortalAuthorization auth;

    EXPECT_TRUE(auth.IsEmpty());
    EXPECT_EQ(auth.Get("https://cloud.example.com/nc/", ""), "");
    EXPECT_FALSE(auth.IsMisplaced("https://cloud.example.com/nc/", "Basic SECRET"));
}
