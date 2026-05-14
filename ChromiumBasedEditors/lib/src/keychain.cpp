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

#include "../include/keychain.h"
#include <stdlib.h>

#define ENC_KEY_LENGTH 256

#ifdef WIN32
#include <wchar.h>
#include <windows.h>
#include <wincrypt.h>
#endif

#ifdef _MAC
#include <CoreFoundation/CoreFoundation.h>
#include <Security/Security.h>
#endif

#include "../../../../core/DesktopEditor/common/File.h"
#include "../../../../core/DesktopEditor/graphics/Timer.h"

namespace NSAscCrypto
{
    void CAscKeychain::Check(const std::wstring &sFile)
    {
        if (true)
        {
            NSFile::CFileBinary oFile;
            if (oFile.OpenFile(sFile))
            {
                BYTE pCheckData[8];
                memset(pCheckData, 0, 8);
                DWORD dwRead = 0;
                oFile.ReadFile(pCheckData, 8, dwRead);
                oFile.CloseFile();

                DWORD nMagic = ((pCheckData[0]) | (pCheckData[1] << 8) | (pCheckData[2] << 16) | (pCheckData[3] << 24));
                DWORD nVersion = ((pCheckData[4]) | (pCheckData[5] << 8) | (pCheckData[6] << 16) | (pCheckData[7] << 24));

                if (nMagic != ASC_ENCRYPTED_USER_MASK || nVersion != ASC_ENCRYPTED_USER_VERSION)
                {
                    NSFile::CFileBinary::Remove(sFile);
                }
            }
        }

        CCryptoKey key;
        NSFile::CFileBinary oFile;
        if (oFile.OpenFile(sFile))
        {
            oFile.SeekFile(8); // magic, version

            int nLen = 0;
            BYTE pDataLen[4];
            DWORD dwReadLen = 0;
            oFile.ReadFile(pDataLen, 4, dwReadLen);
            nLen = (int)((pDataLen[0]) | (pDataLen[1] << 8) | (pDataLen[2] << 16) | (pDataLen[3] << 24));

            key.data = new BYTE[nLen];
            key.len = nLen;
            oFile.ReadFile(key.data, (DWORD)nLen, dwReadLen);
            oFile.CloseFile();

            this->Load("asc-desktop-crypto-key", key);
        }
        else
        {
            std::string alphanum = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
            int alphanumlen = alphanum.length();
            key.data = new BYTE[ENC_KEY_LENGTH];
            key.len = ENC_KEY_LENGTH;

            srand((unsigned int)NSTimers::GetTickCount());
            for (int i = 0; i < ENC_KEY_LENGTH; ++i)
            {
                key.data[i] = (BYTE)alphanum[rand() % (alphanumlen - 1)];
            }

            this->Save("asc-desktop-crypto-key", key);
        }
    }

    void CAscKeychain::Load(const std::string& name, CCryptoKey& keyEnc)
    {
#ifdef WIN32
        DATA_BLOB DataIn;
        DataIn.pbData = keyEnc.data;
        DataIn.cbData = keyEnc.len;

        DATA_BLOB DataOut;
        LPWSTR pDescrOut =  NULL;
        CryptUnprotectData(&DataIn, &pDescrOut, NULL, NULL, NULL, 0, &DataOut);

        CCryptoKey keyDec;
        keyDec.len = DataOut.cbData;
        keyDec.data = new BYTE[keyDec.len];
        memcpy(keyDec.data, DataOut.pbData, keyDec.len);

        LocalFree((HLOCAL)DataOut.pbData);

        if (m_pListener)
            m_pListener->OnKeyChainComplete(keyEnc, keyDec);
#endif

#if defined(_LINUX) && !defined(_MAC)
        // QtKeychain!

        CCryptoKey keyDec = keyEnc;
        if (m_pListener)
            m_pListener->OnKeyChainComplete(keyEnc, keyDec);
#endif

#ifdef _MAC
        void* data = 0;
        UInt32 len = 0;

        std::string sName = "asc-desktop-crypto-key";

        const OSStatus ret = SecKeychainFindGenericPassword( NULL, // default keychain
                                                             sName.length(),
                                                             sName.c_str(),
                                                             0,
                                                             NULL,
                                                             &len,
                                                             &data,
                                                             NULL );

        CCryptoKey keyDec;
        if ( ret == noErr )
        {
            keyDec.len = len;
            keyDec.Create(len);
            memcpy(keyDec.data, data, keyDec.len);

            if (m_pListener)
                m_pListener->OnKeyChainComplete(keyEnc, keyDec);

            const OSStatus ret2 = SecKeychainItemFreeContent ( 0, data );
        }
        else
        {
            if (m_pListener)
                m_pListener->OnKeyChainComplete(keyEnc, keyDec);
        }
#endif

    }
    void CAscKeychain::Save(const std::string& name, CCryptoKey& keyDec)
    {
#ifdef WIN32
        DATA_BLOB DataIn;
        DataIn.pbData = keyDec.data;
        DataIn.cbData = keyDec.len;

        DATA_BLOB DataOut;
        LPWSTR pDescrOut =  NULL;
        CryptProtectData(&DataIn, pDescrOut, NULL, NULL, NULL, 0, &DataOut);

        CCryptoKey keyEnc;
        keyEnc.len = DataOut.cbData;
        keyEnc.data = new BYTE[keyEnc.len];
        memcpy(keyEnc.data, DataOut.pbData, keyEnc.len);

        LocalFree((HLOCAL)DataOut.pbData);

        if (m_pListener)
            m_pListener->OnKeyChainComplete(keyEnc, keyDec);
#endif

#if defined(_LINUX) && !defined(_MAC)
        // QtKeychain!
        CCryptoKey keyEnc = keyDec;
        if (m_pListener)
            m_pListener->OnKeyChainComplete(keyEnc, keyDec);
#endif

#ifdef _MAC
        void* data = (void*)keyDec.data;
        UInt32 len = (UInt32)keyDec.len;

        std::string sName = "asc-desktop-crypto-key";

        CCryptoKey keyEnc;
        const OSStatus ret = SecKeychainAddGenericPassword( NULL, // default keychain
                                                             sName.length(),
                                                             sName.c_str(),
                                                             0,
                                                             NULL,
                                                             len,
                                                             data,
                                                             NULL );

        if ( ret == noErr )
        {
            if (m_pListener)
                m_pListener->OnKeyChainComplete(keyEnc, keyDec);
        }
        else
        {
            if (m_pListener)
                m_pListener->OnKeyChainComplete(keyEnc, keyDec);
        }
#endif
    }
}
