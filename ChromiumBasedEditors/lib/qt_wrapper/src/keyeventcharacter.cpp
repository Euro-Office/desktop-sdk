/*
 * SPDX-FileCopyrightText: 2026 Euro-Office contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

#include "keyeventcharacter.h"
#include <QKeyEvent>

wchar_t KeyEventCharacter(const QKeyEvent* event)
{
	const QString text = event->text();
	if (!text.isEmpty()) {
		const ushort c = text[0].unicode();
		if (c >= 0x20 && c != 0x7f)
			return static_cast<wchar_t>(c);
	}

	int key = event->key();
	if (key >= Qt::Key_A && key <= Qt::Key_Z)
		return (event->modifiers() & Qt::ShiftModifier) ? key : (key - Qt::Key_A + 'a');
	if (key >= Qt::Key_0 && key <= Qt::Key_9)
		return key;
	if (key == Qt::Key_Space)
		return ' ';
	if (key == Qt::Key_Return || key == Qt::Key_Enter)
		return '\r';
	return text.isEmpty() ? 0 : static_cast<wchar_t>(text[0].unicode());
}
