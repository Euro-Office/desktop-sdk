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

#include "crypto_mode.h"
#include "aes256.cpp"
#include "./../../../../core/DesktopEditor/common/File.h"

namespace NSAscCrypto
{
    bool WriteData(NSFile::CFileBinary& oFile, BYTE* pData, int nLen)
    {
        return oFile.WriteFile(pData, (DWORD)nLen);
    }

    bool ReadData(NSFile::CFileBinary& oFile, BYTE* pData, int nLen)
    {
        DWORD dwW = 0;
        oFile.ReadFile(pData, (DWORD)nLen, dwW);
        return (dwW == (DWORD)nLen) ? true : false;
    }

    bool WriteDWORD(NSFile::CFileBinary& oFile, DWORD val)
    {
        BYTE pFileData[4];
        pFileData[0] = val & 0xFF;
        pFileData[1] = (val >> 8) & 0xFF;
        pFileData[2] = (val >> 16) & 0xFF;
        pFileData[3] = (val >> 24) & 0xFF;
        return WriteData(oFile, pFileData, 4);
    }

    bool WriteInt(NSFile::CFileBinary& oFile, int val)
    {
        BYTE pFileData[4];
        pFileData[0] = val & 0xFF;
        pFileData[1] = (val >> 8) & 0xFF;
        pFileData[2] = (val >> 16) & 0xFF;
        pFileData[3] = (val >> 24) & 0xFF;
        return WriteData(oFile, pFileData, 4);
    }

    int ReadInt(NSFile::CFileBinary& oFile)
    {
        BYTE pFileData[4];
        ReadData(oFile, pFileData, 4);
        return (int)((pFileData[0]) | (pFileData[1] << 8) | (pFileData[2] << 16) | (pFileData[3] << 24));
    }

    CCryptoMode::CCryptoMode()
    {
    }

    void CCryptoMode::Save(CCryptoKey& keyEnc, CCryptoKey& keyDec, std::map<NSAscCrypto::AscCryptoType, NSAscCrypto::CAscCryptoJsonValue>& map, const std::wstring& sPassFile)
    {
        if (NSFile::CFileBinary::Exists(sPassFile))
            NSFile::CFileBinary::Remove(sPassFile);

        NSFile::CFileBinary oFile;
        oFile.CreateFileW(sPassFile);

        // 0) magic & version
        WriteDWORD(oFile, ASC_ENCRYPTED_USER_MASK);
        WriteDWORD(oFile, ASC_ENCRYPTED_USER_VERSION);

        // 1) Save enc key
        WriteInt(oFile, keyEnc.len);
        WriteData(oFile, keyEnc.data, keyEnc.len);

        // 2) prepare key for encoding (keyDec)
        ByteArray keyEncArray;
        for (int i = 0; i < keyDec.len; ++i)
        {
            keyEncArray.push_back(keyDec.data[i]);
        }

        // 3) Save all modes
        WriteInt(oFile, (int)map.size());

        for (std::map<NSAscCrypto::AscCryptoType, NSAscCrypto::CAscCryptoJsonValue>::iterator iter = map.begin(); iter != map.end(); iter++)
        {
            NSAscCrypto::CAscCryptoJsonValue& item = iter->second;

            WriteInt(oFile, (int)item.m_eType);

            ByteArray passArray;
            int nPassLen = (int)item.m_sValue.length();
            for (int i = 0; i < nPassLen; ++i)
                passArray.push_back((BYTE)item.m_sValue.c_str()[i]);

            ByteArray passEnc;
            Aes256::encrypt(keyEncArray, passArray, passEnc);

            int nPassCryptDataLen = (int)passEnc.size();
            BYTE* pPassCryptData = new BYTE[nPassCryptDataLen];
            for (int i = 0; i < nPassCryptDataLen; ++i)
                pPassCryptData[i] = passEnc[i];

            WriteInt(oFile, nPassCryptDataLen);
            WriteData(oFile, pPassCryptData, nPassCryptDataLen);

            RELEASEARRAYOBJECTS(pPassCryptData);
        }
    }

    void CCryptoMode::Load(CCryptoKey& keyEnc, CCryptoKey& keyDec, const std::wstring& sPassFile)
    {
        NSFile::CFileBinary oFile;
        if (!oFile.OpenFile(sPassFile))
            return;

        // 0) Skip magic
        oFile.SeekFile(8);

        // 1) Skip keyEnc
        int nEncKeySize = ReadInt(oFile);
        oFile.SeekFile(8 + 4 + nEncKeySize);

        // 2) prepare key for encoding (keyDec)
        ByteArray keyEncArray;
        for (int i = 0; i < keyDec.len; ++i)
        {
            keyEncArray.push_back(keyDec.data[i]);
        }

        // 3) Load all modes
        int nModesCount = ReadInt(oFile);
        for (int nIndexMode = 0; nIndexMode < nModesCount; ++nIndexMode)
        {
            NSAscCrypto::CAscCryptoJsonValue val;
            val.m_eType = (NSAscCrypto::AscCryptoType)ReadInt(oFile);

            int nEncodedPassLen = ReadInt(oFile);
            BYTE* pEncodedPassData = new BYTE[nEncodedPassLen];
            ReadData(oFile, pEncodedPassData, nEncodedPassLen);

            ByteArray passEncArray;
            for (int i = 0; i < nEncodedPassLen; ++i)
                passEncArray.push_back(pEncodedPassData[i]);

            RELEASEARRAYOBJECTS(pEncodedPassData);

            ByteArray passArray;
            Aes256::decrypt(keyEncArray, passEncArray, passArray);

            int nPassDataLen = (int)passArray.size();
            for (int i = 0; i < nPassDataLen; ++i)
                val.m_sValue += ((char)passArray[i]);

            m_modes.push_back(val);
        }
    }
}
