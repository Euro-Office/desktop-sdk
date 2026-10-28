/*
 * SPDX-FileCopyrightText: 2026 Euro-Office contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

#include <gtest/gtest.h>
#include "../../../../core/DesktopEditor/common/File.h"

// Checks the test setup itself rather than SDK code: GoogleTest runs, and the
// core libraries the SDK builds on (kernel here) link and load at run time
// from EO_CORE_OUTPUT_DIR. If this suite fails, every other desktop-sdk suite
// would fail for the same reason.

TEST(TestSetup, CoreKernelRoundTripsAFile)
{
    std::wstring path = NSFile::CFileBinary::CreateTempFileWithUniqueName(
        NSFile::CFileBinary::GetTempPath(), L"sdk_setup_test");
    ASSERT_FALSE(path.empty());

    ASSERT_TRUE(NSFile::CFileBinary::SaveToFile(path, L"ok"));

    std::wstring content;
    EXPECT_TRUE(NSFile::CFileBinary::ReadAllTextUtf8(path, content));
    EXPECT_EQ(content, L"ok");

    EXPECT_TRUE(NSFile::CFileBinary::Remove(path));
    EXPECT_FALSE(NSFile::CFileBinary::Exists(path));
}
