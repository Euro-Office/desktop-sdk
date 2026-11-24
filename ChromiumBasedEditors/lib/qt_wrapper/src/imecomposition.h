/*
 * SPDX-FileCopyrightText: 2026 Euro-Office contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

#ifndef IMECOMPOSITION_H
#define IMECOMPOSITION_H

#include <QString>

class QInputMethodEvent;

// What QCefView sends to CEF for an input method event on Wayland, where it
// forwards input to the off-screen browser itself. Commits come first, then
// the new composition (preedit), as Qt applies them.
struct ImeCompositionUpdate
{
	// Committed with no composition in progress, such as the result of a dead
	// key sequence: typed as key events.
	QString typedText;
	// Committed in place of the composition in progress.
	QString committedText;
	// The composition in progress is removed without committing anything.
	bool cancel = false;

	// Starts or updates the composition with compositionText, the caret at
	// cursor (in UTF-16 code units, as CEF counts them).
	bool compose = false;
	QString compositionText;
	int cursor = 0;

	// Whether a composition is in progress afterwards.
	bool composing = false;
};

ImeCompositionUpdate ImeCompositionUpdateFor(const QInputMethodEvent& event, bool composing);

#endif // IMECOMPOSITION_H
