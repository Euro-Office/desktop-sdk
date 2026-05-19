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

#import "iconpushbutton.h"

#import "utils.h"

@interface NSIconPushButton ()
{
	CButtonStyle* m_style;
	bool m_hovered;
	NSString* m_icon_name;
}
@end

@implementation NSIconPushButton

- (instancetype)initWithIconName:(NSString*)icon_name size:(NSSize)size style:(CButtonStyle*)style {
	NSRect init_frame_rect = NSMakeRect(0, 0, size.width, size.height);
	self = [super initWithFrame:init_frame_rect];
	if (self) {
		[self setWantsLayer:YES];
		// apply skin
		m_style = style;
		m_icon_name = icon_name;
		[self updateStyle];
		// add mouse tracking for background color or/and icon changing
		[self addTrackingRect:init_frame_rect owner:self userData:nil assumeInside:NO];
	}
	return self;
}

- (void)updateStyle {
	self.layer.cornerRadius = m_style->border_radius;
	self.bordered = NO;
	self.layer.backgroundColor = [NSColorFromHex(m_style->bg_color_regular) CGColor];
	[self setIcon:m_icon_name];
}

- (void)setIcon:(NSString*)icon_name {
	m_icon_name = icon_name;
	// TODO: are -2x png icons always suitable on mac platforms ???
	NSString* icon_full_name = [NSString stringWithFormat:@"%@%@%@", icon_name, m_style->icon_postfix, @"-2x"];
	NSString* icon_path = [[NSBundle bundleForClass:[self class]] pathForResource:icon_full_name ofType:@"png"];
	if (icon_path == nil) {
		NSLog(@"Error: could not load icon %@.png", icon_full_name);
		return;
	}
	NSImage* image = [[NSImage alloc] initWithContentsOfFile:icon_path];
	self.image = image;
	self.imageScaling = NSImageScaleProportionallyDown;
#if !__has_feature(objc_arc)
	[image release];
#endif
}

- (void)mouseEntered:(NSEvent*)event {
	m_hovered = true;
	self.layer.backgroundColor = [NSColorFromHex(m_style->bg_color_hovered) CGColor];
}

- (void)mouseExited:(NSEvent*)event {
	m_hovered = false;
	self.layer.backgroundColor = [NSColorFromHex(m_style->bg_color_regular) CGColor];
}

- (void)mouseDown:(NSEvent*)event {
	self.layer.backgroundColor = [NSColorFromHex(m_style->bg_color_pressed) CGColor];
	if (self.target && self.action) {
		[self.target performSelector:self.action withObject:self];
	}
}

- (void)mouseUp:(NSEvent*)event {
	CGColor* bg_color = nil;
	if (m_hovered) {
		bg_color = [NSColorFromHex(m_style->bg_color_hovered) CGColor];
	} else {
		bg_color = [NSColorFromHex(m_style->bg_color_regular) CGColor];
	}
	self.layer.backgroundColor = bg_color;
}

- (void)dealloc {
#if !__has_feature(objc_arc)
	[super dealloc];
#endif
}

@end
