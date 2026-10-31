/*
 * SPDX-FileCopyrightText: 2026 Euro-Office contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

#include <gtest/gtest.h>
#include <set>
#include <string>
#include "../src/cefframeid.h"

// Mapping of CEF's string frame identifiers to the integer frame ids that the
// SDK passes through process messages and JS (src/cefframeid.h).

namespace {

const int64_t kMaxSafeJsInteger = (1LL << 53) - 1;

}

// Browser and renderer process compute the id independently, so it must not
// depend on anything but the identifier. The values are FNV-1a, cut to 53 bits.
TEST(CefFrameId, IsFnv1aCutTo53Bits)
{
    EXPECT_EQ(NSCefFrameId::HashIdentifier(""), 5239054864098085);
    EXPECT_EQ(NSCefFrameId::HashIdentifier("a"), 1086646154030220);
    EXPECT_EQ(NSCefFrameId::HashIdentifier("5-6B847260DF8F40EF76F878DF3AAA71DB"), 4691483126816793);
}

TEST(CefFrameId, FitsInAJsNumberAndIsNeverZero)
{
    for (int i = 0; i < 10000; ++i)
    {
        int64_t id = NSCefFrameId::HashIdentifier(std::to_string(i) + "-0123456789ABCDEF0123456789ABCDEF");
        EXPECT_GT(id, 0);
        EXPECT_LE(id, kMaxSafeJsInteger);
    }
}

TEST(CefFrameId, DistinguishesFramesOfABrowser)
{
    // Identifiers as CEF 156 builds them: "<process id>-<frame token>"
    std::set<int64_t> ids;
    for (int process = 1; process <= 20; ++process)
        for (int frame = 0; frame < 50; ++frame)
            ids.insert(NSCefFrameId::HashIdentifier(std::to_string(process) + "-" + std::to_string(frame * 7919) + "F8F40EF76F878DF3AAA71DB"));
    EXPECT_EQ(ids.size(), 20u * 50u);
}
