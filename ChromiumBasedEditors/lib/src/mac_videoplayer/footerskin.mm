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

#include "footerskin.h"

CFooterSkin CFooterSkin::getSkin(Type type) {
	CFooterSkin skin;
	skin.type = type;
	switch (type) {
		case Type::kLight: {
			skin.footer.bg_color = 0xF1F1F1;

			skin.button.icon_postfix = @"-light";
			skin.button.bg_color_regular = 0xF1F1F1;
			skin.button.bg_color_hovered = 0xCBCBCB;
			skin.button.bg_color_pressed = 0xCBCBCB;
			skin.button.border_radius = 3;

			skin.video_slider.track.color = 0xE2E2E2;
			skin.video_slider.track.fill_color = 0x848484;
			skin.video_slider.track.thickness = 8;
			skin.video_slider.track.border_radius = 4;
			skin.video_slider.is_knob_visible = false;

			skin.volume_slider.track.color = 0xE2E2E2;
			skin.volume_slider.track.fill_color = 0xC0C0C0;
			skin.volume_slider.track.thickness = 8;
			skin.volume_slider.track.border_radius = 4;
			skin.volume_slider.is_knob_visible = true;
			skin.volume_slider.knob.color = 0xFFFFFF;
			skin.volume_slider.knob.border_color = 0x444444;
			skin.volume_slider.knob.thickness = 16;
			skin.volume_slider.knob.border_width = 2;
			skin.volume_slider.knob.border_radius = 8;

			skin.time_label.font_name = @"";
			skin.time_label.font_size = 14;
			skin.time_label.color = 0x444444;
			break;
		}
		case Type::kDark: {
			skin.footer.bg_color = 0x313437;

			skin.button.icon_postfix = @"-dark";
			skin.button.bg_color_regular = 0x313437;
			skin.button.bg_color_hovered = 0x46494B;
			skin.button.bg_color_pressed = 0x46494B;
			skin.button.border_radius = 3;

			skin.video_slider.track.color = 0x545454;
			skin.video_slider.track.fill_color = 0x9B9B9B;
			skin.video_slider.track.thickness = 8;
			skin.video_slider.track.border_radius = 4;
			skin.video_slider.is_knob_visible = false;

			skin.volume_slider.track.color = 0x545454;
			skin.volume_slider.track.fill_color = 0x808080;
			skin.volume_slider.track.thickness = 8;
			skin.volume_slider.track.border_radius = 4;
			skin.volume_slider.is_knob_visible = true;
			skin.volume_slider.knob.color = 0xFFFFFF;
			skin.volume_slider.knob.border_color = 0x222222;
			skin.volume_slider.knob.thickness = 16;
			skin.volume_slider.knob.border_width = 2;
			skin.volume_slider.knob.border_radius = 8;

			skin.time_label.font_name = @"";
			skin.time_label.font_size = 14;
			skin.time_label.color = 0xD5D6D6;
			break;
		}
		default:
			// should never happen
			break;
	}
	return skin;
}
