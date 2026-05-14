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

namespace form_field_analyser
{
	std::string description()
	{
		return "\
{\
  \"type\": \"function\",\
  \"name\": \"form_field_analyser\",\
  \"description\": \"Use this function if you are asked to analyze a document or a form. Input: a file path or a URL to the document that needs to be analyzed. Output: an object describing the extracted fields from the document.\\n\\nReturn value:\\nAn object describing the result of the operation.\\n{\\n\\\"role\\\": \\\"tool\\\", // Required constant field\\n\\\"status\\\": \\\"success\\\" | \\\"error\\\",\\n\\\"fields\\\": \\\"array\\\", // Array of field names\\n\\\"error_message\\\": \\\"string | null\\\" // Error details if status = 'error'\\n}\\n\\nExample function call parameter: { \\\"document\\\": \\\"/home/user/document.docx\\\" }\\n\\nExample successful response:\\n{\\n\\\"role\\\": \\\"tool\\\",\\n\\\"status\\\": \\\"success\\\",\\n\\\"fields\\\": [ \\\"name\\\", \\\"date\\\"  ],\\n\\\"error_message\\\": null\\n}\\n\\nExample error response:\\n{\\n\\\"role\\\": \\\"tool\\\",\\n\\\"status\\\": \\\"error\\\",\\n\\\"fields\\\": [],\\n\\\"error_message\\\": \\\"The document could not be parsed.\\\"\\n}\",\
  \"parameters\": {\
    \"type\": \"object\",\
    \"properties\": {\
      \"document\": {\
        \"type\": \"string\",\
        \"description\": \"Path to the file or URL of the document to be analyzed.\"\
      }\
    },\
    \"required\": [\"document\"]\
  }\
}";
	}

	std::string main(const std::string& arg, CAIToolsHelper* helper)
	{
		json returnValue = json::object();
		returnValue["role"] = "tool";

		json param = json::parse(arg);
		if (!param.contains("document") || !param["document"].is_string())
		{
			returnValue["status"] = "error";
			returnValue["error_message"] = "Required field ('document') not present";
			returnValue["fields"] = json::array();
			return returnValue.dump();
		}

		std::string pathA = param["document"];
		std::wstring path = UTF8_TO_U(pathA);

		CDocBuilder builder;
		initBuilder(&builder);
		int res = builder.OpenFile(path.c_str(), L"");
		if (0 != res)
		{
			returnValue["status"] = "error";
			returnValue["error_message"] = "Could not open document";
			returnValue["fields"] = json::array();
			return returnValue.dump();
		}

		CContext context = builder.GetContext();
		CValue global = context.GetGlobal();

		CValue api = global["Api"];
		CValue document = api.Call("GetDocument");

		json keys = json::array();

		CValue allForms = document.Call("GetAllForms");
		int count = allForms.GetLength();
		for (int i = 0; i < count; i++)
		{
			CValue field = allForms.Get(i);

			std::wstring keyW(field.Call("GetFormKey").ToString().c_str());
			std::string key = U_TO_UTF8(keyW);

			keys.push_back(key);
		}

		builder.CloseFile();

		returnValue["status"] = "success";
		returnValue["fields"] = keys;

		returnValue["toolSystemType"] = "prompt";
		returnValue["toolSystemResult"] = "Match the document fields by meaning with the values in the array in javascript format. \
			And when you are asked to fill out a form, send not invented field values to the function, but only those that are in the passed list: " + keys.dump();

		return JSON_serialize(returnValue);
	}
}
