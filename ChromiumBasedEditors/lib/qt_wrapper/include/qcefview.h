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

#ifndef QCEFWEBVIEW_H
#define QCEFWEBVIEW_H

#include <QWindow>
#include <QWidget>
#include <QStyleOption>
#include <QCloseEvent>
#include <QDebug>
#include <QPointer>

#include "./../include/cefview.h"
#include "./../include/applicationmanager.h"

class QCefViewProps;
class DESKTOP_DECL QCefView : public QWidget, public CCefViewWidgetImpl
{
	Q_OBJECT

Q_SIGNALS:
	void onDropFiles(QList<QString> files);

public:
	QCefView(QWidget* parent, const QSize& initial_size = QSize());
	virtual ~QCefView();

	// focus
	virtual void focusInEvent(QFocusEvent* e);
	virtual void focusOutEvent(QFocusEvent* e);

	// move/resize
	virtual void resizeEvent(QResizeEvent* e);
	virtual void moveEvent(QMoveEvent* e);

	// drag'n'drop
#if defined (_LINUX) && !defined(_MAC)
	virtual void dragEnterEvent(QDragEnterEvent *e);
	virtual void dragLeaveEvent(QDragLeaveEvent *e);
	virtual void dropEvent(QDropEvent *e);
	NSEditorApi::CAscLocalDragDropData* convertMimeData(const QMimeData *pMimeData);
#endif

	virtual void UpdateSize();

	// After create
	virtual void AfterCreate();

	// close
	virtual void closeEvent(QCloseEvent *e);

	// work with cefview
	CCefView* GetCefView();
	void Create(CAscApplicationManager* pManager, CefViewWrapperType eType);
	void CreateReporter(CAscApplicationManager* pManager, CAscReporterData* data);

	// multimedia
	virtual void OnMediaStart(NSEditorApi::CAscExternalMedia* data);
	virtual void OnMediaEnd(bool isFromResize = false);
	virtual void OnMediaPlayerCommand(NSEditorApi::CAscExternalMediaPlayerCommand* data);

	// events
	virtual void OnLoaded();
	virtual void OnRelease();

	// get natural view
	QWidget* GetViewWidget();

	// background color
	void SetBackgroundCefColor(unsigned char r, unsigned char g, unsigned char b);
	void paintEvent(QPaintEvent *event);

	// check support z-index
	static bool IsSupportLayers();
	void SetCaptionMaskSize(int);

	virtual bool eventFilter(QObject *watched, QEvent *event);

	bool setFocusToCef();

protected:
	CCefView* m_pCefView;
	QPointer<QWidget> m_pOverride;
	QCefViewProps* m_pProperties;

	void Init();

signals:
	void closeWidget(QCloseEvent *);
	void _loaded();
	void _closed();

protected slots:
	void _loadedSlot();
	void _closedSlot();
};

#if defined (_LINUX) && !defined(_MAC)

class DESKTOP_DECL QCefEmbedWindow : public QWindow
{
	Q_OBJECT

private:
	int m_nCaptionSize;

public:
	explicit QCefEmbedWindow(QPointer<QCefView> _qcef_parent, QWindow* _parent = NULL);
	void SetCaptionMaskSize(int);

protected:
	virtual void moveEvent(QMoveEvent*);
	virtual void resizeEvent(QResizeEvent*);
	virtual bool eventFilter(QObject *watched, QEvent *event);

private:
	QPointer<QCefView> qcef_parent;
};

#endif

#endif  // QCEFWEBVIEW_H
