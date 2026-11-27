/*
 * SPDX-FileCopyrightText: 2026 Euro-Office contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

#include <gtest/gtest.h>
#include <algorithm>
#include <cstdio>
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

// Writes the whole file the way CLocalFileLocker::SaveFile does
static bool saveThroughLocker(NSSystem::CFileLocker& locker, const std::string& content)
{
    if (!locker.StartWrite() || !locker.SeekFile(0))
        return false;

    DWORD written = 0;
    if (!locker.WriteFile(content.data(), (DWORD)content.size(), written) || written != content.size())
        return false;

    locker.SeekFile((DWORD)content.size());
    return locker.Truncate((DWORD)content.size());
}

TEST_F(FileLockerTest, SaveWritesTheWholeFile)
{
    std::unique_ptr<NSSystem::CFileLocker> locker(NSSystem::CFileLocker::Create(m_file));
    ASSERT_TRUE(locker->Lock());

    // shorter than the content: the old tail must go
    ASSERT_TRUE(saveThroughLocker(*locker, "new"));

    std::string content;
    ASSERT_TRUE(NSFile::CFileBinary::ReadAllTextUtf8A(m_file, content));
    EXPECT_EQ(content, "new");
}

// Sync clients (Nextcloud, OneDrive, ...) update a file by putting a new one
// in its place. Saving afterwards must write the file now at the path, not
// the replaced one the locker opened.
TEST_F(FileLockerTest, SaveWritesAFileReplacedSinceLocking)
{
    std::unique_ptr<NSSystem::CFileLocker> locker(NSSystem::CFileLocker::Create(m_file));
    ASSERT_TRUE(locker->Lock());

    const std::wstring replacement = m_dir + L"/.report.docx.sync";
    ASSERT_TRUE(NSFile::CFileBinary::SaveToFile(replacement, L"synced content"));
    ASSERT_EQ(rename(U_TO_UTF8(replacement).c_str(), U_TO_UTF8(m_file).c_str()), 0);

    ASSERT_TRUE(saveThroughLocker(*locker, "saved"));

    std::string content;
    ASSERT_TRUE(NSFile::CFileBinary::ReadAllTextUtf8A(m_file, content));
    EXPECT_EQ(content, "saved");
    EXPECT_TRUE(NSSystem::CFileLocker::IsHandled(m_file));

    ASSERT_TRUE(locker->Unlock());
    EXPECT_FALSE(NSFile::CFileBinary::Exists(lockFile()));
}
