/*
 * (c) Copyright Ascensio System SIA 2010-2019
 *
 * This program is a free software product. You can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License (AGPL)
 * version 3 as published by the Free Software Foundation. In accordance with
 * Section 7(a) of the GNU AGPL its Section 15 shall be amended to the effect
 * that Ascensio System SIA expressly excludes the warranty of non-infringement
 * of any third-party rights.
 *
 * This program is distributed WITHOUT ANY WARRANTY; without even the implied
 * warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR  PURPOSE. For
 * details, see the GNU AGPL at: http://www.gnu.org/licenses/agpl-3.0.html
 *
 * The  interactive user interfaces in modified source and object code versions
 * of the Program must display Appropriate Legal Notices, as required under
 * Section 5 of the GNU AGPL version 3.
 *
 * All the Product's GUI elements, including illustrations and icon sets, as
 * well as technical writing content are licensed under the terms of the
 * Creative Commons Attribution-ShareAlike 4.0 International. See the License
 * terms at http://creativecommons.org/licenses/by-sa/4.0/legalcode
 *
 */

#ifndef QCEFWEBVIEW_H
#define QCEFWEBVIEW_H

#include <QWindow>
#include <QWidget>
#include <QStyleOption>
#include <QCloseEvent>
#include <QDebug>
#include <QPointer>

#include <QImage>
#include <QGuiApplication>
#include <QScreen>
#include <QTimer>
#include <QMouseEvent>
#include <QWheelEvent>
#include <QKeyEvent>
#include <QAtomicInt>
#include <QList>
#include <QOpenGLWidget>


#include "./../../include/cefview.h"
#include "./../../include/applicationmanager.h"

class QCefViewProps;

// Wayland-only presenter for the CEF off-screen buffer. Rendering through a GL
// surface makes the swap itself the wl_surface_commit, which participates in
// the compositor's frame-callback / vsync loop natively -- so the raster
// backing-store "commit never completes until input" deadlock cannot occur.
// It is a mouse-transparent, non-focusable child that fully overlays its
// QCefView parent; all input continues to be handled by QCefView.
class QCefGLWidget : public QOpenGLWidget
{
	Q_OBJECT
public:
	explicit QCefGLWidget(QWidget* parent);
	// Stage a new frame (deep-copied by the caller) and schedule a GL repaint.
	void SetFrame(const QImage& image);

protected:
	virtual void paintGL() override;

private:
	QImage m_frame;
};

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
	virtual bool focusNextPrevChild(bool next) override;

	// move/resize
	virtual void resizeEvent(QResizeEvent* e);
	virtual void moveEvent(QMoveEvent* e);

	// input events for OSR
	virtual void mousePressEvent(QMouseEvent *event) override;
	virtual void mouseReleaseEvent(QMouseEvent *event) override;
	virtual void mouseDoubleClickEvent(QMouseEvent *event) override;
	virtual void mouseMoveEvent(QMouseEvent *event) override;
	virtual void wheelEvent(QWheelEvent *event) override;
	virtual void keyPressEvent(QKeyEvent *event) override;
	virtual void keyReleaseEvent(QKeyEvent *event) override;
	virtual void inputMethodEvent(QInputMethodEvent *event) override;
	virtual QVariant inputMethodQuery(Qt::InputMethodQuery query) const override;

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

	virtual double GetDeviceScaleFactor() override;
	virtual double GetUIScalePercentage() override;
	virtual bool IsWayland() override;
	virtual void OnPaint(const void* buffer, int width, int height) override;
	virtual void GetWidgetScreenPosition(int& screenX, int& screenY) override;
	virtual void SetClipboardData(const std::wstring& sJson) override;
	virtual std::wstring GetClipboardData() override;
	virtual void SetCursorType(int cursorType) override;
	virtual void SetCursorCustom(const void* buffer, int width, int height, int hotspotX, int hotspotY) override;

	// Wayland: called from the external message loop poller (top of loop,
	// non-reentrant) after CEF is pumped. Repaints any view whose OnPaint
	// staged a new frame and drives the frame-callback handshake so the
	// commit is synchronized to the compositor. Must never be called from
	// inside a CEF callback (e.g. OnPaint).
	static void FlushDirtyWaylandViews();

	// check support z-index
	static bool IsSupportLayers();
	void SetCaptionMaskSize(int);

	virtual bool eventFilter(QObject *watched, QEvent *event);

	bool setFocusToCef();

protected:
	CCefView* m_pCefView;
	QPointer<QWidget> m_pOverride;
	QCefViewProps* m_pProperties;
	
	QImage m_imageBuffer;
	bool m_isWayland;

	// Wayland click-count tracking (mirrors Qt's own multi-click detection,
	// which native OSR input forwarding bypasses). Needed because Qt's
	// Wayland backend delivers an ordinary mousePressEvent for every
	// physical click -- including the second click of a double-click --
	// so the correct click count must be computed here and forwarded to
	// CEF on both press and release; it cannot be inferred from Qt event
	// type alone (see mouseDoubleClickEvent).
	qint64 m_lastClickTimeMs = 0;
	QPoint m_lastClickPos;
	int m_clickCount = 0;

	// Wayland: GL presenter overlaying this view (see QCefGLWidget). null on
	// other platforms and until Init() runs.
	QCefGLWidget* m_pGLView = nullptr;

	// Set by OnPaint when a new frame is staged; cleared by the poller.
	QAtomicInt m_dirty;

	// Registry of live Wayland views, so the message-loop poller can find
	// dirty views to drive the frame-callback handshake. Populated only on
	// Wayland; single-threaded access (main/UI thread).
	static QList<QCefView*> s_waylandViews;

	void Init();

	// Polls for a live desktop display-scale change. Neither moveEvent nor
	// resizeEvent fire on a pure OS-level scale change (confirmed live: no
	// re-injection occurred when the scale was changed in KDE's display
	// settings), so there is no Qt signal this code found to hook directly
	// -- poll devicePixelRatio() instead and only re-inject when it
	// actually changes.
	QTimer* m_pUIScalePollTimer = nullptr;
	double m_dLastKnownUIScalePercentage = -1.0;

Q_SIGNALS:
	void closeWidget(QCloseEvent *);
	void _loaded();
	void _closed();


protected Q_SLOTS:
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
