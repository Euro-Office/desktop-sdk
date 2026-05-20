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

#ifndef APPLICATION_PROVIDERS_H
#define APPLICATION_PROVIDERS_H

#include "./plugins.h"
#include "./utils.h"

class CExternalCloudRegister
{
public:
    std::wstring id;
    std::wstring name;
    std::wstring test_editor;
    std::string correct_code;
    bool crypto_support;

public:
    CExternalCloudRegister()
    {
        id = L"";
        name = L"";
        test_editor = L"";
        correct_code = "";
        crypto_support = false;
    }

    CExternalCloudRegister(const CExternalCloudRegister& src)
    {
        id = src.id;
        name = src.name;
        test_editor = src.test_editor;
        correct_code = src.correct_code;
        crypto_support = src.crypto_support;
    }

    CExternalCloudRegister& operator=(const CExternalCloudRegister& src)
    {
        id = src.id;
        name = src.name;
        test_editor = src.test_editor;
        correct_code = src.correct_code;
        crypto_support = src.crypto_support;
        return *this;
    }
};

class CExternalClouds
{
public:
    std::wstring m_sSystemDirectory;
    std::wstring m_sUserDirectory;

public:
    CExternalClouds()
    {
    }

    void Load(std::vector<CExternalCloudRegister>& arClouds)
    {
        std::vector<std::wstring> arSystemDirs = NSDirectory::GetDirectories(m_sSystemDirectory);
        std::vector<std::wstring> arUserDirs;

        if (!m_sUserDirectory.empty())
            arUserDirs = NSDirectory::GetDirectories(m_sUserDirectory);

        if (!arUserDirs.empty())
            arSystemDirs.insert(arSystemDirs.end(), arUserDirs.begin(), arUserDirs.end());

        for (std::vector<std::wstring>::iterator iter = arSystemDirs.begin(); iter != arSystemDirs.end(); iter++)
        {
            std::wstring sConfigFile = *iter + L"/config.json";

            std::string sConfigData = "";
            if (NSFile::CFileBinary::ReadAllTextUtf8A(sConfigFile, sConfigData))
            {
                CExternalCloudRegister cloudEx;
                cloudEx.id = CPluginsManager::GetStringValueW(sConfigData, "id");
                if (cloudEx.id.empty())
                    cloudEx.id = CPluginsManager::GetStringValueW(sConfigData, "provider");
                cloudEx.name = CPluginsManager::GetStringValueW(sConfigData, "name");
                cloudEx.test_editor = CPluginsManager::GetStringValueW(sConfigData, "editorPage");
                std::wstring sCryptoTest = CPluginsManager::GetStringValueW(sConfigData, "cryptoSupport");
                if (sCryptoTest == L"true" || sCryptoTest == L"1")
                    cloudEx.crypto_support = true;
                arClouds.push_back(cloudEx);
            }
        }
    }

    std::string GetAllJSON()
    {
        std::vector<std::wstring> arSystemDirs = NSDirectory::GetDirectories(m_sSystemDirectory);
        std::vector<std::wstring> arUserDirs;

        if (!m_sUserDirectory.empty())
            arUserDirs = NSDirectory::GetDirectories(m_sUserDirectory);

        std::string sResult = "[";

        for (std::vector<std::wstring>::iterator iter = arSystemDirs.begin(); iter != arSystemDirs.end(); iter++)
        {
            std::wstring sConfigFile = *iter + L"/config.json";

            std::string sConfigData = "";
            if (NSFile::CFileBinary::ReadAllTextUtf8A(sConfigFile, sConfigData))
            {
                std::string::size_type find_id = sConfigData.find("{");
                if (std::string::npos != find_id)
                {
                    sConfigData = (sConfigData.substr(0, find_id + 1) + "\"path\":\"./providers/" + U_TO_UTF8(NSFile::GetFileName(*iter)) + "\"," + sConfigData.substr(find_id + 1));
                }

                NSStringUtils::string_replaceA(sConfigData, "\r", "");
                NSStringUtils::string_replaceA(sConfigData, "\n", "");
                NSStringUtils::string_replaceA(sConfigData, "\\", "\\\\");
                //NSStringUtils::string_replaceA(sConfigData, "\"", "\\\"");

                if (1 != sResult.length())
                    sResult += ",";

                sResult += sConfigData;
            }
        }

        for (std::vector<std::wstring>::iterator iter = arUserDirs.begin(); iter != arUserDirs.end(); iter++)
        {
            std::wstring sConfigFile = *iter + L"/config.json";

            std::string sConfigData = "";
            if (NSFile::CFileBinary::ReadAllTextUtf8A(sConfigFile, sConfigData))
            {
                std::string::size_type find_id = sConfigData.find("{");
                if (std::string::npos != find_id)
                {
                    std::wstring sDirPath = *iter;
                    NSStringUtils::string_replace(sDirPath, L"\\", L"/");
                    sConfigData = (sConfigData.substr(0, find_id + 1) + "\"path\":\"" + U_TO_UTF8(sDirPath) + "\"," + sConfigData.substr(find_id + 1));
                }

                NSStringUtils::string_replaceA(sConfigData, "\r", "");
                NSStringUtils::string_replaceA(sConfigData, "\n", "");
                NSStringUtils::string_replaceA(sConfigData, "\\", "\\\\");
                //NSStringUtils::string_replaceA(sConfigData, "\"", "\\\"");

                if (1 != sResult.length())
                    sResult += ",";

                sResult += sConfigData;
            }
        }

        sResult += "]";
        return sResult;
    }
};

#endif // APPLICATION_PROVIDERS_H
