/*
 * SPDX-FileCopyrightText: 2026 Euro-Office contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

#ifndef KEYEVENTCHARACTER_H
#define KEYEVENTCHARACTER_H

class QKeyEvent;

// The character a key event types, for the key events QCefView forwards to CEF
// on Wayland. The text from the keyboard layout comes first: Qt reports a key
// by the upper case of its character, so the Turkish dotless i (U+0131)
// arrives as Qt::Key_I, and deriving the character from the key would type a
// plain 'i'. The text also follows Caps Lock. Only keys without printable
// text, such as Ctrl combinations, fall back to the key.
wchar_t KeyEventCharacter(const QKeyEvent* event);

#endif // KEYEVENTCHARACTER_H
