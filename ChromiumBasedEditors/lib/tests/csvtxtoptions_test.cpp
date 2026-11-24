/*
 * SPDX-FileCopyrightText: 2026 Euro-Office contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

#include <gtest/gtest.h>
#include "../src/csvtxtoptions.h"
#include "../../../../core/Common/OfficeFileFormats.h"

// The CSV/TXT encoding and delimiter a local file was opened with are kept
// and written again on save (src/csvtxtoptions.cpp, Euro-Office/DesktopEditors#287).
// sdkjs passes them to SetAdvancedOptions as x2t options; codepage 46 is UTF-8,
// delimiter 1 tab, 2 semicolon, 4 comma, 5 a custom character.

using namespace NSCsvTxtOptions;

TEST(CsvTxtOptions, KeepsSemicolonAndCodepageFromTheOpenDialog)
{
	std::wstring sOpen = L"<m_nCsvTxtEncoding>1252</m_nCsvTxtEncoding><m_nCsvDelimiter>2</m_nCsvDelimiter>";
	std::wstring sStored = FromOpenOptions(sOpen);
	EXPECT_EQ(sOpen, sStored);
	EXPECT_EQ(sOpen, GetSaveParams(AVS_OFFICESTUDIO_FILE_SPREADSHEET_CSV, sStored));
}

TEST(CsvTxtOptions, KeepsOnlyTheCsvOptions)
{
	std::wstring sStored = FromOpenOptions(
		L"<m_sPassword>secret</m_sPassword><m_nCsvTxtEncoding>46</m_nCsvTxtEncoding>"
		L"<m_nCsvDelimiter>1</m_nCsvDelimiter><m_sOther>x</m_sOther>");
	EXPECT_EQ(L"<m_nCsvTxtEncoding>46</m_nCsvTxtEncoding><m_nCsvDelimiter>1</m_nCsvDelimiter>", sStored);
}

TEST(CsvTxtOptions, NormalizesNumbersAndEscapesTheDelimiterChar)
{
	std::wstring sStored = FromOpenOptions(
		L"<m_nCsvDelimiter> 5x</m_nCsvDelimiter><m_nCsvDelimiterChar>&amp;</m_nCsvDelimiterChar>");
	EXPECT_EQ(L"<m_nCsvDelimiter>5</m_nCsvDelimiter><m_nCsvDelimiterChar>&amp;</m_nCsvDelimiterChar>", sStored);
}

TEST(CsvTxtOptions, NothingToKeepWithoutCsvOptions)
{
	EXPECT_EQ(L"", FromOpenOptions(L""));
	EXPECT_EQ(L"", FromOpenOptions(L"<m_sPassword>secret</m_sPassword>"));
	EXPECT_EQ(L"", FromOpenOptions(L"<not closed"));
}

TEST(CsvTxtOptions, DefaultsToUtf8AndCommaWhenNothingWasKept)
{
	EXPECT_EQ(L"<m_nCsvTxtEncoding>46</m_nCsvTxtEncoding><m_nCsvDelimiter>4</m_nCsvDelimiter>",
			  GetSaveParams(AVS_OFFICESTUDIO_FILE_SPREADSHEET_CSV, L""));
}

TEST(CsvTxtOptions, FillsInOnlyWhatIsMissing)
{
	EXPECT_EQ(L"<m_nCsvDelimiter>4</m_nCsvDelimiter><m_nCsvTxtEncoding>1251</m_nCsvTxtEncoding>",
			  GetSaveParams(AVS_OFFICESTUDIO_FILE_DOCUMENT_TXT, L"<m_nCsvTxtEncoding>1251</m_nCsvTxtEncoding>"));
	// a custom delimiter character replaces the default delimiter
	EXPECT_EQ(L"<m_nCsvTxtEncoding>46</m_nCsvTxtEncoding><m_nCsvDelimiterChar>|</m_nCsvDelimiterChar>",
			  GetSaveParams(AVS_OFFICESTUDIO_FILE_SPREADSHEET_CSV, L"<m_nCsvDelimiterChar>|</m_nCsvDelimiterChar>"));
}

TEST(CsvTxtOptions, UsesTheKeptOptionsOnlyForCsvAndTxt)
{
	const std::wstring sStored = L"<m_nCsvTxtEncoding>1252</m_nCsvTxtEncoding><m_nCsvDelimiter>2</m_nCsvDelimiter>";
	EXPECT_EQ(sStored, GetSaveParams(AVS_OFFICESTUDIO_FILE_SPREADSHEET_TSV, sStored));
	EXPECT_EQ(sStored, GetSaveParams(AVS_OFFICESTUDIO_FILE_SPREADSHEET_SCSV, sStored));
	EXPECT_EQ(L"<m_nCsvTxtEncoding>46</m_nCsvTxtEncoding><m_nCsvDelimiter>4</m_nCsvDelimiter>",
			  GetSaveParams(AVS_OFFICESTUDIO_FILE_SPREADSHEET_XLSX, sStored));
	EXPECT_EQ(L"<m_nCsvTxtEncoding>46</m_nCsvTxtEncoding><m_nCsvDelimiter>4</m_nCsvDelimiter>",
			  GetSaveParams(AVS_OFFICESTUDIO_FILE_DOCUMENT_DOCX, sStored));
}
