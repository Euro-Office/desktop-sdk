/*
 * SPDX-FileCopyrightText: 2026 Euro-Office contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

#ifndef CEF_FRAME_ID_H
#define CEF_FRAME_ID_H

#include <cstdint>
#include <string>

// FNV-1a hash of a CEF frame identifier, cut to 53 bits so it survives a JS
// number, and never 0 ("no frame"). Used by NSCefFrameId in
// applicationmanager_p.h; kept free of CEF headers so it can be tested alone.
namespace NSCefFrameId
{
	inline int64_t HashIdentifier(const std::string& identifier)
	{
		uint64_t hash = 14695981039346656037ULL;
		for (unsigned char c : identifier)
		{
			hash ^= c;
			hash *= 1099511628211ULL;
		}
		int64_t id = (int64_t)(hash & ((1ULL << 53) - 1));
		return (0 == id) ? 1 : id;
	}
}

#endif // CEF_FRAME_ID_H
