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

#include "qtimelabel.h"

#include <cmath>
#include <QFontMetrics>
#include <QtGlobal>

#include "../qwidgetutils.h"

QTimeLabel::QTimeLabel(QWidget* parent) : QLabel(parent)
{
	double dpi = QWidgetUtils::GetDPI(parent);
	QWidgetUtils::SetDPI(this, dpi);
	m_dDpi = dpi;

	setAlignment(Qt::AlignHCenter | Qt::AlignVCenter);
}

QTimeLabel::~QTimeLabel()
{
}

void QTimeLabel::setTime(qint64 time)
{
	qint64 nH = (qint64)(time / 3600000);
	time -= (nH * 3600000);
	qint64 nM = (qint64)(time / 60000);
	time -= (nM * 60000);
	qint64 nS = (qint64)(time / 1000);

	QString sTime = "";
	if (nH < 10)
		sTime += "0";
	sTime += QString::number((uint)nH);
	sTime += ":";
	if (nM < 10)
		sTime += "0";
	sTime += QString::number((uint)nM);
	sTime += ":";
	if (nS < 10)
		sTime += "0";
	sTime += QString::number((uint)nS);

	setText(sTime);
}

int QTimeLabel::getMaxWidth()
{
	return m_nMaxWidth;
}

void QTimeLabel::updateStyle()
{
	QFont font = m_oStyleOpt.m_oFont;
	int nPixelSize = 0;

	if (font.pointSize() > 0)
	{
		nPixelSize = QWidgetUtils::ScaleDPI(font.pointSize(), m_dDpi);
	}
	else
	{
		nPixelSize = QWidgetUtils::ScaleDPI(font.pixelSize(), m_dDpi);
	}

	font.setPixelSize(nPixelSize);
	setFont(font);

	QString sStyle = "QLabel { color: " + m_oStyleOpt.m_sColor + "; }";
	setStyleSheet(sStyle);

	// update label's max width
	QFontMetrics fontMetrics(font);
#if QT_VERSION >= QT_VERSION_CHECK(5, 11, 0)
	m_nMaxWidth = fontMetrics.horizontalAdvance("00:00:00");
#else
	m_nMaxWidth = fontMetrics.width("00:00:00");
#endif
}

void QTimeLabel::setStyleOptions(const CTimeLabelOptions& opt)
{
	m_oStyleOpt = opt;
	updateStyle();
}

void QTimeLabel::resizeEvent(QResizeEvent* e)
{
	QLabel::resizeEvent(e);

	double dDpi = QWidgetUtils::GetDPI(this);
	if (std::abs(dDpi - m_dDpi) > 0.01)
	{
		m_dDpi = dDpi;
		updateStyle();
	}
}
