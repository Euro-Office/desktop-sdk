/*
 * SPDX-FileCopyrightText: 2026 Euro-Office contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

#include <gtest/gtest.h>
#include <QInputMethodEvent>
#include "../qt_wrapper/src/imecomposition.h"

// What QCefView sends to CEF for the input method events Qt delivers on
// Wayland (qt_wrapper/src/imecomposition.cpp).

namespace {

// Qt 6 events can't be copied, so each update is built from a new event.
ImeCompositionUpdate updateFor(bool composing, const QString& preedit, const QString& commit = QString(), int cursor = -1)
{
	QList<QInputMethodEvent::Attribute> attributes;
	if (cursor >= 0)
		attributes << QInputMethodEvent::Attribute(QInputMethodEvent::Cursor, cursor, 1, QVariant());
	QInputMethodEvent event(preedit, attributes);
	if (!commit.isEmpty())
		event.setCommitString(commit);
	return ImeCompositionUpdateFor(event, composing);
}

} // namespace

// Euro-Office/DesktopEditors#334: typing 값 with a Korean input method shows
// ㄱ, 가, 갑 and 값 while it is composed, then commits it.
TEST(ImeComposition, KoreanSyllable)
{
	bool composing = false;
	for (const QString preedit : { QStringLiteral("ㄱ"), QStringLiteral("가"), QStringLiteral("갑"), QStringLiteral("값") }) {
		const ImeCompositionUpdate update = updateFor(composing, preedit);
		EXPECT_TRUE(update.compose);
		EXPECT_EQ(update.compositionText, preedit);
		EXPECT_EQ(update.cursor, 1);
		EXPECT_TRUE(update.typedText.isEmpty());
		EXPECT_TRUE(update.committedText.isEmpty());
		EXPECT_FALSE(update.cancel);
		composing = update.composing;
		EXPECT_TRUE(composing);
	}

	const ImeCompositionUpdate update = updateFor(composing, QString(), QStringLiteral("값"));
	EXPECT_EQ(update.committedText, QStringLiteral("값"));
	EXPECT_TRUE(update.typedText.isEmpty());
	EXPECT_FALSE(update.cancel);
	EXPECT_FALSE(update.compose);
	EXPECT_FALSE(update.composing);
}

// The next syllable takes the last consonant: 갑 is committed and 사 composed.
TEST(ImeComposition, CommitAndComposeNext)
{
	const ImeCompositionUpdate update = updateFor(true, QStringLiteral("사"), QStringLiteral("갑"));
	EXPECT_EQ(update.committedText, QStringLiteral("갑"));
	EXPECT_TRUE(update.compose);
	EXPECT_EQ(update.compositionText, QStringLiteral("사"));
	EXPECT_TRUE(update.composing);
}

// Backspace removes the last jamo of the composition.
TEST(ImeComposition, CompositionRemoved)
{
	const ImeCompositionUpdate update = updateFor(true, QString());
	EXPECT_TRUE(update.cancel);
	EXPECT_TRUE(update.committedText.isEmpty());
	EXPECT_FALSE(update.compose);
	EXPECT_FALSE(update.composing);
}

// Dead key results come without a composition and are typed as before.
TEST(ImeComposition, CommitWithoutComposition)
{
	const ImeCompositionUpdate update = updateFor(false, QString(), QStringLiteral("é"));
	EXPECT_EQ(update.typedText, QStringLiteral("é"));
	EXPECT_TRUE(update.committedText.isEmpty());
	EXPECT_FALSE(update.cancel);
	EXPECT_FALSE(update.compose);
	EXPECT_FALSE(update.composing);
}

TEST(ImeComposition, EmptyEventWithoutComposition)
{
	const ImeCompositionUpdate update = updateFor(false, QString());
	EXPECT_TRUE(update.typedText.isEmpty());
	EXPECT_FALSE(update.cancel);
	EXPECT_FALSE(update.compose);
	EXPECT_FALSE(update.composing);
}

// Japanese and Chinese input methods move the caret inside the composition.
TEST(ImeComposition, CursorInsideComposition)
{
	const QString preedit = QStringLiteral("にほんご");
	EXPECT_EQ(updateFor(false, preedit, QString(), 2).cursor, 2);
	EXPECT_EQ(updateFor(true, preedit, QString(), 0).cursor, 0);
	EXPECT_EQ(updateFor(true, preedit, QString(), 99).cursor, 4);
	EXPECT_EQ(updateFor(true, preedit).cursor, 4);
}
