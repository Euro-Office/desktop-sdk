/*
 * SPDX-FileCopyrightText: 2026 Euro-Office contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

#ifndef CEF_PROFILE_MIGRATION_H
#define CEF_PROFILE_MIGRATION_H

#include <string>

namespace NSCefProfileMigration
{
	// Since CEF 156 the cache path is also the root cache path, and Chromium
	// keeps the profile data (local storage, cookies, IndexedDB, ...) in its
	// "Default" subdirectory. Older versions kept it in the cache path itself,
	// so after an update the start page found no connected clouds and the
	// portals were logged out.
	//
	// Moves the profile data of the old layout into rootCachePath/Default.
	// Does nothing once "Default" exists, so it only runs on the first start
	// after the update. Global data (e.g. "Local State", which holds the
	// cookie encryption key on Windows) stays in rootCachePath, where
	// Chromium still looks for it. Returns the number of entries moved.
	int MigrateLegacyProfile(const std::wstring& rootCachePath);
}

#endif // CEF_PROFILE_MIGRATION_H
