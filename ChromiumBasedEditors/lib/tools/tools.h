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
#pragma once
#include <string>
#include <string.h>
#include <map>
#include <vector>
#include <functional>

class CRecentFileInfo
{
public:
	std::wstring Path;
	int Type;
	std::wstring Url;

public:
	CRecentFileInfo() : Path(L""), Type(0)
	{
	}
	CRecentFileInfo(const std::wstring& path, const int& type, const std::wstring& url) : Path(path), Type(type), Url(url)
	{
	}
	CRecentFileInfo& operator=(const CRecentFileInfo& s)
	{
		Path = s.Path;
		Type = s.Type;
		Url = s.Url;
		return *this;
	}
};

class CAIToolsHelper
{
public:
	virtual void OpenTemplate(const std::wstring& path, const std::wstring& name = L"") = 0;
	virtual void OpenFile(const std::wstring& path) = 0;
	virtual std::vector<CRecentFileInfo> GetRecents() = 0;

	virtual void ExecuteJS(const std::string& code) = 0;
};

class CFunctions;
class CAITools
{
private:
	CAITools();
	~CAITools();

	std::wstring m_workDirectory;
	std::wstring m_fontsDirectory;

	CFunctions* m_funcs;

public:
	static CAITools& getInstance();

	void setWorkDirectory(const std::wstring& dir);
	std::wstring getWorkDirectory();

	void setFontsDirectory(const std::wstring& dir);
	std::wstring getFontsDirectory();

	std::wstring getTempFile();

	std::string callFunc(const std::string& name, const std::string& arg, CAIToolsHelper* helper);
	std::string getFunctions();
};
