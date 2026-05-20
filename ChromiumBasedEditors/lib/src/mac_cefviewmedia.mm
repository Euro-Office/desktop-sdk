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

#import "../include/mac_cefviewmedia.h"

CCefViewMedia::CCefViewMedia(NSView* view) : CCefViewWrapper(view) {}

CCefViewMedia::~CCefViewMedia() {
	hideMediaControl();
}

void CCefViewMedia::OnMediaPlayerCommand(NSEditorApi::CAscExternalMediaPlayerCommand* data) {
	std::string cmd = data->get_Cmd();
	if (cmd == "showMediaControl") {
		showMediaControl(data);
	} else if (cmd == "hideMediaControl") {
		hideMediaControl();
	} else if (cmd == "update") {
		updateGeometry(data);
	} else {
		// handle the possible case when player is not yet initialized
		if (m_player_view == nullptr) {
			return;
		}
		// handle player commands
		if (cmd == "play" || cmd == "resume") {
			m_player_view->Play();
		} else if (cmd == "pause") {
			m_player_view->Pause();
		} else if (cmd == "stop") {
			m_player_view->Stop();
		} else if (cmd == "togglePause") {
			m_player_view->TogglePause();
		} else {
			NSLog(@"Error: Media player command %s can not be handled.", cmd.c_str());
		}
	}
}

void CCefViewMedia::showMediaControl(NSEditorApi::CAscExternalMediaPlayerCommand* data) {
	if (m_player_view)
		return;

	// if media is not selected, don't do anything
	if (!data->get_IsSelected())
		return;

	// calculate rects
	NSRect video_view_rect = NSMakeRect(data->get_FrameBoundsX(), (int)cef_height - data->get_FrameBoundsH() - data->get_FrameBoundsY(), data->get_FrameBoundsW(), data->get_FrameBoundsH());
	NSRect footer_panel_rect = NSMakeRect(data->get_ControlRectX(), (int)cef_height - data->get_ControlRectH() - data->get_ControlRectY(), data->get_ControlRectW(), data->get_ControlRectH());
	// create and initialize player view
	m_player_view = new CPlayerView(video_view_rect, footer_panel_rect, m_pParent);

	// set footer skin
	NSFooterPanel* footer = m_player_view->Footer();
	std::string theme = data->get_Theme();
	if (theme == "dark") {
		[footer applySkin:CFooterSkin::Type::kDark];
	} else {
		[footer applySkin:CFooterSkin::Type::kLight];
	}

	// set media
	m_player_view->SetMedia(data->get_Url());
	// set volume
	int volume = data->get_Volume();
	if (data->get_Mute() || m_pCefView->IsPresentationReporter()) {
		m_player_view->ToggleMute();
	} else if (volume != -1) {
		m_player_view->ChangeVolume(volume);
	}
}

void CCefViewMedia::hideMediaControl() {
	if (!m_player_view)
		return;

	delete m_player_view;
	m_player_view = nullptr;
}

void CCefViewMedia::updateGeometry(NSEditorApi::CAscExternalMediaPlayerCommand* data) {
	if (!m_player_view)
		return;

	// update frame of the video view
	NSRect video_view_rect = NSMakeRect(data->get_FrameBoundsX(), (int)cef_height - data->get_FrameBoundsH() - data->get_FrameBoundsY(), data->get_FrameBoundsW(), data->get_FrameBoundsH());
	[m_player_view->VideoView() setFrame:video_view_rect];
	// update frame of the footer panel
	NSRect footer_panel_rect = NSMakeRect(data->get_ControlRectX(), (int)cef_height - data->get_ControlRectH() - data->get_ControlRectY(), data->get_ControlRectW(), data->get_ControlRectH());
	[m_player_view->Footer() setFrame:footer_panel_rect];
}
