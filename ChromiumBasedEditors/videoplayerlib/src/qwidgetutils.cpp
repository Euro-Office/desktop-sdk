/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 *
 * This program is a free software product. You can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License (AGPL)
 * version 3 as published by the Free Software Foundation, together with the
 * additional terms provided in the LICENSE file.
 *
 * This program is distributed WITHOUT ANY WARRANTY; without even the implied
 * warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. For
 * details, see the GNU AGPL at: https://www.gnu.org/licenses/agpl-3.0.html
 *
 * You can contact Ascensio System SIA by email at info@onlyoffice.com
 * or by postal mail at 20A-6 Ernesta Birznieka-Upisha Street, Riga,
 * LV-1050, Latvia, European Union.
 *
 * The interactive user interfaces in modified versions of the Program
 * are required to display Appropriate Legal Notices in accordance with
 * Section 5 of the GNU AGPL version 3.
 *
 * No trademark rights are granted under this License.
 *
 * All non-code elements of the Product, including illustrations,
 * icon sets, and technical writing content, are licensed under the
 * Creative Commons Attribution-ShareAlike 4.0 International License:
 * https://creativecommons.org/licenses/by-sa/4.0/legalcode
 *
 * This license applies only to such non-code elements and does not
 * modify or replace the licensing terms applicable to the Program's
 * source code, which remains licensed under the GNU Affero General
 * Public License v3.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

#include "../qwidgetutils.h"

#include <QColor>
#include <QPalette>

// for masking widget
// TODO: remove
#include <QPainter>
#include <QPixmap>
#include <QBitmap>

namespace QWidgetUtils
{
	void SetProperty(QObject* widget, const char* property, const QVariant& value)
	{
		// set property for the widget
		widget->setProperty(property, value);
		// and for all of its children
		QObjectList childs = widget->children();
		for (int i = childs.count() - 1; i >= 0; i--)
		{
			SetProperty(childs.at(i), property, value);
		}
	}

	void SetDPI(QWidget* widget, const double& dpi)
	{
		QVariant dpiValue(dpi);
		SetProperty(widget, "native_dpi", dpiValue);
	}

	double GetDPI(QWidget* widget)
	{
		QVariant dpiValue = widget->property("native_dpi");
		if (dpiValue.isValid())
			return dpiValue.toDouble();
		return 1.0;
	}

	int ScaleDPI(const int& value, const double& scale)
	{
		return (int)(value * scale + 0.001);
	}

	int ScaleDPI(QWidget* widget, const int& value)
	{
		return ScaleDPI(value, GetDPI(widget));
	}

	void SetBackground(QWidget* widget, const QColor& color)
	{
		// set stylesheet
		QString sBackColor = "background-color: " + color.name() + ";";
		widget->setStyleSheet(sBackColor);
		// set palette
		// QPalette pal;
		// pal.setColor(QPalette::Window, color);
		// widget->setAutoFillBackground(true);
		// widget->setPalette(pal);
	}

	void SetRoundedRectMask(QWidget* widget, int nRadius)
	{
		const int width = widget->width();
		const int height = widget->height();

		QPixmap pixmap(width, height);
		pixmap.fill(QColor(Qt::transparent));
		QPainter painter(&pixmap);
		// mask is a bitmap, so there is no need for antialiasing
		// painter.setRenderHint(QPainter::Antialiasing);
		painter.setPen(Qt::NoPen);
		painter.setBrush(QColor(Qt::white));
		int radius = ScaleDPI(nRadius, GetDPI(widget));
		painter.drawRoundedRect(0, 0, width, height, radius, radius);

		widget->setMask(pixmap.mask());
	}

}
