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

namespace generate_pptx
{
	std::string description()
	{
		return "\
{\
  \"type\": \"function\",\
  \"name\": \"generate_pptx\",\
  \"description\": \"Use this function if you are asked to generate a complete presentation with a custom theme, fonts, and streaming content. Input: a detailed description of the presentation to create, including topic, number of slides, and style.\",\
  \"parameters\": {\
    \"type\": \"object\",\
    \"properties\": {\
      \"topic\": {\
        \"type\": \"string\",\
        \"description\": \"Presentation topic.\"\
      },\
      \"slideCount\": {\
        \"type\": \"string\",\
        \"description\": \"Number of slides to generate.\"\
      },\
      \"style\": {\
        \"type\": \"string\",\
        \"description\": \"Visual style of the presentation: modern, classic, minimal, or corporate.\"\
      }\
    },\
    \"required\": []\
  }\
}";
	}

	std::string main(const std::string& arg, CAIToolsHelper* helper)
	{
		json returnValue = json::object();

		json param = json::parse(arg);
		if (!param.is_object())
		{
			returnValue["status"] = "error";
		}
		else
		{
			std::string value = json(param).dump();
			std::string code = "window.AscDesktopEditor.generateNew(\"pptx\", \"ai-gen-pptx\", " + json(value).dump() + ");";
			helper->ExecuteJS(code);

			returnValue["status"] = "success";
		}

		return returnValue.dump();
	}
}
