#pragma once

#ifndef USE_VLC_LIBRARY

#include <QVideoWidget>
#include <QMediaPlayer>
#include <QtGlobal>
#include "./qascmediaplayer.h"

static QMediaPlayer_State getPlayerState(QMediaPlayer* player)
{
#if QT_VERSION >= QT_VERSION_CHECK(6, 0, 0)
	return player->playbackState();
#else
	return player->state();
#endif
}

static bool isVideoAvailable(QMediaPlayer* player)
{
#if QT_VERSION >= QT_VERSION_CHECK(6, 0, 0)
	return player->videoOutput() != nullptr;
#else
	return player->isVideoAvailable();
#endif
}

#else

namespace QMediaPlayer
{
	enum State
	{
		StoppedState,
		PlayingState,
		PausedState
	};
}

typedef QMediaPlayer::State QMediaPlayer_State;

#endif
