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

#ifndef Q_FOOTER_PANEL_PRIVATE_H
#define Q_FOOTER_PANEL_PRIVATE_H

#include <QWidget>

#include "qiconpushbutton.h"
#include "qvideoslider.h"
#include "qtimelabel.h"
#include "style/style_options.h"

class QAscVideoView;
class QFooterPanel;
class QFooterPanel_Private
{
public:
	QAscVideoView*	m_pView;

	// footer elements
	QIconPushButton*	m_pPlayPause;
	QIconPushButton*	m_pVolume;
	QIconPushButton*	m_pFullscreen;
	QIconPushButton*	m_pPlaylist;
	QIconPushButton*	m_pRewindBack;
	QIconPushButton*	m_pRewindForward;
	QVideoSlider*		m_pSlider;
	QTimeLabel*			m_pTimeLabel;


	// volume control elements
	QWidget*		m_pVolumeControl;
	QVideoSlider*	m_pVolumeControlV;

	// style options
	CFooterStyleOptions	m_oStyleOpt;

	// flags
	bool m_bIsEnabledPlayList;
	bool m_bIsEnabledFullscreen;
	bool m_bIsRoundedCorners;

	// constants
	const int c_nHeight = 40;
	const int c_nMinWidth = 320;
	const int c_nMaxWidth = 1000;

	const int c_nButtonsWidth = 30;
	const int c_nButtonsY = 5;
	const int c_nButtonsBetween = 8;

	const int c_nVolumeControlWidth = 30;
	const int c_nVolumeControlHeight = 140;

	const int c_nVolumeSliderWidth = 20;
	const int c_nVolumeSliderHeight = 120;

	const int c_nBorderRadius = 5;
};

#endif // Q_FOOTER_PANEL_PRIVATE_H
