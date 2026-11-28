/*
 * SPDX-FileCopyrightText: 2026 Euro-Office contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

#include <gtest/gtest.h>
#include <filesystem>
#include <fstream>
#include <string>
#include "../src/cefprofilemigration.h"

// Moving the profile data of the pre-CEF-156 cache layout into "Default"
// (src/cefprofilemigration.cpp).

namespace fs = std::filesystem;

namespace {

class CefProfileMigrationTest : public ::testing::Test
{
protected:
	fs::path root;

	void SetUp() override
	{
		const auto* info = ::testing::UnitTest::GetInstance()->current_test_info();
		root = fs::temp_directory_path() / (std::string("eo-cefprofile-") + info->name());
		fs::remove_all(root);
		fs::create_directories(root);
	}

	void TearDown() override
	{
		fs::remove_all(root);
	}

	void touch(const fs::path& p, const std::string& content = "x")
	{
		fs::create_directories(p.parent_path());
		std::ofstream(p) << content;
	}

	std::string read(const fs::path& p)
	{
		std::ifstream in(p);
		return std::string(std::istreambuf_iterator<char>(in), {});
	}

	int migrate()
	{
		return NSCefProfileMigration::MigrateLegacyProfile(root.wstring());
	}
};

TEST_F(CefProfileMigrationTest, MovesProfileDataIntoDefault)
{
	touch(root / "Local Storage" / "leveldb" / "000004.log", "portals");
	touch(root / "IndexedDB" / "x.indexeddb.leveldb" / "CURRENT");
	touch(root / "Cookies", "cookies");
	touch(root / "Cookies-journal");

	EXPECT_EQ(migrate(), 4);

	EXPECT_EQ(read(root / "Default" / "Local Storage" / "leveldb" / "000004.log"), "portals");
	EXPECT_TRUE(fs::exists(root / "Default" / "IndexedDB" / "x.indexeddb.leveldb" / "CURRENT"));
	EXPECT_EQ(read(root / "Default" / "Cookies"), "cookies");
	EXPECT_TRUE(fs::exists(root / "Default" / "Cookies-journal"));
	EXPECT_FALSE(fs::exists(root / "Local Storage"));
	EXPECT_FALSE(fs::exists(root / "Cookies"));
}

TEST_F(CefProfileMigrationTest, LeavesGlobalDataAndCachesInRoot)
{
	touch(root / "Local Storage" / "leveldb" / "CURRENT");
	touch(root / "Local State", "{\"os_crypt\":{}}");
	touch(root / "Cache" / "data_0");
	touch(root / "GPUCache" / "index");

	EXPECT_EQ(migrate(), 1);

	EXPECT_TRUE(fs::exists(root / "Local State"));
	EXPECT_TRUE(fs::exists(root / "Cache" / "data_0"));
	EXPECT_TRUE(fs::exists(root / "GPUCache" / "index"));
	EXPECT_FALSE(fs::exists(root / "Default" / "Local State"));
	EXPECT_FALSE(fs::exists(root / "Default" / "Cache"));
}

TEST_F(CefProfileMigrationTest, DoesNothingOnceDefaultExists)
{
	touch(root / "Default" / "Local Storage" / "leveldb" / "CURRENT", "new");
	touch(root / "Local Storage" / "leveldb" / "CURRENT", "old");

	EXPECT_EQ(migrate(), 0);

	EXPECT_EQ(read(root / "Default" / "Local Storage" / "leveldb" / "CURRENT"), "new");
	EXPECT_EQ(read(root / "Local Storage" / "leveldb" / "CURRENT"), "old");
}

TEST_F(CefProfileMigrationTest, FreshInstallCreatesNothing)
{
	EXPECT_EQ(migrate(), 0);
	EXPECT_FALSE(fs::exists(root / "Default"));
}

TEST_F(CefProfileMigrationTest, MissingRootIsHarmless)
{
	fs::remove_all(root);
	EXPECT_EQ(migrate(), 0);
	EXPECT_FALSE(fs::exists(root));
}

TEST_F(CefProfileMigrationTest, EmptyPathIsHarmless)
{
	EXPECT_EQ(NSCefProfileMigration::MigrateLegacyProfile(L""), 0);
}

} // namespace
