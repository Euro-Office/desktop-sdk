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

#pragma once

#include <QWidget>
#include <QPaintEvent>
#include <QPushButton>
#include <QTableView>
#include <QResizeEvent>
#include <QMap>
#include <QTimer>

#include "../../../../core/DesktopEditor/graphics/BaseThread.h"
#include "../../../../core/DesktopEditor/graphics/TemporaryCS.h"

#include "lib_base.h"
#include "qmultimedia.h"

class CVideoExt
{
private:
	QStringList m_video_exts;
	QStringList m_audio_exts;

public:
	CVideoExt()
	{
		m_video_exts << "webm" << "mkv" << "flv" << "ogg" << "avi" << "mov" << "wmv" << "mp4" <<
						"mpg" << "mpeg" << "mpe" << "mpv" << "m2v" << "m4v" <<
						"3gp" << "3g2" << "f4v" << "m2ts" << "mts";
		m_audio_exts << "flac" << "mp3" << "ogg" << "wav" << "wma" << "ape" << "mp2";
	}

	QSet<QString> getQSet(bool isAddPoint = false)
	{
		QSet<QString> ret;
		for (int i = 0; i < m_video_exts.size(); i++)
		{
			QString tmp = m_video_exts[i];
			if (isAddPoint)
				tmp = ("*." + tmp);
			ret << tmp;
		}
		for (int i = 0; i < m_audio_exts.size(); i++)
		{
			QString tmp = m_audio_exts[i];
			if (isAddPoint)
				tmp = ("*." + tmp);
			ret << tmp;
		}
		return ret;
	}

	QString getFilter()
	{
		QString sRes = "All Video Files (";

		int size = m_video_exts.size();
		for (int i = 0; i < size; i++)
		{
			sRes += "*.";
			sRes += m_video_exts[i];

			if (i != (size - 1))
				sRes += " ";
		}

		sRes += ");;All Audio Files (";

		size = m_audio_exts.size();
		for (int i = 0; i < size; i++)
		{
			sRes += "*.";
			sRes += m_audio_exts[i];

			if (i != (size - 1))
				sRes += " ";
		}

		sRes += ");;All files (*.*)";

		return sRes;
	}
};

class QVideoPlaylist : public QWidget
{
	Q_OBJECT

private:
	double m_dDpi;
	void private_Style(double dDpi);

public:
	explicit QVideoPlaylist(QWidget *parent = 0);
	virtual ~QVideoPlaylist();

	virtual void resizeEvent(QResizeEvent* e);

signals:
	void fileChanged(const QString& file, bool isPlay);

public slots:
	void slotClick(const QModelIndex &index);
	void slotActivated(const QModelIndex &index, bool isPlay = true);

	void slotButtonAdd();
	void slotButtonClear();

#ifdef _MAC
	void slotActivatedShortcut();
#endif
	void slotDeletedShortcut();

public:
	void AddFiles(QStringList& files, const bool isStart = false);
	void Load();
	void Save();

	void Next();
	void Prev();

	void LoadCurrent();

	void CheckStyles();

	bool isScrollBarVisible();

public:
	QPushButton* m_pAdd;
	QPushButton* m_pClear;
	QTableView* m_pListView;

	QString m_sLastFileDialogFolder;

	QString m_sSavePlayListAddon;

	QWidget* m_pDialogParent;

private:
	NSCriticalSection::CRITICAL_SECTION m_oCS;

	QTimer m_oTimer;

#ifndef USE_VLC_LIBRARY
	QMediaPlayer* m_pCheckPlayer;
#else
	CVlcMedia* m_pCheckMedia;
#endif

	QString m_sCheckFile;
	QMap<QString, bool> m_mapChecked;
	QMap<QString, qint64> m_mapDurations;

	void AddFilesToCheck(QStringList& list);
	// returns index of selected item or -1 otherwise
	int GetIndexOfSelectedItem();

signals:
	void _onCheckDuration(const QString& file, const QString& duration);
private slots:

#ifndef USE_VLC_LIBRARY
	void _onSlotError(QMediaPlayer::Error error);
	void _onSlotMediaStatusChanged(QMediaPlayer::MediaStatus status);
	void _onSlotDurationChanged(qint64 duration);
	void _onSlotMediaChanged(QMediaContent content);
#else
	void _onVlcMediaParseChanged(bool isparsed);
#endif
	void _onSlotCheckDuration(const QString& file, const QString& duration);
	void _onThreadFunc();

};
