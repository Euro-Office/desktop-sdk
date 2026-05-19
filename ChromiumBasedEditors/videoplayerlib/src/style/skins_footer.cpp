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

#include "skins_footer.h"

CFooterSkin CFooterSkin::getSkin(Type type)
{
	CFooterSkin skin;
	switch (type)
	{
	case tLight:
	{
		skin.m_oFooterStyleOpt.m_sBgColor = "#F1F1F1";
		skin.m_oFooterStyleOpt.m_sVolumeControlBgColor = "#F1F1F1";

		skin.m_oButtonStyleOpt.m_sSkinPostfix = "-light";
		skin.m_oButtonStyleOpt.m_sBgColorR = "transparent";
		skin.m_oButtonStyleOpt.m_sBgColorH = "#CBCBCB";
		skin.m_oButtonStyleOpt.m_sBgColorP = "#CBCBCB";
		skin.m_oButtonStyleOpt.m_nBorderRadius = 3;

		skin.m_oSliderStyleOpt1.m_sAddColor = "#848484";
		skin.m_oSliderStyleOpt1.m_sSubColor = "#E2E2E2";
		skin.m_oSliderStyleOpt1.m_sHandleColor = "#FFFFFF";
		skin.m_oSliderStyleOpt1.m_sHandleBorderColor = "#444444";

		skin.m_oSliderStyleOpt2.m_sAddColor = "#C0C0C0";
		skin.m_oSliderStyleOpt2.m_sSubColor = "#E2E2E2";
		skin.m_oSliderStyleOpt2.m_sHandleColor = "#FFFFFF";
		skin.m_oSliderStyleOpt2.m_sHandleBorderColor = "#444444";

		skin.m_oTimeLabelStyleOpt.m_oFont = QFont("Open Sans", 14, QFont::Normal);
		skin.m_oTimeLabelStyleOpt.m_sColor = "#444444";
		break;
	}
	case tDark:
	{
		skin.m_oFooterStyleOpt.m_sBgColor = "#313437";
		skin.m_oFooterStyleOpt.m_sVolumeControlBgColor = "#313437";

		skin.m_oButtonStyleOpt.m_sSkinPostfix = "-dark";
		skin.m_oButtonStyleOpt.m_sBgColorR = "transparent";
		skin.m_oButtonStyleOpt.m_sBgColorH = "#46494B";
		skin.m_oButtonStyleOpt.m_sBgColorP = "#46494B";
		skin.m_oButtonStyleOpt.m_nBorderRadius = 3;

		skin.m_oSliderStyleOpt1.m_sAddColor = "#9B9B9B";
		skin.m_oSliderStyleOpt1.m_sSubColor = "#545454";
		skin.m_oSliderStyleOpt1.m_sHandleColor = "#FFFFFF";
		skin.m_oSliderStyleOpt1.m_sHandleBorderColor = "#222222";

		skin.m_oSliderStyleOpt2.m_sAddColor = "#808080";
		skin.m_oSliderStyleOpt2.m_sSubColor = "#545454";
		skin.m_oSliderStyleOpt2.m_sHandleColor = "#FFFFFF";
		skin.m_oSliderStyleOpt2.m_sHandleBorderColor = "#222222";

		skin.m_oTimeLabelStyleOpt.m_oFont = QFont("Open Sans", 14, QFont::Normal);
		skin.m_oTimeLabelStyleOpt.m_sColor = "#D5D6D6";
		break;
	}
	default:
		// should never happen
		break;
	}

	return skin;
}
