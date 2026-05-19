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

#ifndef LOGGER_PRIVATE_H
#define LOGGER_PRIVATE_H

#include <string>
#include "../../../../core/DesktopEditor/graphics/Timer.h"

#if 0
class CLoggerSpeed
{
public:
    DWORD m_dwTime;

public:
    CLoggerSpeed()
    {
        m_dwTime = NSTimers::GetTickCount();
    }
    void Lap(const std::string& details)
    {
        DWORD dwCur = NSTimers::GetTickCount();
        FILE* f = fopen("D:\\doctrenderer.speed", "a+");
        std::string sTmp = details + ": %d\n";
        fprintf(f, sTmp.c_str(), (int)(dwCur - m_dwTime));
        fclose(f);
        m_dwTime = dwCur;
    }
    static void Log(const std::wstring& details)
    {
        FILE* f = fopen("D:\\core.log", "a+");
        std::string detailsA = U_TO_UTF8(details);
        detailsA += "\n";
        fprintf(f, detailsA.c_str());
        fclose(f);
    }
    static void Log(const std::string& details)
    {
        FILE* f = fopen("D:\\core.log", "a+");
        std::string detailsA = details;
        detailsA += "\n";
        fprintf(f, detailsA.c_str());
        fclose(f);
    }
};

#define LOGGER_SPEED_START CLoggerSpeed __logger_speed;
#define LOGGER_SPEED_LAP(__logger_param) __logger_speed.Lap(#__logger_param);
#define LOGGER_STRING(__logger_param) CLoggerSpeed::Log(#__logger_param);
#define LOGGER_STRING2(__logger_param) CLoggerSpeed::Log(__logger_param);
#else
#define LOGGER_SPEED_START
#define LOGGER_SPEED_LAP(__logger_param)
#define LOGGER_STRING(__logger_param)
#define LOGGER_STRING2(__logger_param)
#endif

#endif // LOGGER_PRIVATE_H
