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

#include "./../include/qprintercontext.h"

NSQRenderer::CQPrinterContext::CQPrinterContext(QPaintDevice *pDevice)
    : m_eMode{mode::simple}
    , m_pSimpleDevice{pDevice}
{
    if (m_pSimpleDevice) {
        m_bPainterActive = m_oPainter.begin(m_pSimpleDevice);
    }
}

NSQRenderer::CQPrinterContext::CQPrinterContext(QPagedPaintDevice *pDevice)
    : m_eMode{mode::paged}
    , m_pPagedDevice{pDevice}
{
    if (m_pPagedDevice) {
        m_bPainterActive = m_oPainter.begin(m_pPagedDevice);
    }
}

NSQRenderer::CQPrinterContext::~CQPrinterContext()
{
    if (m_bPainterActive) {
        m_oPainter.end();
    }
}

bool NSQRenderer::CQPrinterContext::newPage()
{
    switch (m_eMode) {
    case mode::paged:
    {
        if (m_pPagedDevice && m_pPagedDevice->newPage()) {
            return true;
        } else {
            return false;
        }
    }
    case mode::simple: return false;
    } // switch (m_eMode)
}

int NSQRenderer::CQPrinterContext::dpiX() const
{
    switch (m_eMode) {
    case mode::paged:
    {
        if (m_pPagedDevice) {
            return m_pPagedDevice->logicalDpiX();
        } else {
            return 0;
        }
    }
    case mode::simple:
    {
        if (m_pSimpleDevice) {
            return m_pSimpleDevice->logicalDpiX();
        } else {
            return 0;
        }
    }
    } // switch (m_eMode)
}

int NSQRenderer::CQPrinterContext::dpiY() const
{
    switch (m_eMode) {
    case mode::paged:
    {
        if (m_pPagedDevice) {
            return m_pPagedDevice->logicalDpiY();
        } else {
            return 0;
        }
    }
    case mode::simple:
    {
        if (m_pSimpleDevice) {
            return m_pSimpleDevice->logicalDpiY();
        } else {
            return 0;
        }
    }
    } // switch (m_eMode)
}

QSizeF NSQRenderer::CQPrinterContext::paperSize() const
{
    switch (m_eMode) {
    case mode::paged:
    {
        if (!m_pPagedDevice) {
            return {};
        }
        QRectF pageRect = m_pPagedDevice->pageLayout()
                .fullRect(QPageLayout::Unit::Millimeter);
        QMarginsF pageMargins = m_pPagedDevice->pageLayout()
                .margins(QPageLayout::Unit::Millimeter);
        return {
            pageMargins.left() + pageRect.width() + pageMargins.right()
          , pageMargins.bottom() + pageRect.height() + pageRect.top()
        };
    }
    case mode::simple:
    {
        if (!m_pSimpleDevice) {
            return {};
        }
        return {(qreal)m_pSimpleDevice->widthMM()
                    , (qreal)m_pSimpleDevice->heightMM()};
    }
    } // switch (m_eMode)
}

QPainter& NSQRenderer::CQPrinterContext::painter()
{
    return m_oPainter;
}

void NSQRenderer::CQPrinterContext::endPainting()
{
    m_oPainter.end();
    m_bPainterActive = false;
}
