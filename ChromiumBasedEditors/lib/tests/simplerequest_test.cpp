/*
 * SPDX-FileCopyrightText: 2026 Euro-Office contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

#include <gtest/gtest.h>
#include "../src/simplerequest.h"
#include "../src/portalauthorization.h"

// How AscSimpleRequest.createRequest options become a request (src/simplerequest.cpp,
// NSRequest::CSimpleRequestClient). The start page browses clouds with it (WebDAV,
// uploads, the cloud's Authorization header); other pages keep what they had.

namespace {

const std::string PORTAL = "https://cloud.example.com";
const std::string AUTH = "Basic SECRET";

class SimpleRequestAuthTest : public ::testing::Test
{
protected:
    void SetUp() override { m_auth.Set(PORTAL, AUTH); }

    std::string auth(const std::string& method, bool startPage, const std::string& header = "",
                     const std::string& url = PORTAL + "/remote.php/dav/files/alice/")
    {
        return CSimpleRequestOptions(method, "", startPage).Authorization(url, header, m_auth);
    }

    CPortalAuthorization m_auth;
};

} // namespace

TEST(SimpleRequestOptions, SplitsTheMethodFromItsParams)
{
    CSimpleRequestOptions plain("GET", "", false);
    EXPECT_EQ(plain.Method, "GET");
    EXPECT_FALSE(plain.Progress);
    EXPECT_FALSE(plain.IsFile);

    // "POST:stream" used to be sent as the method itself
    CSimpleRequestOptions stream("POST:stream", "", false);
    EXPECT_EQ(stream.Method, "POST");
    EXPECT_TRUE(stream.Progress);

    CSimpleRequestOptions several("PUT:stream,file,auth", "/tmp/a.docx", true);
    EXPECT_EQ(several.Method, "PUT");
    EXPECT_TRUE(several.Progress);
    EXPECT_TRUE(several.IsFile);
    EXPECT_FALSE(several.Refused);
}

TEST(SimpleRequestOptions, IgnoresParamsThatOnlyContainAName)
{
    CSimpleRequestOptions options("PUT:upstream,profile,author", "", true);
    EXPECT_FALSE(options.Progress);
    EXPECT_FALSE(options.IsFile);
    CPortalAuthorization auth;
    auth.Set(PORTAL, AUTH);
    EXPECT_EQ(options.Authorization(PORTAL + "/", "", auth), "");
}

TEST(SimpleRequestOptions, SendsBodiesWithWebDavMethods)
{
    EXPECT_TRUE(CSimpleRequestOptions("PROPFIND", "<d:propfind/>", false).HasBody);
    EXPECT_TRUE(CSimpleRequestOptions("SEARCH", "<d:searchrequest/>", false).HasBody);
    EXPECT_TRUE(CSimpleRequestOptions("PUT", "text", false).HasBody);
    // POST always had a body, also an empty one
    EXPECT_TRUE(CSimpleRequestOptions("POST", "", false).HasBody);

    EXPECT_FALSE(CSimpleRequestOptions("GET", "ignored", false).HasBody);
    EXPECT_FALSE(CSimpleRequestOptions("HEAD", "ignored", false).HasBody);
    EXPECT_FALSE(CSimpleRequestOptions("DELETE", "", false).HasBody);
}

TEST(SimpleRequestOptions, UploadsLocalFilesOnlyForTheStartPage)
{
    CSimpleRequestOptions startPage("PUT:file", "/home/alice/Report.docx", true);
    EXPECT_TRUE(startPage.IsFile);
    EXPECT_TRUE(startPage.HasBody);
    EXPECT_FALSE(startPage.Refused);

    // a cloud page must not read local files
    CSimpleRequestOptions cloudPage("PUT:file", "/etc/passwd", false);
    EXPECT_TRUE(cloudPage.Refused);
    EXPECT_FALSE(cloudPage.HasBody);
}

TEST_F(SimpleRequestAuthTest, AddsTheCloudsHeaderWhenTheStartPageAsks)
{
    EXPECT_EQ(auth("PROPFIND:auth", true), AUTH);
    EXPECT_EQ(auth("GET:stream,auth", true), AUTH);
}

TEST_F(SimpleRequestAuthTest, LeavesRequestsWithoutTheParamAlone)
{
    // e.g. Nextcloud's Login Flow, which a stale header would break
    EXPECT_EQ(auth("POST", true, "", PORTAL + "/index.php/login/v2"), "");
}

TEST_F(SimpleRequestAuthTest, RefusesOtherPages)
{
    CSimpleRequestOptions options("GET:auth", "", false);
    EXPECT_TRUE(options.Refused);
    EXPECT_EQ(options.Authorization(PORTAL + "/", "", m_auth), "");
}

TEST_F(SimpleRequestAuthTest, KeepsTheHeaderThePageSet)
{
    // e.g. the revocation of an app password, which sends that password
    EXPECT_EQ(auth("DELETE:auth", true, "Basic OTHER"), "");
}

TEST_F(SimpleRequestAuthTest, OnlyForTheCloudTheHeaderBelongsTo)
{
    EXPECT_EQ(auth("GET:auth", true, "", "https://other.example.com/"), "");
    EXPECT_EQ(auth("GET:auth", true, "", "https://cloud.example.com.evil.example/"), "");
}

TEST(SimpleRequestJs, EscapesForAStringLiteral)
{
    EXPECT_EQ(NSSimpleRequest::EscapeJs("a\"b\\c"), "a\\\"b\\\\c");
    // newlines stay newlines instead of disappearing as line continuations
    EXPECT_EQ(NSSimpleRequest::EscapeJs("<a>\r\n<b>"), "<a>\\r\\n<b>");
    EXPECT_EQ(NSSimpleRequest::EscapeJs("x\xE2\x80\xA8y\xE2\x80\xA9z"), "x\\u2028y\\u2029z");
    EXPECT_EQ(NSSimpleRequest::EscapeJs("Grüße"), "Grüße");
}

TEST(SimpleRequestJs, ListsResponseHeadersWithoutCookies)
{
    EXPECT_EQ(NSSimpleRequest::HeadersToJs({{"OC-FileId", "00000099oc1"}, {"Set-Cookie", "session=1"},
                                            {"ETag", "\"abc\""}}),
              "{\"oc-fileid\": \"00000099oc1\", \"etag\": \"\\\"abc\\\"\"}");
    EXPECT_EQ(NSSimpleRequest::HeadersToJs({}), "{}");
}
