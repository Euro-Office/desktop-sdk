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

#import "timelabel.h"

#import "utils.h"

@interface NSTimeLabel ()
{
	CTimeLabelStyle* m_style;
	NSDictionary* m_attributes;
	NSSize m_bounding_box_size;
}
- (void)setText:(NSString*)text;
@end

@implementation NSTimeLabel

- (instancetype)initWithStyle:(CTimeLabelStyle*)style {
	self = [super init];
	if (self) {
		[self setWantsLayer:YES];
		// apply skin
		m_style = style;
		[self updateStyle];
		// set initial time
		[self setText:@"00:00:00"];
		// set text properties
		[self setEditable:NO];
		[self setBezeled:NO];
		[self setSelectable:NO];
		[self setDrawsBackground:NO];
		[self setBordered:NO];
	}
	return self;
}

- (void)setText:(NSString*)text {
	NSAttributedString* attr_string = [[NSAttributedString alloc] initWithString:NSLocalizedString(text, nil) attributes:m_attributes];
	[self setAttributedStringValue:attr_string];
#if !__has_feature(objc_arc)
	[attr_string release];
#endif
}

- (void)updateStyle {
	// get font
	CGFloat font_size = m_style->font_size;
	NSFont* font = nil;
	if (m_style->font_name.length == 0) {
		font = [NSFont systemFontOfSize:font_size];
	} else {
		font = [NSFont fontWithName:m_style->font_name size:font_size];
		if (!font) {
			font = [NSFont systemFontOfSize:font_size];
		}
	}
	// get color
	NSColor* color = NSColorFromHex(m_style->color);
	// update attributes
#if !__has_feature(objc_arc)
	[m_attributes release];
#endif
	m_attributes = [@{
		NSFontAttributeName: font,
		NSForegroundColorAttributeName: color
	} retain];
	// update text bounding box size
	m_bounding_box_size = [@"00:00:00" sizeWithAttributes:m_attributes];
	m_bounding_box_size.width += 2;		// add extra couple of pixels just in case
	// update current text
	[self setText:self.stringValue];
}

- (void)setTime:(double)time_sec {
	// calculate hours
	unsigned hours = (unsigned)(time_sec / 3600);
	time_sec -= hours * 3600;
	// calculate minutes
	unsigned minutes = (unsigned)(time_sec / 60);
	time_sec -= (minutes * 60);
	// calculate seconds
	unsigned seconds = (unsigned)(time_sec);
	// set label text
	NSString* time_str = [NSString stringWithFormat:@"%02u:%02u:%02u", hours, minutes, seconds];
	[self setText:time_str];
}

- (NSSize)getBoundingBoxSize {
	return m_bounding_box_size;
}

- (void)dealloc {
#if !__has_feature(objc_arc)
	[m_attributes release];
	[super dealloc];
#endif
}

@end
