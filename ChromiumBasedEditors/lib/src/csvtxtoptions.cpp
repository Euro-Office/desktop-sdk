/*
 * SPDX-FileCopyrightText: 2026 Euro-Office contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

#include "csvtxtoptions.h"

#include "../../../../core/Common/OfficeFileFormats.h"
#include "../../../../core/DesktopEditor/common/StringBuilder.h"
#include "../../../../core/DesktopEditor/xml/include/xmlutils.h"

#include <cwchar>

namespace NSCsvTxtOptions
{
	namespace
	{
		void WriteNumber(NSStringUtils::CStringBuilder& oBuilder, const wchar_t* sName, XmlUtils::CXmlNode& oNode)
		{
			oBuilder.WriteString(L"<");
			oBuilder.WriteString(sName);
			oBuilder.WriteString(L">");
			oBuilder.WriteString(std::to_wstring((int)wcstol(oNode.GetText().c_str(), NULL, 10)));
			oBuilder.WriteString(L"</");
			oBuilder.WriteString(sName);
			oBuilder.WriteString(L">");
		}
	}

	std::wstring FromOpenOptions(const std::wstring& sOptionsXml)
	{
		XmlUtils::CXmlNode oRoot;
		if (!oRoot.FromXmlString(L"<info>" + sOptionsXml + L"</info>"))
			return L"";

		XmlUtils::CXmlNode oEncoding = oRoot.ReadNode(L"m_nCsvTxtEncoding");
		XmlUtils::CXmlNode oDelimiter = oRoot.ReadNode(L"m_nCsvDelimiter");
		XmlUtils::CXmlNode oDelimiterChar = oRoot.ReadNode(L"m_nCsvDelimiterChar");

		NSStringUtils::CStringBuilder oBuilder;
		if (oEncoding.IsValid())
			WriteNumber(oBuilder, L"m_nCsvTxtEncoding", oEncoding);
		if (oDelimiter.IsValid())
			WriteNumber(oBuilder, L"m_nCsvDelimiter", oDelimiter);
		if (oDelimiterChar.IsValid())
		{
			oBuilder.WriteString(L"<m_nCsvDelimiterChar>");
			oBuilder.WriteEncodeXmlString(oDelimiterChar.GetText());
			oBuilder.WriteString(L"</m_nCsvDelimiterChar>");
		}
		return oBuilder.GetData();
	}

	bool IsCsvTxtFormat(int nFileFormat)
	{
		switch (nFileFormat)
		{
		case AVS_OFFICESTUDIO_FILE_SPREADSHEET_CSV:
		case AVS_OFFICESTUDIO_FILE_SPREADSHEET_TSV:
		case AVS_OFFICESTUDIO_FILE_SPREADSHEET_SCSV:
		case AVS_OFFICESTUDIO_FILE_DOCUMENT_TXT:
			return true;
		default:
			return false;
		}
	}

	std::wstring GetSaveParams(int nFileFormat, const std::wstring& sOpenOptions)
	{
		const bool bUseOpenOptions = IsCsvTxtFormat(nFileFormat);
		const std::wstring sOptions = bUseOpenOptions ? sOpenOptions : L"";

		std::wstring sParams;
		if (std::wstring::npos == sOptions.find(L"<m_nCsvTxtEncoding>"))
			sParams += L"<m_nCsvTxtEncoding>46</m_nCsvTxtEncoding>";
		if (std::wstring::npos == sOptions.find(L"<m_nCsvDelimiter>") &&
			std::wstring::npos == sOptions.find(L"<m_nCsvDelimiterChar>"))
			sParams += L"<m_nCsvDelimiter>4</m_nCsvDelimiter>";
		sParams += sOptions;
		return sParams;
	}
}
