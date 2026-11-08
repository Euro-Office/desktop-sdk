/*
 * SPDX-FileCopyrightText: 2026 Euro-Office contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

#include <gtest/gtest.h>
#include <QGuiApplication>
#include <QKeyEvent>
#include "../qt_wrapper/src/keyeventcharacter.h"

// The character typed by the key events QCefView forwards to CEF on Wayland
// (qt_wrapper/src/keyeventcharacter.cpp). The events are built the way Qt
// reports them: the key is the upper case of the character, the text is what
// the keyboard layout produced.

namespace {

wchar_t typed(int key, Qt::KeyboardModifiers modifiers, const QString& text)
{
	QKeyEvent event(QEvent::KeyPress, key, modifiers, text);
	return KeyEventCharacter(&event);
}

} // namespace

// Euro-Office/DesktopEditors#285: the dotless i key on a Turkish layout.
TEST(KeyEventCharacter, TurkishDotlessI)
{
	EXPECT_EQ(typed(Qt::Key_I, Qt::NoModifier, QString(QChar(0x0131))), wchar_t(0x0131));
	EXPECT_EQ(typed(Qt::Key_I, Qt::ShiftModifier, "I"), L'I');
}

TEST(KeyEventCharacter, TurkishDottedCapitalI)
{
	EXPECT_EQ(typed(0x0130, Qt::ShiftModifier, QString(QChar(0x0130))), wchar_t(0x0130));
}

TEST(KeyEventCharacter, LatinLetters)
{
	EXPECT_EQ(typed(Qt::Key_A, Qt::NoModifier, "a"), L'a');
	EXPECT_EQ(typed(Qt::Key_A, Qt::ShiftModifier, "A"), L'A');
}

TEST(KeyEventCharacter, FollowsCapsLock)
{
	EXPECT_EQ(typed(Qt::Key_A, Qt::NoModifier, "A"), L'A');
	EXPECT_EQ(typed(Qt::Key_A, Qt::ShiftModifier, "a"), L'a');
}

TEST(KeyEventCharacter, NonLatinLayout)
{
	// Cyrillic ж, reported by its upper case Ж
	EXPECT_EQ(typed(0x0416, Qt::NoModifier, QString(QChar(0x0436))), wchar_t(0x0436));
}

TEST(KeyEventCharacter, AltGrSymbol)
{
	EXPECT_EQ(typed(Qt::Key_At, Qt::GroupSwitchModifier, "@"), L'@');
}

// Ctrl combinations carry a control character or no text at all, so the
// character comes from the key.
TEST(KeyEventCharacter, ControlFallsBackToKey)
{
	EXPECT_EQ(typed(Qt::Key_C, Qt::ControlModifier, QString(QChar(0x03))), L'c');
	EXPECT_EQ(typed(Qt::Key_C, Qt::ControlModifier, QString()), L'c');
	EXPECT_EQ(typed(Qt::Key_C, Qt::ControlModifier | Qt::ShiftModifier, QString()), L'C');
	EXPECT_EQ(typed(Qt::Key_5, Qt::ControlModifier, QString()), L'5');
}

TEST(KeyEventCharacter, SpecialKeys)
{
	EXPECT_EQ(typed(Qt::Key_Return, Qt::NoModifier, "\r"), L'\r');
	EXPECT_EQ(typed(Qt::Key_Enter, Qt::NoModifier, QString()), L'\r');
	EXPECT_EQ(typed(Qt::Key_Space, Qt::NoModifier, " "), L' ');
	EXPECT_EQ(typed(Qt::Key_Backspace, Qt::NoModifier, "\b"), L'\b');
	EXPECT_EQ(typed(Qt::Key_Escape, Qt::NoModifier, QString()), wchar_t(0));
}

// Qt 6 key events look up the primary keyboard device, which needs a
// QGuiApplication; the offscreen platform keeps it headless in CI.
int main(int argc, char** argv)
{
	::testing::InitGoogleTest(&argc, argv);

	if (qEnvironmentVariableIsEmpty("QT_QPA_PLATFORM"))
		qputenv("QT_QPA_PLATFORM", "offscreen");

	QGuiApplication app(argc, argv);
	return RUN_ALL_TESTS();
}
