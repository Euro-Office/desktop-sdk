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

#include "../../../src/x2t.h"
#include "../../../../../../core/DesktopEditor/common/Directory.h"
#include "../../../../../../core/Common/OfficeFileFormatChecker.h"
//#include "../../../../../../core/DesktopEditor/graphics/BaseThread.h"

namespace file_content_reader
{
	std::string description()
	{
		return "\
{\
  \"type\": \"function\",\
  \"name\": \"file_content_reader\",\
  \"description\": \"Use this function if you are asked to return the content of a file in a specific format (txt, html). Input: file path and optional desired format (default is 'txt'). Output: an object describing the result of the operation.\\n\\nReturn value:\\n{\\n\\\"role\\\": \\\"tool\\\",\\n\\\"status\\\": \\\"success\\\" | \\\"error\\\",\\n\\\"content\\\": \\\"string\\\", // Converted file content\\n\\\"error_message\\\": \\\"string | null\\\" // Error details if status = 'error'\\n}\\n\\nExample function call parameter: { \\\"path\\\": \\\"/home/user/document.docx\\\" }\\nExample function call parameter with format: { \\\"path\\\": \\\"/home/user/document.docx\\\", \\\"format\\\": \\\"html\\\" }\\n\\nExample successful response:\\n{\\n\\\"role\\\": \\\"tool\\\",\\n\\\"status\\\": \\\"success\\\",\\n\\\"content\\\": \\\"File content in txt format...\\\",\\n\\\"error_message\\\": null\\n}\\n\\nExample error response:\\n{\\n\\\"role\\\": \\\"tool\\\",\\n\\\"status\\\": \\\"error\\\",\\n\\\"content\\\": \\\"\\\",\\n\\\"error_message\\\": \\\"Unsupported format requested.\\\"\\n}\",\
  \"parameters\": {\
    \"type\": \"object\",\
    \"properties\": {\
      \"path\": {\
        \"type\": \"string\",\
        \"description\": \"Path to the file to be converted.\"\
      },\
      \"format\": {\
        \"type\": \"string\",\
        \"enum\": [\"txt\", \"html\"],\
        \"description\": \"Desired output format. Default is 'txt'.\",\
        \"default\": \"txt\"\
      }\
    },\
    \"required\": [\"path\"]\
  }\
}";
	}

	class CConverter
	{
	public:
		std::wstring m_sInputFile;
		std::wstring m_sOutputFile;

		std::wstring m_sTempDirectory;
		int m_nOutputFormat;

		CAIToolsHelper* m_pHelper;

	public:
		CConverter()
		{
			m_sTempDirectory = NSFile::CFileBinary::CreateTempFileWithUniqueName(NSDirectory::GetTempPath(), L"CV");
			if (NSFile::CFileBinary::Exists(m_sTempDirectory))
				NSFile::CFileBinary::Remove(m_sTempDirectory);

			NSDirectory::CreateDirectory(m_sTempDirectory);

			m_sOutputFile = m_sTempDirectory + L"/output";
		}

		~CConverter()
		{
			NSDirectory::DeleteDirectory(m_sTempDirectory);
		}

		int Convert()
		{
			CAITools& tools = CAITools::getInstance();

			NSStringUtils::CStringBuilder oBuilder;
			oBuilder.WriteString(L"<?xml version=\"1.0\" encoding=\"utf-8\"?><TaskQueueDataConvert><m_sFileFrom>");
			oBuilder.WriteEncodeXmlString(m_sInputFile);
			oBuilder.WriteString(L"</m_sFileFrom><m_sFileTo>");
			oBuilder.WriteEncodeXmlString(m_sOutputFile);
			oBuilder.WriteString(L"</m_sFileTo><m_nFormatTo>");

			std::wstring sAdditionXml = L"";
			if (AVS_OFFICESTUDIO_FILE_CROSSPLATFORM_PDFA == m_nOutputFormat)
			{
				m_nOutputFormat = AVS_OFFICESTUDIO_FILE_CROSSPLATFORM_PDF;
				sAdditionXml = L"<m_bIsPDFA>true</m_bIsPDFA>";
			}

			oBuilder.WriteString(std::to_wstring(m_nOutputFormat));
			oBuilder.WriteString(L"</m_nFormatTo><m_sFontDir>");
			oBuilder.WriteEncodeXmlString(tools.getFontsDirectory());
			oBuilder.WriteString(L"</m_sFontDir>");
			oBuilder.WriteString(L"<m_bIsNoBase64>false</m_bIsNoBase64>");
			oBuilder.WriteString(L"<m_sAllFontsPath>");
			oBuilder.WriteEncodeXmlString(tools.getFontsDirectory());
			oBuilder.WriteString(L"/AllFonts.js</m_sAllFontsPath>");

			oBuilder.WriteString(L"<m_sTempDir>");
			oBuilder.WriteEncodeXmlString(m_sTempDirectory);
			oBuilder.WriteString(L"</m_sTempDir>");

			oBuilder.WriteString(L"<m_nCsvTxtEncoding>46</m_nCsvTxtEncoding>");

			if (!sAdditionXml.empty())
				oBuilder.WriteString(sAdditionXml);

			if (m_nOutputFormat & AVS_OFFICESTUDIO_FILE_IMAGE)
			{
				oBuilder.WriteString(L"<m_oThumbnail><first>false</first>");

				if (m_nOutputFormat == AVS_OFFICESTUDIO_FILE_IMAGE_JPG)
					oBuilder.WriteString(L"<format>3</format>");

				oBuilder.WriteString(L"</m_oThumbnail>");
			}

			oBuilder.WriteString(L"</TaskQueueDataConvert>");

			std::wstring sTempFileForParams = m_sTempDirectory + L"/params_simple_converter.xml";
			NSFile::CFileBinary::SaveToFile(sTempFileForParams, oBuilder.GetData(), true);

			CAscApplicationManager manager;
			int nReturnCode = NSX2T::Convert(tools.getWorkDirectory() + L"/x2t", sTempFileForParams, &manager, false);

			return nReturnCode;
		}
	};

	std::string main(const std::string& arg, CAIToolsHelper* helper)
	{
		json returnValue = json::object();
		returnValue["role"] = "tool";

		json param = json::parse(arg);
		if (!param.contains("path") || !param["path"].is_string())
		{
			returnValue["status"] = "error";
			returnValue["error_message"] = "The file was not opened.";
			returnValue["content"] = "";
			return returnValue.dump();
		}
		else
		{
			std::string path = param["path"];
			std::wstring pathW = UTF8_TO_U(path);

			COfficeFileFormatChecker checker;
			if (!checker.isOfficeFile(pathW))
			{
				returnValue["status"] = "error";
				returnValue["error_message"] = "The file was not opened.";
				returnValue["content"] = "";
				return returnValue.dump();
			}

			std::string content;
			if (checker.nFileType == AVS_OFFICESTUDIO_FILE_DOCUMENT_MD ||
				checker.nFileType == AVS_OFFICESTUDIO_FILE_DOCUMENT_TXT ||
				checker.nFileType == AVS_OFFICESTUDIO_FILE_SPREADSHEET_CSV)
			{
				NSFile::CFileBinary::ReadAllTextUtf8A(pathW, content);
			}
			else
			{
				CConverter converter;
				converter.m_pHelper = helper;
				converter.m_sInputFile = pathW;

				converter.m_nOutputFormat = AVS_OFFICESTUDIO_FILE_DOCUMENT_TXT;
				if (checker.nFileType & AVS_OFFICESTUDIO_FILE_SPREADSHEET)
					converter.m_nOutputFormat = AVS_OFFICESTUDIO_FILE_SPREADSHEET_CSV;

				int nResult = converter.Convert();

				if (0 != nResult)
				{
					returnValue["status"] = "error";
					returnValue["error_message"] = "The file was not opened.";
					returnValue["content"] = "";
					return returnValue.dump();
				}

				returnValue["status"] = "success";
				NSFile::CFileBinary::ReadAllTextUtf8A(converter.m_sOutputFile, content);
			}

			returnValue["content"] = content;

			return JSON_serialize(returnValue);
		}
	}
}
