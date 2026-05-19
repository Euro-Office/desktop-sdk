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

#include "qiconpushbutton.h"

#include <cmath>
#include <QFileInfo>

#include "../qwidgetutils.h"

QIconPushButton::QIconPushButton(QWidget *parent, bool bIsSvgSupport, QString sIconR, QString sIconH, QString sIconP) : QPushButton(parent)
{
	double dpi = QWidgetUtils::GetDPI(parent);
	QWidgetUtils::SetDPI(this, dpi);
	m_dDpi = dpi;

	m_bIsSvgSupport = bIsSvgSupport;

	// set default style options
	m_oStyleOpt.m_sSkinPostfix = "";
	m_oStyleOpt.m_sBgColorR = "transparent";
	m_oStyleOpt.m_sBgColorH = "transparent";
	m_oStyleOpt.m_sBgColorP = "transparent";

	setIcons(sIconR, sIconH, sIconP);
}

QIconPushButton::~QIconPushButton()
{
}

void QIconPushButton::setIcons(QString sIconR, QString sIconH, QString sIconP)
{
	m_sIconR = sIconR;
	m_sIconH = sIconH.isEmpty() ? m_sIconR : sIconH;
	m_sIconP = sIconP.isEmpty() ? m_sIconH : sIconP;

	updateStyle();
}

void QIconPushButton::updateStyle()
{
	QString sPostfix = getIconPostfix();

	auto borderImageStr = [this, sPostfix](const QString& sIcon) {
		if (m_bIsUseSVG)
			return QString("border: none;");
		return "border-image: url(:/icons/" + sIcon + sPostfix + ") 0 0 0 0 stretch stretch;";
	};

	QString sRadius = QString::number(QWidgetUtils::ScaleDPI(this, m_oStyleOpt.m_nBorderRadius));
	QString sStyle = "QPushButton         {" + borderImageStr(m_sIconR) + " background-color: " + m_oStyleOpt.m_sBgColorR + ";margin:0;padding:0;outline:none; border-radius: " + sRadius + "px;}";
	sStyle +=        "QPushButton:hover   {" + borderImageStr(m_sIconH) + " background-color: " + m_oStyleOpt.m_sBgColorH + ";margin:0;padding:0;outline:none;}";
	sStyle +=        "QPushButton:pressed {" + borderImageStr(m_sIconP) + " background-color: " + m_oStyleOpt.m_sBgColorP + ";margin:0;padding:0;outline:none;}";

	if (m_bIsUseSVG)
	{
		QString sIcon = ":/icons/" + m_sIconR + sPostfix;
		QFileInfo iconFile(sIcon);
		if (iconFile.exists())
			setIconSVG(sIcon);
	}

	setStyleSheet(sStyle);
}

void QIconPushButton::setStyleOptions(const CButtonStyleOptions& opt)
{
	m_oStyleOpt = opt;
	updateStyle();
}

void QIconPushButton::resizeEvent(QResizeEvent* e)
{
	QPushButton::resizeEvent(e);

	m_dDpi = QWidgetUtils::GetDPI(this);
	updateStyle();
}

bool QIconPushButton::event(QEvent* e)
{
	if (!m_bIsUseSVG)
		return QPushButton::event(e);

	QPushButton::event(e);
	if (e->type() == QEvent::Enter)
	{
		setIconSVG(":/icons/" + m_sIconH + m_oStyleOpt.m_sSkinPostfix + ".svg");
	}
	if (e->type() == QEvent::Leave)
	{
		setIconSVG(":/icons/" + m_sIconR + m_oStyleOpt.m_sSkinPostfix + ".svg");
	}
	return true;
}

QString QIconPushButton::getIconPostfix()
{
	QString sPostfix = m_oStyleOpt.m_sSkinPostfix;
	// - If scale is fractional, use SVG icon if allowed, or use 2x PNG icon otherwise.
	// - If scale is integer, use corresponding PNG icon (1x or 2x).

	m_bIsUseSVG = false;
	if (std::abs(1.0 - m_dDpi) < 0.05)
	{
		sPostfix += ".png";
	}
	else if (std::abs(2.0 - m_dDpi) < 0.05)
	{
		sPostfix += "-2x.png";
	}
	else
	{
		if (m_bIsSvgSupport)
		{
			m_bIsUseSVG = true;
			sPostfix += ".svg";
		}
		else
		{
			sPostfix += "-2x.png";
		}
	}

	return sPostfix;
}

void QIconPushButton::setIconSVG(const QString& sUrl)
{
	if (!m_bIsUseSVG)
		return;

	QIcon icon;
	QSize iconSize = size();
	icon.addFile(sUrl, iconSize);
	setIcon(icon);
	setIconSize(iconSize);
}
