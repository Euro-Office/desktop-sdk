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

#ifndef QASCIMAGEVIEW_H
#define QASCIMAGEVIEW_H

#include <QWidget>
#include <QLabel>

#include <QDir>
#include <QFileInfo>
#include <QResizeEvent>
#include <QDragEnterEvent>
#include <QDropEvent>
#include <QPaintEvent>
#include <QWheelEvent>
#include <QPropertyAnimation>
#include <QtCore/QtGlobal>

#include "src/videoplayerlib_export.h"
#include "src/qmultimedia.h"
#include "qfooterpanel.h"
#include "qwidgetutils.h"

namespace NSBaseVideoLibrary
{
	void Init(QObject* parent);
	VIDEO_LIB_EXPORT void SetVerbosityLevel(int nVerbose);
}

class QAscVideoView_Private;
class VIDEO_LIB_EXPORT QAscVideoView : public QWidget
{
	Q_OBJECT
public:
	explicit QAscVideoView(QWidget *parent, bool bIsPresentationMode = false);
	virtual ~QAscVideoView();

public:
	virtual void resizeEvent(QResizeEvent* e);

	virtual void paintEvent(QPaintEvent *);

	virtual void dragEnterEvent(QDragEnterEvent *event);
	virtual void dropEvent(QDropEvent *event);

	void mousePressEvent(QMouseEvent *event);

	void keyPressEvent(QKeyEvent *event);
	bool eventFilter(QObject *watched, QEvent *event);

	virtual bool getMainWindowFullScreen();
	virtual void setMainWindowFullScreen(bool bIsFullScreen);
	virtual QWidget* getMainWindow();

public:
	void Play();
	void Pause();
	void TogglePause();
	void ChangeVolume(int nValue);
	void ChangeSeek(int nValue);
	void ToggleMute();
	void Fullscreen();
	void TogglePlaylist(double duration = 100);
	void ToggleFooter(double duration = 150);
	void SavePlayListAddons(const QString& sAddon);

	QFooterPanel* Footer();

	void AddFilesToPlaylist(QStringList& files, const bool isStart = false);
	void LoadPlaylist();
	void SavePlaylist();

	void setPlayListUsed(bool isUsed);
	void setFullScreenUsed(bool isUsed);
	void setMedia(QString sMedia, bool isStart = true);

	void Stop();
	void RemoveFromPresentation();

	void UpdatePlayPauseIcon();
	void UpdateFullscreenIcon();

signals:
	void titleChanged(const QString& sTitle);
	void onKeyDown(int key, Qt::KeyboardModifiers mods);

public slots:
	void slotOpenFile(QString sFile, bool isPlay);

	void slotPlayerPosChanged(int nPos);
	void slotPlayerStateChanged(QMediaPlayer_State state);
	void slotVideoAvailableChanged(bool isVideoAvailable);

	void slotFooterAnimationFinished();
	void slotFooterTimerOverflowed();
	void slotCursorTimerOverflowed();

private:
	QPropertyAnimation* m_pAnimationPlaylist;
	QPropertyAnimation* m_pAnimationFooter;

public:
	QAscVideoView_Private* m_pInternal;
};

#endif // QASCIMAGEVIEW_H
