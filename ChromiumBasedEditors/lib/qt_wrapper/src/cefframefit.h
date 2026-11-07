/*
 * SPDX-FileCopyrightText: 2026 Euro-Office contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

#ifndef CEF_FRAME_FIT_H
#define CEF_FRAME_FIT_H

#include <cmath>

// Whether a CEF off-screen frame of frameWidth x frameHeight physical pixels
// was rendered for a widget of widgetWidth x widgetHeight logical pixels at
// device pixel ratio dpr. CEF sizes the frame as (int)(logical * dpr), so up
// to one pixel of rounding is allowed. A frame that doesn't fit is a stale
// one from before a resize that CEF hasn't caught up with yet.
inline bool CefFrameFitsWidget(int frameWidth, int frameHeight, int widgetWidth, int widgetHeight, double dpr)
{
	return std::fabs(frameWidth - widgetWidth * dpr) <= 1.0
		&& std::fabs(frameHeight - widgetHeight * dpr) <= 1.0;
}

#endif // CEF_FRAME_FIT_H
