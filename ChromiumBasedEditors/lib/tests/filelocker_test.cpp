/*
 * SPDX-FileCopyrightText: 2026 Euro-Office contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

#include <gtest/gtest.h>
#include <algorithm>
#include <memory>
#include <string>
#include <sys/stat.h>
#include <unistd.h>
#include "../src/filelocker.h"
#include "../../../../core/DesktopEditor/common/File.h"
#include "../../../../core/DesktopEditor/common/Directory.h"

// File locking for local documents on Linux (src/filelocker.cpp): an fcntl
// write lock plus a LibreOffice-compatible ".~lock.<name>#" file, which is
// what other users and other office suites see.

namespace {

class FileLockerTest : public ::testing::Test
{
protected:
    void SetUp() override
    {
        m_dir = NSFile::CFileBinary::CreateTempFileWithUniqueName(
            NSFile::CFileBinary::GetTempPath(), L"sdk_filelocker_test");
        ASSERT_FALSE(m_dir.empty());
        NSFile::CFileBinary::Remove(m_dir);
        ASSERT_TRUE(NSDirectory::CreateDirectory(m_dir));

        m_file = m_dir + L"/report.docx";
        ASSERT_TRUE(NSFile::CFileBinary::SaveToFile(m_file, L"content"));
    }

    void TearDown() override
    {
        NSDirectory::DeleteDirectory(m_dir);
    }

    std::wstring lockFile() const
    {
        return m_dir + L"/.~lock.report.docx#";
    }

    std::wstring m_dir;
    std::wstring m_file;
};

} // namespace

TEST_F(FileLockerTest, LockWritesALockFileAndUnlockRemovesIt)
{
    std::unique_ptr<NSSystem::CFileLocker> locker(NSSystem::CFileLocker::Create(m_file));
    ASSERT_NE(locker, nullptr);

    ASSERT_TRUE(locker->Lock());
    EXPECT_TRUE(NSFile::CFileBinary::Exists(lockFile()));
    EXPECT_EQ(locker->m_sLockFilePath, lockFile());
    EXPECT_TRUE(NSSystem::CFileLocker::IsHandled(m_file));

    ASSERT_TRUE(locker->Unlock());
    EXPECT_FALSE(NSFile::CFileBinary::Exists(lockFile()));
    EXPECT_FALSE(NSSystem::CFileLocker::IsHandled(m_file));
}

TEST_F(FileLockerTest, LockFileUsesTheLibreOfficeFormat)
{
    std::unique_ptr<NSSystem::CFileLocker> locker(NSSystem::CFileLocker::Create(m_file));
    ASSERT_TRUE(locker->Lock());

    // ",user,host,dd.mm.yyyy hh:mm,user dir;"
    std::string content;
    ASSERT_TRUE(NSFile::CFileBinary::ReadAllTextUtf8A(lockFile(), content));
    ASSERT_FALSE(content.empty());
    EXPECT_EQ(content.front(), ',');
    EXPECT_EQ(content.back(), ';');
    EXPECT_EQ(std::count(content.begin(), content.end(), ','), 4);
}

TEST_F(FileLockerTest, OwnLockFileDoesNotCountAsLocked)
{
    std::unique_ptr<NSSystem::CFileLocker> locker(NSSystem::CFileLocker::Create(m_file));
    ASSERT_TRUE(locker->Lock());

    EXPECT_EQ(NSSystem::CFileLocker::IsLocked(m_file), NSSystem::LockType::ltNone);
}

TEST_F(FileLockerTest, UnlockedFileIsNotLocked)
{
    EXPECT_EQ(NSSystem::CFileLocker::IsLocked(m_file), NSSystem::LockType::ltNone);
}

TEST_F(FileLockerTest, LockFileOfAnotherUserLocksTheFile)
{
    ASSERT_TRUE(NSFile::CFileBinary::SaveToFile(lockFile(),
        L",someone-else,other-host,01.01.2026 10:00,/home/someone-else/.config;"));

    EXPECT_EQ(NSSystem::CFileLocker::IsLocked(m_file), NSSystem::LockType::ltLocked);

    std::unique_ptr<NSSystem::CFileLocker> locker(NSSystem::CFileLocker::Create(m_file));
    EXPECT_FALSE(locker->Lock());
    // the other user's lock file stays
    EXPECT_TRUE(NSFile::CFileBinary::Exists(lockFile()));
}

TEST_F(FileLockerTest, ReadOnlyFileIsReportedAsReadOnly)
{
    if (geteuid() == 0)
        GTEST_SKIP() << "root can write to read-only files";

    const std::string fileA = U_TO_UTF8(m_file);
    ASSERT_EQ(chmod(fileA.c_str(), S_IRUSR), 0);

    EXPECT_EQ(NSSystem::CFileLocker::IsLocked(m_file), NSSystem::LockType::ltReadOnly);

    EXPECT_TRUE(NSSystem::CFileLocker::RemoveRestrictionFlags(m_file));
    EXPECT_EQ(access(fileA.c_str(), W_OK), 0);
}
