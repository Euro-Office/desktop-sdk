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

#ifndef QASCPRINTER_H
#define QASCPRINTER_H

#include <QtPrintSupport/QPrinter>
#include <QtPrintSupport/QPrintDialog>
#include <QtPrintSupport/QPrinterInfo>
#include <QPainter>
#include <QPaintEngine>
#include <QPagedPaintDevice>

#include "./../../include/base.h"
#include "./../../include/applicationmanager_events.h"

class DESKTOP_DECL QAscPrinterContext : public NSEditorApi::CAscPrinterContextBase
{
private:
	QPrinter m_oPrinter;
	QPainter m_oPainter;
	bool m_bIsUsePainter;

public:
	QAscPrinterContext(QPrinter::PrinterMode eMode = QPrinter::HighResolution);
	QAscPrinterContext(const QPrinterInfo& pi, QPrinter::PrinterMode eMode = QPrinter::HighResolution);
	virtual ~QAscPrinterContext();

	bool BeginPaint();
	void EndPaint();

	QPrinter* getPrinter();
	QPainter* GetPainter();

	virtual void GetLogicalDPI(int& nDpiX, int& nDpiY);

	virtual void GetPhysicalRect(int& nX, int& nY, int& nW, int& nH);

	virtual void GetPrintAreaSize(int& nW, int& nH);

	virtual void BitBlt(unsigned char* pBGRA, const int& nRasterX, const int& nRasterY, const int& nRasterW, const int& nRasterH,
						const double& x, const double& y, const double& w, const double& h, const double& dAngle);

	virtual void* GetNativeRenderer();
	virtual void* GetNativeRendererUnsupportChecker();
	virtual void NewPage();

	virtual void InitRenderer(void* pRenderer, void* pFontManager);

	virtual void PrepareBitBlt(void* pRenderer, const int& nRasterX, const int& nRasterY, const int& nRasterW, const int& nRasterH,
							   const double& x, const double& y, const double& w, const double& h, const double& dAngle,
							   const double& tileScaleX, const double& tileScaleY);

	virtual void SetPageOrientation(int nOrientaion);

	virtual void SaveState();
	virtual void RestoreState();

private:
	void DrawImage(QPainter* painter, const QImage& image, const QRect& rect, const QRect& rectSrc);
	void setDefaults();

public:
	// not desktop commons
	QAscPrinterContext(QPaintDevice* pDevice);
	QAscPrinterContext(QPagedPaintDevice* pDevice);

	enum PrintDeviceType
	{
		pdtNone,
		pdtSimple,
		pdtPaged
	};

private:
	QPaintDevice* m_pDevice;
	PrintDeviceType m_eDeviceType;
};

#endif  // QASCPRINTER_H
