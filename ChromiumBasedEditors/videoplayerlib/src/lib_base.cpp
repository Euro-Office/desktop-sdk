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

#include "../qascvideoview.h"
#include "./lib_base.h"

#ifdef USE_VLC_LIBRARY

#ifdef _WIN32
#include <windows.h>

LONG WINAPI vlc_exception_filter(struct _EXCEPTION_POINTERS *lpExceptionInfo)
{
	exit(0);
	return EXCEPTION_CONTINUE_EXECUTION;
}

#ifdef QT_VERSION_6
#include <QOperatingSystemVersion>
static void CheckWindowsOld()
{
	QOperatingSystemVersion osVersion = QOperatingSystemVersion::current();

	if ((osVersion.majorVersion() == 5) || (osVersion.majorVersion() == 6 && osVersion.minorVersion() == 0))
	{
		SetErrorMode(SEM_FAILCRITICALERRORS);
		SetUnhandledExceptionFilter(vlc_exception_filter);
	}
}
#else
#include <QSysInfo>
static void CheckWindowsOld()
{
	switch (QSysInfo::windowsVersion())
	{
	case QSysInfo::WV_2000:
	case QSysInfo::WV_XP:
	case QSysInfo::WV_2003:
	case QSysInfo::WV_VISTA:
	{
		SetErrorMode(SEM_FAILCRITICALERRORS);
		SetUnhandledExceptionFilter(vlc_exception_filter);
		break;
	}
	default:
		break;
	}
}
#endif

#endif

void NSBaseVideoLibrary::Init(QObject* parent)
{
	if (!parent)
		return;

#ifdef _WIN32
	CheckWindowsOld();
#endif
}

void NSBaseVideoLibrary::SetVerbosityLevel(int nVerbose)
{
	CVlcInstance::setVerbosityLevel(nVerbose);
}

#else

void NSBaseVideoLibrary::Init(QObject* parent)
{
}

void NSBaseVideoLibrary::SetVerbosityLevel(int nVerbose)
{
}

#endif
