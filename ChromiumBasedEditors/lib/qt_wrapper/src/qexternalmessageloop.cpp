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

#include "./../include/qexternalmessageloop.h"

QExternalMessageLoop::QExternalMessageLoop(CAscApplicationManager* manager)
{
	m_manager = manager;
	m_timer.setSingleShot(true);
	// IMPORTANT: Use DirectConnection, not QueuedConnection.
	// On Wayland, QueuedConnection defers the slot until the next event loop
	// iteration, which blocks on wl_display_dispatch() waiting for compositor
	// events (mouse/key input). This stalls CEF's entire message pump,
	// preventing rendering and input processing until user interaction.
	// DirectConnection is safe here since sender and receiver are on the
	// same thread (Qt main thread).
	QObject::connect(&m_timer, SIGNAL(timeout()), this, SLOT(slot_onTimeout()), Qt::DirectConnection);
	QObject::connect(this, SIGNAL(onExecuteCommand(void*)), this, SLOT(slot_onExecuteCommand(void*)), Qt::DirectConnection);
}
QExternalMessageLoop::~QExternalMessageLoop()
{
	m_timer.stop();
}

void QExternalMessageLoop::Run()
{
	QApplication::instance()->exec();
}
void QExternalMessageLoop::Execute(void* message)
{
	emit onExecuteCommand(message);
}
void QExternalMessageLoop::SetTimer(long delay)
{
	m_timer.start((int)delay);
}
void QExternalMessageLoop::KillTimer()
{
	m_timer.stop();
}
void QExternalMessageLoop::Exit()
{
	QApplication::instance()->quit();
}

void QExternalMessageLoop::slot_onExecuteCommand(void* message)
{
	m_manager->ExternalMessageLoop_OnExecute(message);
}
void QExternalMessageLoop::slot_onTimeout()
{
	m_manager->ExternalMessageLoop_OnTimeout();
}
