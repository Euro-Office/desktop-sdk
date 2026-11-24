/*
 * SPDX-FileCopyrightText: 2026 Euro-Office contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

#ifndef QMEDIAPOSTER_H
#define QMEDIAPOSTER_H

#include <QObject>
#include <QString>

#include <functional>

// Takes a frame from a video file and saves it as a PNG, used as the poster
// of a video inserted into a presentation. The first frame that is not
// (almost) black within the first seconds wins, else the brightest one seen.
// The image keeps the video's size (only scaled down when it is very large),
// so the editor can insert the video with the right aspect ratio.
namespace QMediaPoster
{
	// Runs asynchronously. onDone(saved) is called exactly once on the GUI
	// thread, unless context is destroyed first. Without Qt Multimedia 6 it
	// is called right away with false.
	void Grab(const QString& sVideoFile, const QString& sPosterFile, QObject* context, std::function<void(bool)> onDone);
}

#endif // QMEDIAPOSTER_H
