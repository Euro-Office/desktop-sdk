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

#ifndef STYLE_OPTIONS_H
#define STYLE_OPTIONS_H

#include <QString>
#include <QFont>

/* NOTES:
 * 1. Colors are written in the same format as in CSS (i.e. using color names, hex, rgb() or rgba()).
 * 2. Names for icons should be in format "<button_name>[-<skin_postfix>](.png|-2x.png|.svg)"
 */

struct CButtonStyleOptions
{
	// icon skin postfix
	QString m_sSkinPostfix;
	// background colors
	QString m_sBgColorR;
	QString m_sBgColorH;
	QString m_sBgColorP;
	// border radius
	int m_nBorderRadius;
};

struct CSliderStyleOptions
{
	// groove colors
	QString m_sAddColor;			// the color of area between the start of a slider and the handle
	QString m_sSubColor;			// the color of area between the handle and the end of a slider
	// handle colors (only applied for sliders with QVideoSlider::HandleStyle = hsCircle)
	QString m_sHandleColor;
	QString m_sHandleBorderColor;
};

struct CTimeLabelOptions
{
	QFont m_oFont;
	QString m_sColor;
};

struct CFooterStyleOptions
{
	QString m_sBgColor;
	QString m_sVolumeControlBgColor;
};

#endif	// STYLE_OPTIONS_H
