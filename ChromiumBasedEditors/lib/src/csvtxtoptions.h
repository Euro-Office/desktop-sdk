/*
 * SPDX-FileCopyrightText: 2026 Euro-Office contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

#ifndef ASC_CSVTXTOPTIONS_H
#define ASC_CSVTXTOPTIONS_H

#include <string>

// The encoding and delimiter a CSV/TXT file was opened with, kept so that
// saving the file writes them again (Euro-Office/DesktopEditors#287).
namespace NSCsvTxtOptions
{
	// The x2t options (m_nCsvTxtEncoding, m_nCsvDelimiter, m_nCsvDelimiterChar)
	// in the xml the editor passes to SetAdvancedOptions, as a clean x2t xml
	// fragment. Empty when the xml has none of them.
	std::wstring FromOpenOptions(const std::wstring& sOptionsXml);

	bool IsCsvTxtFormat(int nFileFormat);

	// The encoding and delimiter part of the x2t parameters for saving to
	// nFileFormat: the options the file was opened with for CSV/TXT formats,
	// UTF-8 and comma for anything missing and for all other formats.
	std::wstring GetSaveParams(int nFileFormat, const std::wstring& sOpenOptions);
}

#endif // ASC_CSVTXTOPTIONS_H
