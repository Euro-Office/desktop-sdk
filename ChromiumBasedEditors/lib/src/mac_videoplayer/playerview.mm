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

#include "playerview.h"

#import "NSString+StringUtils.h"

CPlayerView::CPlayerView(NSRect video_view_rect, NSRect footer_panel_rect, NSView* parent) {
	// create player
	m_player = [[AVPlayer alloc] init];
	// add video view
	m_video_view = [[NSVideoView alloc] initWithFrame:video_view_rect player:m_player superview:parent];
	[m_video_view setHidden:YES];
	// add footer panel
	m_footer = [[NSFooterPanel alloc] initWithFrame:footer_panel_rect superview:parent];
	// initialize player controller (it should be initialized AFTER the player and footer panel)
	m_controller = [[NSPlayerControllerBridge alloc] initWithPlayer:m_player videoView:m_video_view footer:m_footer];
}

CPlayerView::~CPlayerView() {
	// we MUST remove any existing observers first
	[m_controller removeObservers];

	[m_player pause];
#if !__has_feature(objc_arc)
	[m_player release];
#endif
	m_player = nil;

	[m_video_view removeFromSuperview];
#if !__has_feature(objc_arc)
	[m_video_view release];
#endif
	m_video_view = nil;

	[m_footer removeFromSuperview];
#if !__has_feature(objc_arc)
	[m_footer release];
#endif
	m_footer = nil;

#if !__has_feature(objc_arc)
	[m_controller release];
#endif
	m_controller = nil;
}

NSVideoView* CPlayerView::VideoView() {
	return m_video_view;
}

NSFooterPanel* CPlayerView::Footer() {
	return m_footer;
}

void CPlayerView::Play() {
	[m_controller play];
}

void CPlayerView::Pause() {
	[m_controller pause];
}

void CPlayerView::TogglePause() {
	[m_controller togglePause];
}

void CPlayerView::ChangeVolume(double new_value) {
	[m_controller setVolume:new_value];
}

void CPlayerView::ToggleMute() {
	[m_controller toggleMute];
}

bool CPlayerView::SetMedia(const std::wstring& media_path) {
	// TODO: stringWithWString causes memory leaks ???
	NSString* path = [NSString stringWithWString:media_path];
	return [m_controller setMedia:path];
}

void CPlayerView::Stop() {
	[m_controller stop];
}
