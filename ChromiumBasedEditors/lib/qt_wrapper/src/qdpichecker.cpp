/*
 * (c) Copyright Ascensio System SIA 2010-2019
 *
 * This program is a free software product. You can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License (AGPL)
 * version 3 as published by the Free Software Foundation. In accordance with
 * Section 7(a) of the GNU AGPL its Section 15 shall be amended to the effect
 * that Ascensio System SIA expressly excludes the warranty of non-infringement
 * of any third-party rights.
 *
 * This program is distributed WITHOUT ANY WARRANTY; without even the implied
 * warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR  PURPOSE. For
 * details, see the GNU AGPL at: http://www.gnu.org/licenses/agpl-3.0.html
 *
 * The  interactive user interfaces in modified source and object code versions
 * of the Program must display Appropriate Legal Notices, as required under
 * Section 5 of the GNU AGPL version 3.
 *
 * All the Product's GUI elements, including illustrations and icon sets, as
 * well as technical writing content are licensed under the terms of the
 * Creative Commons Attribution-ShareAlike 4.0 International. See the License
 * terms at http://creativecommons.org/licenses/by-sa/4.0/legalcode
 *
 */

#include "./../include/qdpichecker.h"

#include <QScreen>
#include <QApplication>
#include "./../include/qcefview.h"


#if defined(_LINUX) && !defined(_MAC)
#include <QGuiApplication>
#include <X11/Xlib.h>
#include <cstdlib>

namespace {
// Restores the X11 DPI detection that was lost when the QX11Info private
// header was dropped. QX11Info::appDpiX/Y reflected the desktop's font
// scaling (the Xft.dpi X resource); with AA_Use96Dpi active this is the
// only place the app learns the session's real scale on X11.
// Falls back to the core-protocol DPI from the physical screen size.
int getX11SessionDpi()
{
    static int s_dpi = -2;              // -2 = not queried yet
    if (s_dpi != -2)
        return s_dpi;
    s_dpi = 0;
    if (QGuiApplication::platformName() != QLatin1String("xcb"))
        return s_dpi;                   // inert on Wayland
    if (Display* dpy = XOpenDisplay(NULL)) {
        if (char* v = XGetDefault(dpy, "Xft", "dpi"))
            s_dpi = (int)(atof(v) + 0.5);
        if (s_dpi <= 0) {
            int scr = DefaultScreen(dpy);
            int wmm = DisplayWidthMM(dpy, scr);
            if (wmm > 0)
                s_dpi = (int)(DisplayWidth(dpy, scr) * 25.4 / wmm + 0.5);
        }
        XCloseDisplay(dpy);
    }
    return s_dpi;
}
}
#endif


QDpiChecker::QDpiChecker(CAscApplicationManager* pManager) : CAscDpiChecker(pManager)
{
}

int QDpiChecker::GetWindowDpi(WindowHandleId wid, unsigned int* dx, unsigned int* dy)
{
	double dForceScale = GetForceScale(dx, dy);
	if (dForceScale > 0)
		return 0;
	return CAscDpiChecker::GetWindowDpi(wid, dx, dy);
}

int QDpiChecker::GetMonitorDpi(int nScreenNumber, unsigned int* dx, unsigned int* dy)
{
	double dForceScale = GetForceScale(dx, dy);
	if (dForceScale > 0)
		return 0;

	int nBaseRet = CAscDpiChecker::GetMonitorDpi(nScreenNumber, dx, dy);
	if (-1 != nBaseRet)
		return nBaseRet;

	QScreen * _screen;
	if (nScreenNumber >=  0 && nScreenNumber < QApplication::screens().count())
		_screen = QApplication::screens().at(nScreenNumber);
	else {
		nScreenNumber = 0;
		_screen = QApplication::primaryScreen();
	}

	int nDpiX = _screen->physicalDotsPerInchX();
	int nDpiY = _screen->physicalDotsPerInchY();

#if defined(_LINUX) && !defined(_MAC)
	int _x11_dpi = getX11SessionDpi();
	if (_x11_dpi > 0)
	{
		if (nDpiX < _x11_dpi) nDpiX = _x11_dpi;
		if (nDpiY < _x11_dpi) nDpiY = _x11_dpi;
	}
#endif

	QSize size = _screen->size();
	if (size.width() <= 1600 && size.height() <= 900)
	{
		nDpiX = 96;
		nDpiY = 96;
	}

	if (nDpiX > 150 && nDpiX < 180 && nDpiY > 150 && nDpiY < 180 && size.width() >= 3840 && size.height() >= 2160)
	{
		nDpiX = 192;
		nDpiY = 192;
	}

	*dx = nDpiX;
	*dy = nDpiY;

	return 0;
}

// app realize
int QDpiChecker::GetWidgetImplDpi(CCefViewWidgetImpl* w, unsigned int* dx, unsigned int* dy)
{
	return GetWidgetDpi((QCefView*)w, dx, dy);
}

int QDpiChecker::GetWidgetDpi(QWidget* w, unsigned int* dx, unsigned int* dy)
{
	double dForceScale = GetForceScale(dx, dy);
	if (dForceScale > 0)
		return 0;

	if (0 == QApplication::screens().count())
	{
		*dx = 96;
		*dy = 96;
		return 0;
	}
	int nScreenNumber = QApplication::screens().indexOf(w->screen());
	return GetMonitorDpi(nScreenNumber, dx, dy);
}
