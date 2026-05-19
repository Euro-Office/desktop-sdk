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

#include "./../internal/base.h"
#include "../../../../../../core/DesktopEditor/common/StringBuilder.h"
#include "../../../../../../core/DesktopEditor/common/Directory.h"
#include "../../../../../../core/DesktopEditor/common/SystemUtils.h"

namespace folder_content_reader
{
	std::string description()
	{
		return "\
{\
  \"type\": \"function\",\
  \"name\": \"folder_content_reader\",\
  \"description\": \"Use this function to list the contents of a folder. Input: folder name or path. Standard folder names include: 'Documents', 'Downloads', 'Desktop'. Output: an object describing the result of the operation.\\n\\nReturn value:\\n{\\n\\\"role\\\": \\\"tool\\\",\\n\\\"status\\\": \\\"success\\\" | \\\"error\\\",\\n\\\"files\\\": [ \\\"array of file names\\\" ],\\n\\\"error_message\\\": \\\"string | null\\\"\\n}\\n\\nExample function call parameter: { \\\"folder\\\": \\\"Documents\\\" }\\n\\nExample successful response:\\n{\\n\\\"role\\\": \\\"tool\\\",\\n\\\"status\\\": \\\"success\\\",\\n\\\"files\\\": [ \\\"file1.txt\\\", \\\"file2.docx\\\" ],\\n\\\"error_message\\\": null\\n}\\n\\nExample error response:\\n{\\n\\\"role\\\": \\\"tool\\\",\\n\\\"status\\\": \\\"error\\\",\\n\\\"files\\\": [],\\n\\\"error_message\\\": \\\"Folder not found.\\\"\\n}\",\
  \"parameters\": {\
    \"type\": \"object\",\
    \"properties\": {\
      \"folder\": {\
        \"type\": \"string\",\
        \"description\": \"Name or path of the folder to be listed. Standard names: 'Documents', 'Downloads', 'Desktop'.\"\
      }\
    },\
    \"required\": [\"folder\"]\
  }\
}";
	}

	std::string main(const std::string& arg, CAIToolsHelper* helper)
	{
		json returnValue = json::object();
		returnValue["role"] = "tool";

		json param = json::parse(arg);
		if (!param.contains("folder") || !param["folder"].is_string())
		{
			returnValue["status"] = "error";
			returnValue["error_message"] = "Folder not presented";
			return returnValue.dump();
		}

		std::string pathA = param["folder"];
		std::wstring path = UTF8_TO_U(pathA);

		NSStringUtils::string_replace(path, L"\\", L"/");

		if (std::wstring::npos == path.find(L"/"))
		{
			NSSystemUtils::SystemDirectoryType dirType = NSSystemUtils::SystemDirectoryType::Undefined;
			if ("Documents" == pathA)
				dirType = NSSystemUtils::SystemDirectoryType::Documents;
			else if ("Downloads" == pathA)
				dirType = NSSystemUtils::SystemDirectoryType::Downloads;
			else if ("Desktop" == pathA)
				dirType = NSSystemUtils::SystemDirectoryType::Desktop;

			if (dirType == NSSystemUtils::SystemDirectoryType::Undefined)
			{
				returnValue["status"] = "error";
				returnValue["error_message"] = "Folder not found";
				return returnValue.dump();
			}

			path = NSSystemUtils::GetSystemDirectory(dirType);
		}

		if (path.empty())
		{
			returnValue["status"] = "error";
			returnValue["error_message"] = "Folder not presented";
			return returnValue.dump();
		}


		returnValue["status"] = "success";

		std::vector<std::wstring> files = NSDirectory::GetFiles(path, true);

		json jFiles = json::array();

		for (std::vector<std::wstring>::iterator i = files.begin(); i != files.end(); i++)
		{
			jFiles.push_back(U_TO_UTF8((*i)));
		}

		returnValue["status"] = "success";
		returnValue["files"] = jFiles;

		return JSON_serialize(returnValue);
	}
}
