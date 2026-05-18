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

#ifndef PLAYER_VIEW_H_
#define PLAYER_VIEW_H_

#include <string>

#import <AVFoundation/AVFoundation.h>

#import "videoview.h"
#import "footerpanel.h"
#import "playercontroller.h"

/*
 * The main class that owns footer panel, player and video frame.
 * It also provides an interface for media playback functionality, but does not
 * control playback itself, delegating it to the player controller instead.
 */
class CPlayerView {
public:
	CPlayerView(NSRect video_view_rect, NSRect footer_panel_rect, NSView* parent);
	~CPlayerView();
	// not copyable
	CPlayerView(const CPlayerView& other) = delete;
	CPlayerView& operator=(const CPlayerView& other) = delete;
	// not movable
	CPlayerView(CPlayerView&& other) = delete;
	CPlayerView& operator=(CPlayerView&& other) = delete;

public:
	// getters
	NSVideoView* VideoView();
	NSFooterPanel* Footer();

	// player commands
	void Play();
	void Pause();
	void TogglePause();
	void ChangeVolume(double new_value);
	void ToggleMute();
	bool SetMedia(const std::wstring& media_path);
	void Stop();

private:
	AVPlayer* m_player = nil;
	NSVideoView* m_video_view = nil;
	NSFooterPanel* m_footer = nil;
	NSPlayerControllerBridge* m_controller = nil;
};

#endif	// PLAYER_VIEW_H_
