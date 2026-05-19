/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 *
 * This program is a free software product. You can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License (AGPL)
 * version 3 as published by the Free Software Foundation, together with the
 * additional terms provided in the LICENSE file.
 *
 * This program is distributed WITHOUT ANY WARRANTY; without even the implied
 * warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. For
 * details, see the GNU AGPL at: https://www.gnu.org/licenses/agpl-3.0.html
 *
 * You can contact Ascensio System SIA by email at info@onlyoffice.com
 * or by postal mail at 20A-6 Ernesta Birznieka-Upisha Street, Riga,
 * LV-1050, Latvia, European Union.
 *
 * The interactive user interfaces in modified versions of the Program
 * are required to display Appropriate Legal Notices in accordance with
 * Section 5 of the GNU AGPL version 3.
 *
 * No trademark rights are granted under this License.
 *
 * All non-code elements of the Product, including illustrations,
 * icon sets, and technical writing content, are licensed under the
 * Creative Commons Attribution-ShareAlike 4.0 International License:
 * https://creativecommons.org/licenses/by-sa/4.0/legalcode
 *
 * This license applies only to such non-code elements and does not
 * modify or replace the licensing terms applicable to the Program's
 * source code, which remains licensed under the GNU Affero General
 * Public License v3.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

#ifndef FILELOCKER_H
#define FILELOCKER_H

#include <iostream>
#include "../../../../core/DesktopEditor/common/Directory.h"
#include "../../../../core/DesktopEditor/common/Types.h"

namespace NSSystem
{
	enum class LockType
	{
		ltNone     = 0x00,
		ltReadOnly = 0x01,
		ltLocked   = 0x02,
		ltNosafe   = 0x04
	};

	class CLockFileTemp
	{
	private:
		std::string m_user;
		std::string m_host;
		std::string m_date;
		std::string m_user_dir;

		std::wstring m_file;

	public:
		CLockFileTemp(const std::wstring& file);
		~CLockFileTemp();
		CLockFileTemp(const CLockFileTemp& file);
		CLockFileTemp& operator=(const CLockFileTemp& file);

	public:
		void Generate();
		void Save(int type = 0);
		void Load();
		bool IsEqual(const CLockFileTemp& lock);

		std::wstring GetPath();
	};

	class CFileLocker
	{
	public:
		std::wstring m_sFile;
		std::wstring m_sLockFilePath;

		CFileLocker(const std::wstring& file);
		virtual ~CFileLocker();

		static CLockFileTemp CheckLockFilePath(const std::wstring& file, const int& flags = 0);
		virtual void DeleteLockFile();

		virtual bool Lock()   = 0;
		virtual bool Unlock() = 0;

		virtual bool StartWrite();
		virtual bool SeekFile(DWORD dwPosition) = 0;
		virtual bool Truncate(DWORD dwPosition) = 0;
		virtual bool WriteFile(const void* pData, DWORD dwBytesToWrite, DWORD& dwSizeWrite) = 0;

		virtual bool IsEmpty();

		static LockType IsLocked(const std::wstring& file);
		static CFileLocker* Create(const std::wstring& file);

		static bool IsHandled(const std::wstring& file);

		static bool RemoveRestrictionFlags(const std::wstring& file);
	};
}

#endif // FILELOCKER_H
