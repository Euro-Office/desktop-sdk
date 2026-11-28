/*
 * SPDX-FileCopyrightText: 2026 Euro-Office contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

#include "cefprofilemigration.h"

#include <filesystem>
#include <system_error>

namespace fs = std::filesystem;

namespace
{
	// Profile data the old layout kept in the cache path that is worth
	// keeping. Caches (Cache, Code Cache, GPUCache, ...) are left behind,
	// Chromium rebuilds them.
	const wchar_t* const kProfileEntries[] = {
		L"Local Storage",
		L"Session Storage",
		L"IndexedDB",
		L"databases",
		L"WebStorage",
		L"Service Worker",
		L"File System",
		L"Cookies",
		L"Cookies-journal",
		L"Network Persistent State",
		L"TransportSecurity",
	};
}

namespace NSCefProfileMigration
{
	int MigrateLegacyProfile(const std::wstring& rootCachePath)
	{
		if (rootCachePath.empty())
			return 0;

		std::error_code ec;
		const fs::path root(rootCachePath);
		const fs::path profile = root / L"Default";

		if (fs::exists(profile, ec) || ec)
			return 0;
		// Nothing of the old layout: a fresh install, let Chromium create it.
		if (!fs::exists(root / L"Local Storage", ec) && !fs::exists(root / L"Cookies", ec))
			return 0;

		if (!fs::create_directories(profile, ec) || ec)
			return 0;

		int moved = 0;
		for (const wchar_t* name : kProfileEntries)
		{
			const fs::path from = root / name;
			if (!fs::exists(from, ec))
				continue;
			// Same directory, so a rename: cheap, and atomic per entry.
			fs::rename(from, profile / name, ec);
			if (!ec)
				++moved;
		}
		return moved;
	}
}
