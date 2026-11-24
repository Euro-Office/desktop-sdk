/*
 * SPDX-FileCopyrightText: 2026 Euro-Office contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

#include "qmediaposter.h"

#include <QtGlobal>

#if !defined(USE_VLC_LIBRARY) && QT_VERSION >= QT_VERSION_CHECK(6, 0, 0)

#include <QImage>
#include <QMediaPlayer>
#include <QSaveFile>
#include <QTimer>
#include <QUrl>
#include <QVideoFrame>
#include <QVideoSink>

namespace
{
	// give up when the video cannot be opened or played in this time
	const int c_nTimeoutMs = 10000;
	// look for a frame that is not black within the first seconds / frames
	const qint64 c_nSearchUs = 3000000;
	const int c_nSearchFrames = 120;
	// average gray level (0..255) below which a frame counts as black
	const int c_nDarkLevel = 24;
	// larger frames are scaled down for the poster
	const int c_nMaxSide = 1920;

	int averageGray(const QImage& image)
	{
		const int nSteps = 32;
		int nW = image.width();
		int nH = image.height();
		qint64 nSum = 0;
		int nCount = 0;
		for (int j = 0; j < nSteps; ++j)
		{
			int y = (int)(((qint64)(2 * j + 1) * nH) / (2 * nSteps));
			for (int i = 0; i < nSteps; ++i)
			{
				int x = (int)(((qint64)(2 * i + 1) * nW) / (2 * nSteps));
				nSum += qGray(image.pixel(x, y));
				++nCount;
			}
		}
		return nCount ? (int)(nSum / nCount) : 0;
	}

	class CPosterGrabber : public QObject
	{
	public:
		CPosterGrabber(const QString& sVideoFile, const QString& sPosterFile, QObject* context, std::function<void(bool)> onDone)
			: QObject(context), m_sPosterFile(sPosterFile), m_fOnDone(std::move(onDone))
		{
			m_pPlayer = new QMediaPlayer(this);
			m_pSink = new QVideoSink(this);
			// no audio output: the video is decoded silently
			m_pPlayer->setVideoSink(m_pSink);

			QObject::connect(m_pSink, &QVideoSink::videoFrameChanged, this, [this](const QVideoFrame& frame) {
				onFrame(frame);
			});
			QObject::connect(m_pPlayer, &QMediaPlayer::mediaStatusChanged, this, [this](QMediaPlayer::MediaStatus status) {
				switch (status)
				{
				case QMediaPlayer::LoadedMedia:
					if (m_pPlayer->hasVideo())
						m_pPlayer->play();
					else
						finish();
					break;
				case QMediaPlayer::EndOfMedia:
				case QMediaPlayer::InvalidMedia:
					finish();
					break;
				default:
					break;
				}
			});
			QObject::connect(m_pPlayer, &QMediaPlayer::errorOccurred, this, [this]() {
				finish();
			});

			m_oTimer.setSingleShot(true);
			QObject::connect(&m_oTimer, &QTimer::timeout, this, [this]() {
				finish();
			});
			m_oTimer.start(c_nTimeoutMs);

			m_pPlayer->setSource(QUrl::fromLocalFile(sVideoFile));
		}

	private:
		void onFrame(const QVideoFrame& frame)
		{
			if (m_bFinished || !frame.isValid())
				return;

			QImage image = frame.toImage();
			if (image.isNull())
				return;

			++m_nFrames;
			int nGray = averageGray(image);
			if (nGray > m_nBestGray)
			{
				m_nBestGray = nGray;
				m_oBest = image;
			}

			if (nGray >= c_nDarkLevel || m_nFrames >= c_nSearchFrames || frame.startTime() >= c_nSearchUs)
				finish();
		}

		void finish()
		{
			if (m_bFinished)
				return;
			m_bFinished = true;
			m_oTimer.stop();
			QObject::disconnect(m_pSink, nullptr, this, nullptr);
			QObject::disconnect(m_pPlayer, nullptr, this, nullptr);
			m_pPlayer->stop();

			bool bSaved = false;
			if (!m_oBest.isNull())
			{
				QImage image = m_oBest.convertToFormat(QImage::Format_RGB888);
				if (image.width() > c_nMaxSide || image.height() > c_nMaxSide)
					image = image.scaled(c_nMaxSide, c_nMaxSide, Qt::KeepAspectRatio, Qt::SmoothTransformation);

				// replace the placeholder poster only with a complete file
				QSaveFile oFile(m_sPosterFile);
				if (oFile.open(QIODevice::WriteOnly) && image.save(&oFile, "PNG"))
					bSaved = oFile.commit();
				else
					oFile.cancelWriting();
			}

			if (m_fOnDone)
				m_fOnDone(bSaved);
			deleteLater();
		}

		QMediaPlayer* m_pPlayer = nullptr;
		QVideoSink* m_pSink = nullptr;
		QTimer m_oTimer;
		QString m_sPosterFile;
		std::function<void(bool)> m_fOnDone;
		QImage m_oBest;
		int m_nBestGray = -1;
		int m_nFrames = 0;
		bool m_bFinished = false;
	};
}

void QMediaPoster::Grab(const QString& sVideoFile, const QString& sPosterFile, QObject* context, std::function<void(bool)> onDone)
{
	new CPosterGrabber(sVideoFile, sPosterFile, context, std::move(onDone));
}

#else

void QMediaPoster::Grab(const QString& sVideoFile, const QString& sPosterFile, QObject* context, std::function<void(bool)> onDone)
{
	Q_UNUSED(sVideoFile);
	Q_UNUSED(sPosterFile);
	Q_UNUSED(context);
	if (onDone)
		onDone(false);
}

#endif
