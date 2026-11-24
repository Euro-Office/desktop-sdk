/*
 * SPDX-FileCopyrightText: 2026 Euro-Office contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

#include "imecomposition.h"
#include <QInputMethodEvent>

ImeCompositionUpdate ImeCompositionUpdateFor(const QInputMethodEvent& event, bool composing)
{
	ImeCompositionUpdate update;

	const QString commit = event.commitString();
	const QString preedit = event.preeditString();

	if (composing) {
		if (!commit.isEmpty())
			update.committedText = commit;
		else if (preedit.isEmpty())
			update.cancel = true;
	} else {
		update.typedText = commit;
	}

	if (!preedit.isEmpty()) {
		update.compose = true;
		update.compositionText = preedit;
		update.cursor = preedit.length();
		for (const QInputMethodEvent::Attribute& attribute : event.attributes()) {
			if (attribute.type == QInputMethodEvent::Cursor)
				update.cursor = qBound(0, attribute.start, int(preedit.length()));
		}
	}

	update.composing = update.compose;
	return update;
}
