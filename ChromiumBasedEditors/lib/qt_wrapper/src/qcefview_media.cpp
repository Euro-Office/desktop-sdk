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

#include "./../include/qcefview_media.h"
#include <QTimer>

#include <algorithm>

// uncomment to watch debug info
// #define DEBUG_MEDIA_PLAYER

#ifdef DEBUG_MEDIA_PLAYER
#include <iostream>
#endif

QCefView_Media::QCefView_Media(QWidget* parent, const QSize& size) : QCefView(parent, size)
{
	m_pMediaView = NULL;
	m_bMediaViewWasVisible = false;
	m_bFooterWasVisible = false;
}

QCefView_Media::~QCefView_Media()
{
	OnMediaEnd();
}

#ifdef _LINUX
#if QT_VERSION < QT_VERSION_CHECK(6, 0, 0)
#include <QX11Info>
#endif
QWidget* getMainPanel(QWidget* widget, int& x, int& y)
{
	x = 0; y = 0;
#if QT_VERSION < QT_VERSION_CHECK(6, 0, 0)
	if (!QX11Info::isCompositingManagerRunning())
		return widget;
#endif

	QWidget* cur = widget;
	while (cur->parentWidget() && cur->objectName() != "mainPanel")
	{
		if (cur->objectName() == "ascTabWidget")
		{
			x += cur->x();
			y += cur->y();
		}
		cur = cur->parentWidget();
	}

	// presenter view
	x += widget->x();
	y += widget->y();

	if (cur)
		return cur;

	return widget;
}
#else
QWidget* getMainPanel(QWidget* cur, int& x, int& y)
{
    x = 0; y = 0;
    return cur;
}
#endif

// Media rects arrive in device pixels (CSS px * CCefView::GetDeviceScale()).
// Where Qt's own high-DPI scaling is active (Wayland), widget geometry is in
// logical pixels, so they must be divided by the widget's devicePixelRatio or
// the player is scaled twice and drawn down-right of the placeholder. Where
// Qt scaling is disabled (X11, Windows) the ratio is 1 and nothing changes.
static QRect toLogical(QWidget* widget, int x, int y, int w, int h)
{
	double dScale = widget->devicePixelRatioF();
	if (dScale <= 1.0)
		return QRect(x, y, w, h);
	return QRect((int)(x / dScale + 0.5), (int)(y / dScale + 0.5), (int)(w / dScale + 0.5), (int)(h / dScale + 0.5));
}

void QCefView_Media::OnMediaStart(NSEditorApi::CAscExternalMedia* data)
{
	if (m_pMediaView)
		return;

	// set DPI for this widget BEFORE creating media view; only the part of
	// the device scale that Qt does not already apply itself
	double dQtScale = devicePixelRatioF();
	QWidgetUtils::SetDPI(this, m_pCefView->GetDeviceScale() / (dQtScale > 1.0 ? dQtScale : 1.0));

	m_pMediaView = new QAscVideoView(this, true);
	m_pMediaView->setPlayListUsed(false);
	m_pMediaView->setFullScreenUsed(false);

	// set video view geometry
	QRect oBounds = toLogical(this, data->get_BoundsX(), data->get_BoundsY(), data->get_BoundsW(), data->get_BoundsH());
	int nWidth = oBounds.width();
	m_pMediaView->setGeometry(oBounds);
	// set footer geometry
	QFooterPanel* pFooter = m_pMediaView->Footer();
	int nFooterWidth = std::min(std::max(nWidth, pFooter->GetMinWidth()), pFooter->GetMaxWidth());
	int nFooterX = oBounds.x() + nWidth / 2 - nFooterWidth / 2;
	pFooter->setGeometry(nFooterX, oBounds.y() + oBounds.height() + 12, nFooterWidth, pFooter->GetHeight());
	pFooter->SetRoundedCorners(true);
	// set footer skin and show it explicitly
	pFooter->ApplySkin(CFooterSkin::tDark);
	pFooter->show();

	if (m_pCefView && m_pCefView->IsPresentationReporter())
		m_pMediaView->ToggleMute();

	// for vlc:
#if defined(_WIN32) && defined(USE_VLC_LIBRARY)
	m_pMediaView->show();
#endif

	m_pMediaView->setMedia(QString::fromStdWString(data->get_Url()));
}

void QCefView_Media::OnMediaEnd(bool isFromResize)
{
	if (!m_pMediaView)
		return;

	m_pMediaView->RemoveFromPresentation();
	m_pMediaView = nullptr;

	if (isFromResize)
	{
		// под виндоус проблемы с ресайзом.
		QTimer::singleShot(100, this, [this]() {
			this->resizeEvent(nullptr);
		});
	}
}

void QCefView_Media::OnMediaPlayerCommand(NSEditorApi::CAscExternalMediaPlayerCommand* data)
{
	std::string sCmd = data->get_Cmd();
	// panel and video widget commands
	if (sCmd == "showMediaControl")
	{
		showMediaControl(data);
	}
	else if (sCmd == "hideMediaControl")
	{
		hideMediaControl();
	}
	else if (sCmd == "update")
	{
		updateGeometry(data);
	}
	// player commands
	else
	{
		// handle the possible case when player is not yet initialized
		if (m_pMediaView == nullptr)
		{
#ifdef DEBUG_MEDIA_PLAYER
			std::cerr << "Requested player command \"" << sCmd << "\" on an unitialized player." << std::endl;
#endif
			return;
		}
		// handle player commands
		if (sCmd == "play" || sCmd == "resume")
		{
			m_pMediaView->Play();
		}
		else if (sCmd == "pause")
		{
			m_pMediaView->Pause();
		}
		else if (sCmd == "stop")
		{
			m_pMediaView->Stop();
		}
		else if (sCmd == "togglePause")
		{
			m_pMediaView->TogglePause();
		}
		else
		{
#ifdef DEBUG_MEDIA_PLAYER
			std::cerr << "Media player command \"" << sCmd << "\" can not be handled." << std::endl;
#endif
		}
	}

#ifdef DEBUG_MEDIA_PLAYER
	std::string indent = "";
	std::cout << "MediaPlayerData: {" << std::endl;
	indent = "  ";

	std::cout << indent << "Cmd: " << sCmd << "," << std::endl;

	if (sCmd != "hideMediaControl")
	{
		std::cout << indent << "FrameRect: {" << std::endl;
		indent = "    ";
		std::cout << indent << "X: " << data->get_FrameRectX() << "," << std::endl;
		std::cout << indent << "Y: " << data->get_FrameRectY() << "," << std::endl;
		std::cout << indent << "W: " << data->get_FrameRectW() << "," << std::endl;
		std::cout << indent << "H: " << data->get_FrameRectH() << "," << std::endl;
		indent = "  ";
		std::cout << indent << "}," << std::endl;

		std::cout << indent << "FrameBounds: {" << std::endl;
		indent = "    ";
		std::cout << indent << "X: " << data->get_FrameBoundsX() << "," << std::endl;
		std::cout << indent << "Y: " << data->get_FrameBoundsY() << "," << std::endl;
		std::cout << indent << "W: " << data->get_FrameBoundsW() << "," << std::endl;
		std::cout << indent << "H: " << data->get_FrameBoundsH() << "," << std::endl;
		indent = "  ";
		std::cout << indent << "}," << std::endl;

		std::cout << indent << "ControlRect: {" << std::endl;
		indent = "    ";
		std::cout << indent << "X: " << data->get_ControlRectX() << "," << std::endl;
		std::cout << indent << "Y: " << data->get_ControlRectY() << "," << std::endl;
		std::cout << indent << "W: " << data->get_ControlRectW() << "," << std::endl;
		std::cout << indent << "H: " << data->get_ControlRectH() << "," << std::endl;
		indent = "  ";
		std::cout << indent << "}," << std::endl;

		std::cout << indent << "IsSelected: " << std::boolalpha << data->get_IsSelected() << "," << std::endl;

		std::cout << indent << "Rotation: " << data->get_Rotation() << "," << std::endl;

		std::cout << indent << "FlipH: " << std::boolalpha << data->get_FlipH() << "," << std::endl;
		std::cout << indent << "FlipV: " << std::boolalpha << data->get_FlipV() << "," << std::endl;

		std::wcout << "  MediaFile: \"" << data->get_Url() << "\"," << std::endl;

		std::cout << indent << "Fullscreen: " << std::boolalpha << data->get_Fullscreen() << "," << std::endl;
		std::cout << indent << "IsVideo: " << std::boolalpha << data->get_IsVideo() << "," << std::endl;
		std::cout << indent << "Mute: " << std::boolalpha << data->get_Mute() << "," << std::endl;

		std::cout << indent << "Volume: " << data->get_Volume() << "," << std::endl;

		std::cout << indent << "StartTime: " << data->get_StartTime() << "," << std::endl;
		std::cout << indent << "EndTime: " << data->get_EndTime() << "," << std::endl;
		std::cout << indent << "From: " << data->get_From() << "," << std::endl;

		std::cout << indent << "Theme: " << data->get_Theme() << "," << std::endl;

		indent = "";
	}

	std::cout << "}\n" << std::endl;
#endif
}

void QCefView_Media::showMediaControl(NSEditorApi::CAscExternalMediaPlayerCommand* data)
{
	if (m_pMediaView)
		return;

	// if media is not selected don't do anything
	if (!data->get_IsSelected())
		return;

	// set DPI for this widget BEFORE creating media view (see OnMediaStart)
	double dQtScale = devicePixelRatioF();
	QWidgetUtils::SetDPI(this, m_pCefView->GetDeviceScale() / (dQtScale > 1.0 ? dQtScale : 1.0));

	int xOffset = 0, yOffset = 0;
	m_pMediaView = new QAscVideoView(getMainPanel(this, xOffset, yOffset), true);

	// NOTE: uncomment if you want to handle key events from media player
	// QObject::connect(m_pMediaView, SIGNAL(onKeyDown(int,Qt::KeyboardModifiers)),
	// 				 this, SLOT(onMediaKeyDown(int,Qt::KeyboardModifiers)));

	m_pMediaView->setPlayListUsed(false);
	m_pMediaView->setFullScreenUsed(false);

	setMediaGeometry(data, xOffset, yOffset);

	QFooterPanel* pFooter = m_pMediaView->Footer();

	// show before skin! (problem in fullscreen mode)
	pFooter->show();
	std::string sTheme = data->get_Theme();
	if (sTheme == "dark")
		pFooter->ApplySkin(CFooterSkin::tDark);
	else
		pFooter->ApplySkin(CFooterSkin::tLight);
	pFooter->SetRoundedCorners();

	m_pMediaView->setMedia(QString::fromStdWString(data->get_Url()), false);

	int nVolume = data->get_Volume();
	if (data->get_Mute() || m_pCefView->IsPresentationReporter())
	{
		m_pMediaView->ToggleMute();
	}
	else if (nVolume != -1)
	{
		m_pMediaView->ChangeVolume(nVolume);
	}
}

void QCefView_Media::hideMediaControl()
{
	if (!m_pMediaView)
		return;

	m_pMediaView->RemoveFromPresentation();
	m_pMediaView = nullptr;
}

void QCefView_Media::updateGeometry(NSEditorApi::CAscExternalMediaPlayerCommand* data)
{
	if (!m_pMediaView)
		return;

	int xOffset = 0, yOffset = 0;
	getMainPanel(this, xOffset, yOffset);
	setMediaGeometry(data, xOffset, yOffset);
}

void QCefView_Media::setMediaGeometry(NSEditorApi::CAscExternalMediaPlayerCommand* data, int xOffset, int yOffset)
{
	// the offsets come from Qt widget positions and are logical already
	QRect oFrame = toLogical(this, data->get_FrameBoundsX(), data->get_FrameBoundsY(), data->get_FrameBoundsW(), data->get_FrameBoundsH());
	m_pMediaView->setGeometry(oFrame.translated(xOffset, yOffset));

	QRect oControl = toLogical(this, data->get_ControlRectX(), data->get_ControlRectY(), data->get_ControlRectW(), data->get_ControlRectH());
	QFooterPanel* pFooter = m_pMediaView->Footer();
	pFooter->setGeometry(xOffset + oControl.x(), yOffset + oControl.y(), oControl.width(), pFooter->GetHeight());
}

// On Linux the player is parented to the main panel (see getMainPanel), not
// to this view, so it would stay on screen when this view's tab is hidden,
// e.g. when switching to the start page. Hide and pause it with the view.
void QCefView_Media::hideEvent(QHideEvent* e)
{
	if (m_pMediaView && m_pMediaView->parentWidget() != this)
	{
		QFooterPanel* pFooter = m_pMediaView->Footer();
		m_bMediaViewWasVisible = m_pMediaView->isVisible();
		m_bFooterWasVisible = pFooter->isVisible();
		m_pMediaView->Pause();
		m_pMediaView->hide();
		pFooter->hide();
		pFooter->VolumeControls()->hide();
	}
	QCefView::hideEvent(e);
}

void QCefView_Media::showEvent(QShowEvent* e)
{
	QCefView::showEvent(e);
	if (m_pMediaView && m_pMediaView->parentWidget() != this)
	{
		if (m_bMediaViewWasVisible)
			m_pMediaView->show();
		if (m_bFooterWasVisible)
			m_pMediaView->Footer()->show();
		m_bMediaViewWasVisible = false;
		m_bFooterWasVisible = false;
	}
}

void QCefView_Media::onMediaKeyDown(int key, Qt::KeyboardModifiers mods)
{
	// NOTE: here can be handled some key events while media is playing
	// switch (key)
	// {
	// default:
	// 	break;
	// }
}
