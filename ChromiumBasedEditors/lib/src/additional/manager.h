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

#ifndef APPLICATION_MANAGER_ADDITIONAL_H
#define APPLICATION_MANAGER_ADDITIONAL_H

#include "../../include/applicationmanager_events.h"
#include "./renderer.h"
#include "../../../../../core/DesktopEditor/graphics/pro/Graphics.h"
#include "./../../include/applicationmanager.h"

class CApplicationManagerAdditionalBase
{
public:
	std::vector<NSEditorApi::CAscMenuEvent*>* m_arApplyEvents;

public:
	CApplicationManagerAdditionalBase(CAscApplicationManager* pManager)
	{
		m_arApplyEvents = NULL;
	}
	virtual ~CApplicationManagerAdditionalBase()
	{
	}

public:
	virtual bool GetEditorPermission() { return true; }

	virtual void Apply(NSEditorApi::CAscMenuEvent* pEvent) {}
	virtual void ApplyView(CCefView* pView, NSEditorApi::CAscMenuEvent* pEvent, CefRefPtr<CefBrowser> browser) {}

	virtual bool OnProcessMessageReceived(CefRefPtr<CefBrowser> browser,
										  CefProcessId source_process,
										  CefRefPtr<CefProcessMessage> message,
										  CCefView* view)
	{
		return false;
	}

	virtual void CheckSaveStart(std::wstring sDirectory, int nFileType) {}
	virtual void CheckSaveEnd() {}

	virtual void Print_Start() {}
	virtual void Print_End() {}
	virtual void Check_Print(IRenderer* pRenderer, NSFonts::IFontManager* pFontManager, int nRasterW, int nRasterH, double fPageWidth, double fPageHeight) {}

	virtual void Local_Save_Start() {}
	virtual bool Local_Save_End(bool bIsNeedSaveDialog, int nId, CefRefPtr<CefBrowser> browser) { return false; }

	virtual std::wstring GetExternalSchemeName() { return L"oo-office"; }
};

CApplicationManagerAdditionalBase* Create_ApplicationManagerAdditional(CAscApplicationManager* pManager);

#endif // APPLICATION_MANAGER_ADDITIONAL_H
