/*
 * SPDX-FileCopyrightText: 2026 Euro-Office contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

#include "gtest/gtest.h"

#include "cefframefit.h"

TEST(CefFrameFitsWidget, ExactSizeFits)
{
	EXPECT_TRUE(CefFrameFitsWidget(800, 600, 800, 600, 1.0));
	EXPECT_TRUE(CefFrameFitsWidget(1600, 1200, 800, 600, 2.0));
}

TEST(CefFrameFitsWidget, FractionalScaleRoundingFits)
{
	// 1001 * 1.25 = 1251.25, CEF renders (int)1251.25 = 1251 pixels
	EXPECT_TRUE(CefFrameFitsWidget(1251, 751, 1001, 601, 1.25));
	// 333 * 1.5 = 499.5
	EXPECT_TRUE(CefFrameFitsWidget(499, 499, 333, 333, 1.5));
}

TEST(CefFrameFitsWidget, StaleFrameDuringResizeDoesNotFit)
{
	// growing: frame still has the old, smaller size
	EXPECT_FALSE(CefFrameFitsWidget(800, 600, 810, 600, 1.0));
	EXPECT_FALSE(CefFrameFitsWidget(800, 600, 800, 602, 1.0));
	// shrinking: frame still has the old, larger size
	EXPECT_FALSE(CefFrameFitsWidget(1600, 1200, 790, 600, 2.0));
}

TEST(CefFrameFitsWidget, LogicalSizedFrameAtHighDpiDoesNotFit)
{
	EXPECT_FALSE(CefFrameFitsWidget(800, 600, 800, 600, 2.0));
}
