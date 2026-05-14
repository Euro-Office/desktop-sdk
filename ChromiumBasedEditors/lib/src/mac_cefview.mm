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

#import "../include/mac_cefview.h"

CCefViewWrapper::CCefViewWrapper(NSView* pView) : CCefViewWidgetImpl()
{
	m_pParent = pView;
	m_pCefView = NULL;

	cef_handle = (__bridge WindowHandleId)m_pParent;
}

CCefViewWrapper::~CCefViewWrapper()
{
}

void CCefViewWrapper::SetBackgroundCefColor(unsigned char r, unsigned char g, unsigned char b)
{
	backgroundR = r;
	backgroundG = g;
	backgroundB = b;
}

CCefView* CCefViewWrapper::GetCefView()
{
	return m_pCefView;
}

void CCefViewWrapper::focusInEvent()
{
	if (NULL != m_pCefView)
		m_pCefView->focus();
}

void CCefViewWrapper::resizeEvent()
{
	UpdateGeometry();
	if (NULL != m_pCefView)
		m_pCefView->resizeEvent();
}

void CCefViewWrapper::moveEvent()
{
	UpdateGeometry();
	if (NULL != m_pCefView)
		m_pCefView->moveEvent();
}

void CCefViewWrapper::OnMediaPlayerCommand(NSEditorApi::CAscExternalMediaPlayerCommand* data)
{
}

void CCefViewWrapper::UpdateSize()
{
	NSView* child = nil;

	if ([[m_pParent subviews] count] > 0)
		child = [m_pParent subviews][0];

	NSRect childRect = m_pParent.frame;
	childRect.origin.x = 0;
	childRect.origin.y = 0;
	child.frame = childRect;
}

void CCefViewWrapper::UpdateGeometry()
{
	//CGFloat koef = [[NSScreen mainScreen] backingScaleFactor];
	CGFloat koef = 1;
	cef_x = 0;
	cef_y = 0;
	cef_width = (int)(m_pParent.frame.size.width * koef);
	cef_height = (int)(m_pParent.frame.size.height * koef);
}
