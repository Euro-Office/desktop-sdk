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

#include "./../include/qcefview.h"
#include <cstdio>
#include <QPainter>
#include <QApplication>
#include <QAbstractEventDispatcher>
#include <QCloseEvent>
#include <QDebug>
#include <QPointer>
#include <QWindow>
#include <QTimer>
#include <set>
#include <QInputMethodEvent>
#include <QClipboard>
#include <QMimeData>
#include <QJsonDocument>
#include <QJsonObject>
#include <QBuffer>
#include <QDateTime>
#include <QPixmap>
#include <QCursor>

class QCefViewProps
{
public:
	QWindow* m_window;
public:
	QCefViewProps()
	{
		m_window = NULL;
	}
};

QList<QCefView*> QCefView::s_waylandViews;

QCefView::QCefView(QWidget* parent, const QSize& initial_size) : QWidget(parent)
{
	m_pCefView = NULL;
	m_pProperties = NULL;
	m_isWayland = (QGuiApplication::platformName() == "wayland");

	if (!initial_size.isEmpty())
		resize(initial_size);

	QObject::connect(this, SIGNAL( _loaded() ) , this, SLOT( _loadedSlot() ), Qt::QueuedConnection );
	QObject::connect(this, SIGNAL( _closed() ) , this, SLOT( _closedSlot() ), Qt::QueuedConnection );
	if (m_isWayland) {
		s_waylandViews.append(this);
	}

	if (IsSupportLayers())
		this->installEventFilter(this);

	// See m_pUIScalePollTimer's declaration: no Qt/CEF signal was found
	// that fires on a pure OS-level display-scale change, so poll for it.
	// The debounce against transient devicePixelRatio() misreads lives in
	// CCefView::UpdateUIScalePercentage() itself, since that's the single
	// choke point moveEvent()/OnLoadEnd() also call into -- no need to
	// track/compare readings here too.
	m_pUIScalePollTimer = new QTimer(this);
	QObject::connect(m_pUIScalePollTimer, &QTimer::timeout, this, [this]() {
		if (m_pCefView)
			m_pCefView->UpdateUIScalePercentage();
	});
	m_pUIScalePollTimer->start(1000);
}

QCefView::~QCefView()
{
	if (m_isWayland)
		s_waylandViews.removeAll(this);

	// release from CApplicationManager
	if (m_pProperties)
	{
		delete m_pProperties;
		m_pProperties = NULL;
	}
}

bool QCefView::eventFilter(QObject *watched, QEvent *event)
{
	if (this == watched && event->type() == QEvent::Resize)
		OnMediaEnd(true);

	return QWidget::eventFilter(watched, event);
}

bool QCefView::setFocusToCef()
{
	if (!m_pCefView)
		return false;

	if (m_pCefView->IsDestroy())
		return false;

	bool isActivate = false;
#ifdef _WIN32
	HWND hwndForeground = ::GetForegroundWindow();
	HWND hwndQCef = (HWND)this->winId();
	if (::IsChild(hwndForeground, hwndQCef))
		isActivate = true;
#endif

#if defined (_LINUX) && !defined(_MAC)
	// TODO: check foreground window
	isActivate = true;
#endif

	if (isActivate)
		m_pCefView->focus(true);

	//qDebug() << "focus: id = " << m_pCefView->GetId() << ", use = " << isActivate;
	return isActivate;
}

static int GetCefModifiers(Qt::KeyboardModifiers qt_mod, Qt::MouseButtons qt_btn) {
	int modifiers = 0;
	if (qt_mod & Qt::ShiftModifier) modifiers |= 1 << 1;    // EVENTFLAG_SHIFT_DOWN
	if (qt_mod & Qt::ControlModifier) modifiers |= 1 << 2;  // EVENTFLAG_CONTROL_DOWN
	if (qt_mod & Qt::AltModifier) modifiers |= 1 << 3;      // EVENTFLAG_ALT_DOWN
	if (qt_btn & Qt::LeftButton) modifiers |= 1 << 4;       // EVENTFLAG_LEFT_MOUSE_BUTTON
	if (qt_btn & Qt::MiddleButton) modifiers |= 1 << 5;     // EVENTFLAG_MIDDLE_MOUSE_BUTTON
	if (qt_btn & Qt::RightButton) modifiers |= 1 << 6;      // EVENTFLAG_RIGHT_MOUSE_BUTTON
	return modifiers;
}

static int QtKeyToWindowsKeyCode(int key) {
	if (key >= Qt::Key_0 && key <= Qt::Key_9)
		return key; // 0x30 - 0x39
	if (key >= Qt::Key_A && key <= Qt::Key_Z)
		return key; // 0x41 - 0x5a

	switch (key) {
	case Qt::Key_Backspace: return 0x08;
	case Qt::Key_Tab:       return 0x09;
	case Qt::Key_Clear:     return 0x0C;
	case Qt::Key_Return:    return 0x0D;
	case Qt::Key_Enter:     return 0x0D;
	case Qt::Key_Shift:     return 0x10;
	case Qt::Key_Control:   return 0x11;
	case Qt::Key_Alt:       return 0x12;
	case Qt::Key_Pause:     return 0x13;
	case Qt::Key_CapsLock:  return 0x14;
	case Qt::Key_Escape:    return 0x1B;
	case Qt::Key_Space:     return 0x20;
	case Qt::Key_PageUp:    return 0x21;
	case Qt::Key_PageDown:  return 0x22;
	case Qt::Key_End:       return 0x23;
	case Qt::Key_Home:      return 0x24;
	case Qt::Key_Left:      return 0x25;
	case Qt::Key_Up:        return 0x26;
	case Qt::Key_Right:     return 0x27;
	case Qt::Key_Down:      return 0x28;
	case Qt::Key_Select:    return 0x29;
	case Qt::Key_Print:     return 0x2A;
	case Qt::Key_Execute:   return 0x2B;
	case Qt::Key_SysReq:    return 0x2C;
	case Qt::Key_Insert:    return 0x2D;
	case Qt::Key_Delete:    return 0x2E;
	case Qt::Key_Help:      return 0x2F;
	case Qt::Key_NumLock:   return 0x90;
	case Qt::Key_ScrollLock: return 0x91;
	case Qt::Key_Semicolon: return 0xBA;
	case Qt::Key_Equal:     return 0xBB;
	case Qt::Key_Plus:      return 0xBB;
	case Qt::Key_Comma:     return 0xBC;
	case Qt::Key_Minus:     return 0xBD;
	case Qt::Key_Period:    return 0xBE;
	case Qt::Key_Slash:     return 0xBF;
	case Qt::Key_QuoteLeft: return 0xC0;
	case Qt::Key_BracketLeft: return 0xDB;
	case Qt::Key_Backslash: return 0xDC;
	case Qt::Key_BracketRight: return 0xDD;
	case Qt::Key_Apostrophe: return 0xDE;
	default:
		if (key >= Qt::Key_F1 && key <= Qt::Key_F24)
			return 0x70 + (key - Qt::Key_F1);
		break;
	}
	return 0;
}

void QCefView::mousePressEvent(QMouseEvent *event) {
	if (m_isWayland && m_pCefView) {
		int button = 1;
		if (event->button() == Qt::RightButton) button = 2;
		else if (event->button() == Qt::MiddleButton) button = 3;

		// Qt's Wayland backend delivers an ordinary QMouseEvent::MousePress
		// for *every* physical click, including the second click of a
		// double-click -- it does not substitute a MouseButtonDblClick in
		// its place the way some other platforms' Qt backends do (verified
		// via diagnostic logging: a plain mousePressEvent fired for the
		// second click, immediately followed by mouseDoubleClickEvent for
		// the same click). Native OSR input forwarding bypasses Qt's own
		// multi-click detection entirely, so replicate it here: track the
		// time/position of the previous click and increment clickCount
		// when within Qt's double-click interval and a small pixel radius,
		// resetting otherwise. This clickCount is forwarded to CEF/Blink,
		// which trusts it as-is for MouseEvent.detail -- sdkjs's
		// double-click handling depends on that value being correct.
		qint64 now = QDateTime::currentMSecsSinceEpoch();
		QPoint pos = event->pos();
		const int kClickRadius = 6;
		if (event->button() == Qt::LeftButton &&
			m_clickCount > 0 &&
			(now - m_lastClickTimeMs) <= QApplication::doubleClickInterval() &&
			(pos - m_lastClickPos).manhattanLength() <= kClickRadius) {
			m_clickCount = (m_clickCount % 2) + 1; // 1 -> 2, 2 -> 1 (triple click treated as a new single click)
		} else {
			m_clickCount = 1;
		}
		m_lastClickTimeMs = now;
		m_lastClickPos = pos;

		// EXPERIMENTAL (dsf-1.0-osr): CEF's view-rect is now reported in
		// physical pixels (device_scale_factor forced to 1.0), so mouse
		// coordinates sent to CEF must also be physical pixels. Qt delivers
		// DIPs here, so scale up by devicePixelRatio() to match.
		double scale = devicePixelRatio();
		m_pCefView->SendMouseClickEvent((int)(event->x() * scale), (int)(event->y() * scale), button, false, GetCefModifiers(event->modifiers(), event->buttons()), m_clickCount);
	}
	QWidget::mousePressEvent(event);
}

void QCefView::mouseReleaseEvent(QMouseEvent *event) {
	if (m_isWayland && m_pCefView) {
		int button = 1;
		if (event->button() == Qt::RightButton) button = 2;
		else if (event->button() == Qt::MiddleButton) button = 3;
		double scale = devicePixelRatio();
		// Use the same clickCount computed in mousePressEvent so the
		// press/release pair CEF sees for a double-click's second click is
		// (down, clickCount=2)/(up, clickCount=2), matching what Blink
		// expects instead of a mismatched (down, 2)/(up, 1) pair.
		int clickCount = (event->button() == Qt::LeftButton && m_clickCount > 0) ? m_clickCount : 1;
		m_pCefView->SendMouseClickEvent((int)(event->x() * scale), (int)(event->y() * scale), button, true, GetCefModifiers(event->modifiers(), event->buttons()), clickCount);
	}
	QWidget::mouseReleaseEvent(event);
}

void QCefView::mouseDoubleClickEvent(QMouseEvent *event) {
	// Deliberately does NOT forward a synthetic click to CEF: Qt's Wayland
	// backend already sent an ordinary mousePressEvent for this same
	// physical click (with the correct clickCount computed above), so
	// forwarding another one here would double-send it. This override
	// exists only to stop QWidget's default (no-op) handling from
	// consuming the event silently -- forward to the base implementation
	// so Qt's own bookkeeping still runs, without talking to CEF again.
	QWidget::mouseDoubleClickEvent(event);
}

void QCefView::mouseMoveEvent(QMouseEvent *event) {
	if (m_isWayland && m_pCefView) {
		double scale = devicePixelRatio();
		m_pCefView->SendMouseMoveEvent((int)(event->x() * scale), (int)(event->y() * scale), false, GetCefModifiers(event->modifiers(), event->buttons()));
	}
	QWidget::mouseMoveEvent(event);
}

#if QT_VERSION >= QT_VERSION_CHECK(5, 14, 0)
void QCefView::wheelEvent(QWheelEvent *event) {
	if (m_isWayland && m_pCefView) {
		double scale = devicePixelRatio();
		m_pCefView->SendMouseWheelEvent(event->position().x() * scale, event->position().y() * scale, event->angleDelta().x(), event->angleDelta().y(), GetCefModifiers(event->modifiers(), event->buttons()));
	}
	QWidget::wheelEvent(event);
}
#else
void QCefView::wheelEvent(QWheelEvent *event) {
	if (m_isWayland && m_pCefView) {
		double scale = devicePixelRatio();
		m_pCefView->SendMouseWheelEvent(event->pos().x() * scale, event->pos().y() * scale, event->angleDelta().x(), event->angleDelta().y(), GetCefModifiers(event->modifiers(), event->buttons()));
	}
	QWidget::wheelEvent(event);
}
#endif

void QCefView::keyPressEvent(QKeyEvent *event) {
	if (m_isWayland && m_pCefView) {
		int key = event->key();

		// Suppress raw dead key events — let Qt's input method compose them.
		// The composed character will arrive via inputMethodEvent.
		if (key >= Qt::Key_Dead_Grave && key <= Qt::Key_Dead_Greek) {
			event->accept();
			return;
		}

		int windows_key_code = QtKeyToWindowsKeyCode(key);
		
		wchar_t unmodified_char = 0;
		if (key >= Qt::Key_A && key <= Qt::Key_Z) {
			unmodified_char = (event->modifiers() & Qt::ShiftModifier) ? key : (key - Qt::Key_A + 'a');
		} else if (key >= Qt::Key_0 && key <= Qt::Key_9) {
			unmodified_char = key;
		} else if (key == Qt::Key_Space) {
			unmodified_char = ' ';
		} else if (key == Qt::Key_Return || key == Qt::Key_Enter) {
			unmodified_char = '\r';
		} else {
			if (!event->text().isEmpty()) {
				unmodified_char = event->text()[0].unicode();
			}
		}

		wchar_t character = unmodified_char;
		if (event->modifiers() & Qt::ControlModifier) {
			if (key >= Qt::Key_A && key <= Qt::Key_Z) {
				character = key - Qt::Key_A + 1;
			}
		}

		std::wstring character_str;
		character_str.push_back(character);
		character_str.push_back(unmodified_char);
		character_str.push_back(static_cast<wchar_t>(event->nativeScanCode() + 8));

		m_pCefView->SendKeyEvent(0, windows_key_code, GetCefModifiers(event->modifiers(), Qt::NoButton), character_str);
		m_pCefView->SendKeyEvent(3, windows_key_code, GetCefModifiers(event->modifiers(), Qt::NoButton), character_str);
		event->accept();
		return;
	}
	QWidget::keyPressEvent(event);
}

void QCefView::keyReleaseEvent(QKeyEvent *event) {
	if (m_isWayland && m_pCefView) {
		int key = event->key();

		// Suppress raw dead key release events — matching keyPressEvent suppression.
		if (key >= Qt::Key_Dead_Grave && key <= Qt::Key_Dead_Greek) {
			event->accept();
			return;
		}

		int windows_key_code = QtKeyToWindowsKeyCode(key);
		
		wchar_t unmodified_char = 0;
		if (key >= Qt::Key_A && key <= Qt::Key_Z) {
			unmodified_char = (event->modifiers() & Qt::ShiftModifier) ? key : (key - Qt::Key_A + 'a');
		} else if (key >= Qt::Key_0 && key <= Qt::Key_9) {
			unmodified_char = key;
		} else if (key == Qt::Key_Space) {
			unmodified_char = ' ';
		} else if (key == Qt::Key_Return || key == Qt::Key_Enter) {
			unmodified_char = '\r';
		} else {
			if (!event->text().isEmpty()) {
				unmodified_char = event->text()[0].unicode();
			}
		}

		std::wstring character_str;
		character_str.push_back(unmodified_char);
		character_str.push_back(unmodified_char);
		character_str.push_back(static_cast<wchar_t>(event->nativeScanCode() + 8));

		m_pCefView->SendKeyEvent(2, windows_key_code, GetCefModifiers(event->modifiers(), Qt::NoButton), character_str);
		event->accept();
		return;
	}
	QWidget::keyReleaseEvent(event);
}

// An alternative approach would be to use CEF's ImeCommitText API directly,
// which is the canonical IME path. However, this would require:
//
// 1. Adding a new ImeCommitText wrapper to CCefView (similar to existing SendKeyEvent)
// 2. Including additional CEF headers for CefRange
//
// The SendKeyEvent(KEYEVENT_CHAR) approach is simpler, already proven in the
// codebase, and sufficient for dead key compose sequences (which produce final
// committed characters, not preedit/intermediate compositions like CJK input).
void QCefView::inputMethodEvent(QInputMethodEvent *event) {
	if (m_isWayland && m_pCefView) {
		QString commitStr = event->commitString();
		if (!commitStr.isEmpty()) {
			for (int i = 0; i < commitStr.length(); i++) {
				wchar_t ch = commitStr[i].unicode();
				std::wstring character_str;
				character_str.push_back(ch);
				character_str.push_back(ch);
				character_str.push_back(0);
				// Send the full key event sequence: KEYDOWN(0) -> CHAR(3) -> KEYUP(2)
				// CEF requires the complete sequence to properly inject characters.
				m_pCefView->SendKeyEvent(0, ch, 0, character_str);
				m_pCefView->SendKeyEvent(3, ch, 0, character_str);
				m_pCefView->SendKeyEvent(2, ch, 0, character_str);
			}
		}
	}
	event->accept();
}

QVariant QCefView::inputMethodQuery(Qt::InputMethodQuery query) const {
	if (query == Qt::ImEnabled)
		return true;
	return QWidget::inputMethodQuery(query);
}

// focus
void QCefView::focusInEvent(QFocusEvent* e)
{
	if (m_pCefView)
		m_pCefView->focus(true);
}
bool QCefView::focusNextPrevChild(bool next)
{
	// Qt's default QWidget::focusNextPrevChild() intercepts Tab/Shift+Tab
	// for widget-to-widget focus traversal *before* keyPressEvent ever
	// sees the key. Diagnostic logging showed every Tab press produced a
	// focusOutEvent(TabFocusReason) with no matching focusInEvent for
	// seconds (sometimes indefinitely) -- Qt was handing focus to "the
	// next widget in tab order" and nothing ever reclaimed it. Refuse the
	// traversal on Wayland so Tab falls through to keyPressEvent() and
	// gets forwarded to CEF like any other key, matching X11 behavior
	// where CEF's native OSR input path bypassed Qt's focus chain
	// entirely.
	if (m_isWayland)
		return false;
	return QWidget::focusNextPrevChild(next);
}

void QCefView::focusOutEvent(QFocusEvent* e)
{
	// On Wayland, keyboard events are forwarded to CEF manually (see
	// keyPressEvent/keyReleaseEvent above) regardless of Qt's own focus
	// state. If CEF is never told it lost focus, its internal focus
	// traversal (e.g. on Tab) gets out of sync with Qt: CEF still thinks
	// it owns focus, Qt still thinks the widget is focused, and no key
	// event (including Alt-menu accelerators, which never reach this
	// widget at all) can resolve the mismatch until a mouse click forces
	// Qt to re-run focus resolution. Always propagate the focus-out to
	// CEF so SetFocus(false)/SetFocus(true) stay in sync with Qt's own
	// focus transitions.
	if (m_pCefView)
		m_pCefView->focus(false);
}

// move/resize
void QCefView::resizeEvent(QResizeEvent* e)
{
	cef_width = width();
	cef_height = height();

	if (m_pOverride)
		m_pOverride->setGeometry(0, 0, cef_width, cef_height);
	if (m_pGLView)
		m_pGLView->setGeometry(0, 0, cef_width, cef_height);
	if (m_pCefView)
		m_pCefView->resizeEvent();
}
void QCefView::moveEvent(QMoveEvent* e)
{
	if (m_pCefView)
	{
		m_pCefView->moveEvent();
		// Moving across monitors may change the effective DPI; re-check the
		// UI scale so it doesn't stay pinned to the monitor the app started
		// on. Debounced against transient devicePixelRatio() misreads
		// inside UpdateUIScalePercentage() itself.
		m_pCefView->UpdateUIScalePercentage();
	}
	QWidget::moveEvent(e);
}

// close
void QCefView::closeEvent(QCloseEvent* e)
{
	emit closeWidget(e);
}

CCefView* QCefView::GetCefView()
{
	return m_pCefView;
}

void QCefView::Create(CAscApplicationManager* pManager, CefViewWrapperType eType)
{
	switch (eType)
	{
	case cvwtSimple:
	{
		m_pCefView = pManager->CreateCefView(this);
		break;
	}
	case cvwtEditor:
	{
		m_pCefView = pManager->CreateCefEditor(this);
		break;
	}
	default:
		break;
	}
	Init();
}

void QCefView::CreateReporter(CAscApplicationManager* pManager, CAscReporterData* data)
{
	Init();
	m_pCefView = pManager->CreateCefPresentationReporter(this, data);
}

void QCefView::OnMediaStart(NSEditorApi::CAscExternalMedia* data)
{
}
void QCefView::OnMediaEnd(bool isFromResize)
{
}

void QCefView::OnMediaPlayerCommand(NSEditorApi::CAscExternalMediaPlayerCommand* data)
{
}

// events
void QCefView::OnRelease()
{
	emit _closed();
}
void QCefView::OnLoaded()
{
	emit _loaded();
}

// slots
void QCefView::_loadedSlot()
{
}
void QCefView::_closedSlot()
{
	this->OnMediaEnd();
}

// get natural view
QWidget* QCefView::GetViewWidget()
{
	return m_pOverride ? m_pOverride : this;
}

// background color
void QCefView::SetBackgroundCefColor(unsigned char r, unsigned char g, unsigned char b)
{
	backgroundR = r;
	backgroundG = g;
	backgroundB = b;

	QString sR = QString::number((int)r, 16);
	QString sG = QString::number((int)g, 16);
	QString sB = QString::number((int)b, 16);
	if (sR.length() < 2)
		sR = "0" + sR;
	if (sG.length() < 2)
		sG = "0" + sG;
	if (sB.length() < 2)
		sB = "0" + sB;

	QString sColor = sR + sG + sB;
	QString sStyle = "background-color:#" + sColor + ";";
	this->setStyleSheet(sStyle);
}

double QCefView::GetDeviceScaleFactor()
{
	return this->devicePixelRatio();
}

double QCefView::GetUIScalePercentage()
{
	// Originally bucketed off logicalDotsPerInch() the way LibreOffice's
	// CountDPIScaleFactor() does (96 DPI baseline, X11-era heuristic) --
	// but that returns a flat 100% on a standard-DPI Wayland output even
	// when the compositor has a real configured display scale, silently
	// discarding the signal this is actually meant to track. Wayland sets
	// an explicit output scale directly rather than relying on physical
	// DPI, and Qt's own devicePixelRatio() already reflects that scale
	// live (this is a different value from what dsf-1.0-osr forces CEF's
	// own device_scale_factor to for coordinate-mapping purposes -- Qt
	// keeps tracking the real ratio locally regardless of what we report
	// to CEF), so use it directly instead.
	if (m_isWayland)
		return this->devicePixelRatio() * 100.0;

	// xcb: devicePixelRatio() still reflects Xft.dpi here despite
	// AA_Use96Dpi and the HiDPI env overrides, but window/CEF-surface
	// geometry is scaled independently now (devicePixelRatio() applied
	// directly in SetWindowSize()/Init()'s raw X11 pixel sizing), so
	// using it here too would double it again. The native Qt chrome
	// (tab bar, etc.) already scales off QDpiChecker::GetMonitorDpi()'s
	// Xft.dpi-derived value -- use that same source for CEF content so
	// the two match, instead of leaving CEF zoom neutral.
	if (NULL == CAscApplicationManager::GetDpiChecker())
		return 100.0;

	unsigned int dx = 0, dy = 0;
	int nScreen = QApplication::screens().indexOf(this->screen());
	CAscApplicationManager::GetDpiChecker()->GetMonitorDpi(nScreen, &dx, &dy);
	return CAscApplicationManager::GetDpiChecker()->GetScale(dx, dy) * 100.0;
}

bool QCefView::IsWayland()
{
	return m_isWayland;
}

void QCefView::GetWidgetScreenPosition(int& screenX, int& screenY)
{
	// Map widget's top-left to global screen coordinates.
	// On Wayland, mapToGlobal may return (0,0) since global coords
	// aren't available, but CEF primarily needs the widget offset
	// for internal coordinate calculations.
	QPoint globalPos = mapToGlobal(QPoint(0, 0));
	double dpr = devicePixelRatio();
	// CEF expects screen device (pixel) coordinates on Linux
	screenX = (int)(globalPos.x() * dpr);
	screenY = (int)(globalPos.y() * dpr);
}

void QCefView::SetClipboardData(const std::wstring& sJson)
{
	QJsonParseError err;
	QJsonDocument doc = QJsonDocument::fromJson(QString::fromStdWString(sJson).toUtf8(), &err);
	if (err.error != QJsonParseError::NoError || !doc.isObject())
		return;

	QJsonObject obj = doc.object();
	QMimeData* pMime = new QMimeData();

	if (obj.contains("text/plain"))
		pMime->setText(obj.value("text/plain").toString());

	if (obj.contains("text/html"))
		pMime->setHtml(obj.value("text/html").toString());

	// The internal high-fidelity fragment sdkjs already builds for same-app
	// paste (shapes, tables, embedded objects). Stored as a raw custom MIME
	// type so it round-trips exactly through GetClipboardData below; other
	// applications simply won't see/use this entry.
	if (obj.contains("text/x-custom"))
	{
		QByteArray data = obj.value("text/x-custom").toString().toUtf8();
		pMime->setData("text/x-custom", data);
	}

	if (obj.contains("image/png"))
	{
		QByteArray b64 = obj.value("image/png").toString().toUtf8();
		QByteArray png = QByteArray::fromBase64(b64);
		if (!png.isEmpty())
			pMime->setData("image/png", png);
	}

	QApplication::clipboard()->setMimeData(pMime);
}

std::wstring QCefView::GetClipboardData()
{
	const QMimeData* pMime = QApplication::clipboard()->mimeData();
	if (!pMime)
		return L"";

	QJsonObject obj;

	// Prefer the internal fragment when present -- it means the clipboard
	// currently holds a same-app (or another Euro-Office instance's) copy,
	// so paste can reconstruct it with full fidelity instead of falling
	// back to HTML/plain text.
	if (pMime->hasFormat("text/x-custom"))
		obj["text/x-custom"] = QString::fromUtf8(pMime->data("text/x-custom"));

	if (pMime->hasHtml())
		obj["text/html"] = pMime->html();

	if (pMime->hasText())
		obj["text/plain"] = pMime->text();

	if (pMime->hasImage())
	{
		QImage img = qvariant_cast<QImage>(pMime->imageData());
		if (!img.isNull())
		{
			QByteArray png;
			QBuffer buffer(&png);
			buffer.open(QIODevice::WriteOnly);
			img.save(&buffer, "PNG");
			obj["image/png"] = QString::fromUtf8(png.toBase64());
		}
	}

	if (obj.isEmpty())
		return L"";

	QJsonDocument doc(obj);
	return QString::fromUtf8(doc.toJson(QJsonDocument::Compact)).toStdWString();
}

void QCefView::SetCursorType(int cursorType)
{
	// Mirrors cef_cursor_type_t (include/internal/cef_types.h) by numeric
	// value -- duplicated here instead of included so the Qt wrapper doesn't
	// pick up a dependency on the CEF include path.
	enum {
		CT_POINTER = 0, CT_CROSS = 1, CT_HAND = 2, CT_IBEAM = 3, CT_WAIT = 4,
		CT_EASTRESIZE = 6, CT_NORTHRESIZE = 7, CT_NORTHEASTRESIZE = 8,
		CT_NORTHWESTRESIZE = 9, CT_SOUTHRESIZE = 10, CT_SOUTHEASTRESIZE = 11,
		CT_SOUTHWESTRESIZE = 12, CT_WESTRESIZE = 13, CT_NORTHSOUTHRESIZE = 14,
		CT_EASTWESTRESIZE = 15, CT_COLUMNRESIZE = 18, CT_ROWRESIZE = 19,
		CT_MOVE = 29, CT_CELL = 31, CT_NODROP = 35, CT_NOTALLOWED = 38,
		CT_ZOOMIN = 39, CT_ZOOMOUT = 40,
	};

	Qt::CursorShape shape = Qt::ArrowCursor;
	switch (cursorType)
	{
		case CT_IBEAM:                                  shape = Qt::IBeamCursor; break;
		case CT_HAND:                                   shape = Qt::PointingHandCursor; break;
		case CT_CROSS:
		case CT_CELL:
		case CT_ZOOMIN:
		case CT_ZOOMOUT:                                shape = Qt::CrossCursor; break;
		case CT_EASTRESIZE:
		case CT_WESTRESIZE:
		case CT_EASTWESTRESIZE:                         shape = Qt::SizeHorCursor; break;
		case CT_NORTHRESIZE:
		case CT_SOUTHRESIZE:
		case CT_NORTHSOUTHRESIZE:                       shape = Qt::SizeVerCursor; break;
		case CT_NORTHEASTRESIZE:
		case CT_SOUTHWESTRESIZE:                        shape = Qt::SizeBDiagCursor; break;
		case CT_NORTHWESTRESIZE:
		case CT_SOUTHEASTRESIZE:                        shape = Qt::SizeFDiagCursor; break;
		case CT_COLUMNRESIZE:                           shape = Qt::SplitHCursor; break;
		case CT_ROWRESIZE:                              shape = Qt::SplitVCursor; break;
		case CT_MOVE:                                   shape = Qt::SizeAllCursor; break;
		case CT_WAIT:                                   shape = Qt::WaitCursor; break;
		case CT_NODROP:
		case CT_NOTALLOWED:                             shape = Qt::ForbiddenCursor; break;
		case CT_POINTER:
		default:                                        shape = Qt::ArrowCursor; break;
	}
	setCursor(shape);
}

void QCefView::SetCursorCustom(const void* buffer, int width, int height, int hotspotX, int hotspotY)
{
	if (!buffer || width <= 0 || height <= 0) {
		setCursor(Qt::ArrowCursor);
		return;
	}

	// Same premultiplied-BGRA layout CEF uses for the OSR frame buffer (see
	// OnPaint above) -- Format_ARGB32_Premultiplied matches it byte-for-byte
	// on little-endian.
	QImage img((const uchar*)buffer, width, height, QImage::Format_ARGB32_Premultiplied);
	QCursor cursor(QPixmap::fromImage(img.copy()), hotspotX, hotspotY);
	setCursor(cursor);
}

QCefGLWidget::QCefGLWidget(QWidget* parent)
	: QOpenGLWidget(parent)
{
	// Input stays with the QCefView parent; this overlay is display-only.
	setAttribute(Qt::WA_TransparentForMouseEvents, true);
	setFocusPolicy(Qt::NoFocus);
	setAutoFillBackground(false);
}

void QCefGLWidget::SetFrame(const QImage& image)
{
	// image is already a deep copy owned by the caller (QImage is implicitly
	// shared, so this is a cheap ref, not a second pixel copy).
	m_frame = image;
	// Schedules paintGL() + a GL swap. On Wayland the swap is the surface
	// commit and is throttled by the compositor's frame callback natively, so
	// the frame is presented without needing a physical input event.
	update();
}

void QCefGLWidget::paintGL()
{
	if (m_frame.isNull())
		return;

	// Draw the full physical-pixel CEF buffer into the full widget area, same
	// mapping as QCefView::paintEvent used for the raster path.
	QPainter painter(this);
	painter.drawImage(
		QRectF(0, 0, width(), height()),
		m_frame,
		QRectF(0, 0, m_frame.width(), m_frame.height())
	);
}

void QCefView::OnPaint(const void* buffer, int width, int height)
{
	if (!m_isWayland) return;

	// Runs inside CEF's OnPaint callback: only stage the frame (no event-loop
	// re-entrancy). Push it to the GL overlay, which presents it via a GL swap
	// (= wl_surface_commit) that participates in the compositor frame-callback
	// loop, so no top-of-loop flush is needed to unstick the commit.
	QImage img((const uchar*)buffer, width, height, QImage::Format_ARGB32_Premultiplied);
	QImage frame = img.copy();

	// Keep a raster copy too: QCefView::paintEvent uses it as a backdrop behind
	// the GL overlay (e.g. during resize), and it costs nothing extra (COW).
	m_imageBuffer = frame;

	if (m_pGLView)
		m_pGLView->SetFrame(frame);

	m_dirty.storeRelaxed(1);
}

void QCefView::FlushDirtyWaylandViews()
{
	// Runs from the message-loop poller (top of loop, non-reentrant) after CEF
	// has been pumped. Nudge a repaint of any view that produced a frame this
	// tick so the GL swap is scheduled at the top of the loop. No event-loop
	// spin here: nothing that could starve input or re-enter CEF.
	for (QCefView* view : s_waylandViews)
	{
		if (view->m_dirty.fetchAndStoreRelaxed(0) && view->m_pGLView)
			view->m_pGLView->update();
	}
}



void QCefView::paintEvent(QPaintEvent* event)
{
	if (m_isWayland && !m_imageBuffer.isNull()) {
		QPainter painter(this);
		// Draw the full physical-pixel CEF buffer into the full widget area.
		// Source: all physical pixels from the CEF OnPaint buffer.
		// Target: full widget rect in logical (DIP) coordinates.
		// Qt maps source onto target, stretching to fill. Since the buffer
		// is DIP*DPR pixels and the widget is DIP logical (= DIP*DPR physical),
		// this results in a 1:1 pixel mapping with no clipping.
		painter.drawImage(
			QRectF(0, 0, width(), height()),
			m_imageBuffer,
			QRectF(0, 0, m_imageBuffer.width(), m_imageBuffer.height())
		);
		return;
	}

	QStyleOption opt;
	opt.initFrom(this);
	QPainter p(this);
	style()->drawPrimitive(QStyle::PE_Widget, &opt, &p, this);
}

#ifdef _WIN32

void QCefView::Init()
{
	cef_handle = reinterpret_cast<WindowHandleId>(winId());
	//cef_ex_style = WS_EX_NOACTIVATE;
	cef_width = width();
	cef_height = height();
}

void QCefView::UpdateSize()
{
	HWND _parent = reinterpret_cast<HWND>(winId());
	HWND _child = GetWindow(_parent, GW_CHILD);

	int nW = width();
	int nH = height();

#if 0
	// TODO: удалить после релиза 7.4
	if (CAscApplicationManager::IsUseSystemScaling() && nW > 2 && nH > 2 && m_pCefView && m_pCefView->isDoubleResizeEvent())
	{
		// Resolved using window resize event. Fix bug #62086
		//SetWindowPos(_child, _parent, 0, 0, nW - 1, nH - 1, SWP_NOZORDER);
		//SetFocus(_parent);
	}
#endif

	SetWindowPos(_child, _parent, 0, 0, nW, nH, SWP_NOZORDER);
}

void QCefView::AfterCreate()
{
}

bool QCefView::IsSupportLayers()
{
	return true;
}
void QCefView::SetCaptionMaskSize(int)
{
	// not using
}

#endif

#if defined (_LINUX) && !defined(_MAC)
#include <QDragEnterEvent>
#include <QDropEvent>
#include <QFileInfo>
#include <QUrl>
#include <QMimeData>

// OVERRIDE WIDGET
QCefEmbedWindow::QCefEmbedWindow(QPointer<QCefView> _qcef_parent, QWindow* _parent) : QWindow(_parent), qcef_parent(_qcef_parent)
{
	m_nCaptionSize = 0;
	this->installEventFilter(this);
}

void QCefEmbedWindow::resizeEvent(QResizeEvent* e)
{
	if (0 != m_nCaptionSize)
	{
		setMask(QRegion());
		setMask(QRegion(0, m_nCaptionSize, width(), height() - m_nCaptionSize));
	}

	if (qcef_parent)
		qcef_parent->UpdateSize();
}
void QCefEmbedWindow::moveEvent(QMoveEvent* e)
{
	if (qcef_parent)
		qcef_parent->UpdateSize();
}

void QCefEmbedWindow::SetCaptionMaskSize(int size)
{
	if (m_nCaptionSize == size)
		return;
	m_nCaptionSize = size;
	if (0 == m_nCaptionSize)
		setMask(QRegion());
}

bool QCefEmbedWindow::eventFilter(QObject *watched, QEvent *event)
{
	if (this != watched)
		return false;

	switch (event->type())
	{
	case QEvent::DragEnter:
	{
		if (!qcef_parent)
			return false;

		QDragEnterEvent* e = (QDragEnterEvent*)event;
		QList<QUrl> urls = e->mimeData()->urls();

		bool isSupport = false;
		QSet<QString> _exts;
		_exts << "docx" << "doc" << "odt" << "rtf" << "txt" << "doct" << "dotx" << "ott";
		_exts << "html" << "mht" << "epub";
		_exts << "pptx" << "ppt" << "odp" << "ppsx" << "pptt" << "potx" << "otp";
		_exts << "xlsx" << "xls" << "ods" << "csv" << "xlst" << "xltx" << "ots";
		_exts << "pdf" << "djvu" << "xps";
		_exts << "plugin";

		for (int i = 0; i < urls.length(); i++)
		{
			QFileInfo oInfo(urls[i].toString());
			if (!_exts.contains(oInfo.suffix()))
			{
				isSupport = false;
				break;
			}
			isSupport = true;
		}

		if (isSupport)
			e->acceptProposedAction();
		else
		{
			e->setDropAction(Qt::IgnoreAction);
			e->accept();
		}

		return true;
	}
	case QEvent::Drop:
	{
		if (!qcef_parent)
			return false;

		QDropEvent* e = (QDropEvent*)event;
		QList<QUrl> urls = e->mimeData()->urls();

		QList<QString> files;
		for (int i = 0; i < urls.length(); i++)
		{
			QString qpath = urls[i].path();
			std::wstring path = qpath.toStdWString();

			std::wstring::size_type nPosPluginExt = path.rfind(L".plugin");
			std::wstring::size_type nUrlLen = path.length();
			if ((nPosPluginExt != std::wstring::npos) && ((nPosPluginExt + 7) == nUrlLen))
			{
				// register plugin
				NSEditorApi::CAscMenuEvent* pEvent = new NSEditorApi::CAscMenuEvent();
				pEvent->m_nType = ASC_MENU_EVENT_TYPE_DOCUMENTEDITORS_ADD_PLUGIN;
				NSEditorApi::CAscAddPlugin* pData = new NSEditorApi::CAscAddPlugin();
				pData->put_Path(path);
				pEvent->m_pData = pData;

				qcef_parent->GetCefView()->GetAppManager()->Apply(pEvent);
			}
			else
			{
				files.push_back(qpath);
			}
		}

		if (files.length() > 0)
		{
			emit qcef_parent->onDropFiles(files);
		}

		e->acceptProposedAction();
		return true;
	}
	default:
		break;
	}

	return QWindow::eventFilter(watched, event);
}

#include <X11/Xlib.h>

void QCefView::Init()
{
	if (m_isWayland)
	{
		cef_handle = 0;
		setAcceptDrops(true);
		setMouseTracking(true);
		setFocusPolicy(Qt::StrongFocus);
		setAttribute(Qt::WA_InputMethodEnabled, true);

		// GL overlay that presents the CEF OSR buffer (see QCefGLWidget). It
		// fully covers this view and is mouse-transparent, so QCefView keeps
		// handling all input.
		m_pGLView = new QCefGLWidget(this);
		m_pGLView->setGeometry(0, 0, width(), height());
		m_pGLView->show();
		m_pGLView->raise();
	}
	else if (IsSupportLayers())
	{
		Display* display = (Display*)CefGetXDisplay();
		Window x11root = XDefaultRootWindow(display);
		// width()/height() are in DIPs; X11 wants physical pixels. Qt's own
		// window still ends up sized in physical pixels by the platform
		// plugin even with AA_Use96Dpi set (devicePixelRatio() isn't
		// reliably neutralized under XWayland), so scale explicitly here
		// to match, the same way SetWindowSize() below does.
		double scale = devicePixelRatio();
		Window x11w = XCreateSimpleWindow(display, x11root, 0, 0, (int)(width() * scale), (int)(height() * scale), 0, 0,
										  (m_pCefView && m_pCefView->GetType() != cvwtEditor) ? 0xFFFFFFFF : 0xFFF4F4F4);
		XReparentWindow(display, x11w, this->winId(), 0, 0);
		XMapWindow(display, x11w);
		XDestroyWindow(display, x11root);
		cef_handle = x11w;

		setAcceptDrops(true);
	}
	else
	{
		QWindow* win = new QCefEmbedWindow(this);
		m_pProperties = new QCefViewProps();
		m_pProperties->m_window = win;
		cef_handle = (WindowHandleId)(win->winId());
	}
	cef_width = width();
	cef_height = height();
}

void QCefView::AfterCreate()
{
	if (IsSupportLayers())
		return;
	m_pOverride = QWidget::createWindowContainer(m_pProperties->m_window, this);
	connect(m_pOverride.operator ->(), &QWidget::destroyed, this, [=](QObject*) {
		deleteLater();
	});
}

bool QCefView::IsSupportLayers()
{
    return true;
}
void QCefView::SetCaptionMaskSize(int size)
{
	if (m_pProperties && m_pProperties->m_window)
		((QCefEmbedWindow*)m_pProperties->m_window)->SetCaptionMaskSize(size);
}

Window GetChild(Window parent)
{
	Display* xdisplay = (Display*)CefGetXDisplay();
	Window root_ret;
	Window parent_ret;
	Window* children_ret;
	unsigned int child_count_ret;
	Status status = XQueryTree(xdisplay, parent, &root_ret, &parent_ret, &children_ret, &child_count_ret);
	Window ret = 0;
	if (status != 0 && child_count_ret > 0)
	{
		ret = children_ret[0];
		XFree(children_ret);
	}
	return ret;
}

void SetWindowSize(Window window, QWidget* parent)
{
	if (window > 0)
	{
		Display* xdisplay = (Display*)CefGetXDisplay();
		XWindowChanges changes = {};
		changes.x = 0;
		changes.y = 0;
		// parent->width()/height() are DIPs; X11 geometry is physical
		// pixels, so scale by devicePixelRatio() to match (see Init()'s
		// XCreateSimpleWindow call for the same reasoning).
		double scale = parent->devicePixelRatio();
		changes.width = (int)(parent->width() * scale);
		changes.height = (int)(parent->height() * scale);

		// XErrorHandlerImpl: BadValue error occurs
		if (changes.width && changes.height)
		{
			XConfigureWindow(xdisplay,
							 window,
							 CWX | CWY | CWHeight | CWWidth,
							 &changes);
		}
	}
}

void QCefView::UpdateSize()
{
	if (m_isWayland) return;

	if (IsSupportLayers())
		SetWindowSize(cef_handle, this);

	Window child = GetChild(cef_handle);
	if (child)
		SetWindowSize(child, this);

	Window child_ = GetChild(child);
	if (child_)
		SetWindowSize(child_, this);
}

void QCefView::dragEnterEvent(QDragEnterEvent *e)
{
	setFocusToCef();

	NSEditorApi::CAscLocalDragDropData* pData = convertMimeData(e->mimeData());
	pData->put_X(e->pos().x());
	pData->put_Y(e->pos().y());
	pData->put_CursorX(QCursor::pos().x());
	pData->put_CursorY(QCursor::pos().y());

	NSEditorApi::CAscMenuEvent* pEvent = new NSEditorApi::CAscMenuEvent();
	pEvent->m_nType = ASC_MENU_EVENT_TYPE_CEF_DRAG_ENTER;
	pEvent->m_pData = pData;
	m_pCefView->Apply(pEvent);

	e->acceptProposedAction();
}

void QCefView::dragLeaveEvent(QDragLeaveEvent *e)
{
	if (m_pCefView && m_pCefView->GetType() == cvwtEditor)
	{
		NSEditorApi::CAscMenuEvent* pEvent = new NSEditorApi::CAscMenuEvent();
		pEvent->m_nType = ASC_MENU_EVENT_TYPE_CEF_DRAG_LEAVE;

		m_pCefView->Apply(pEvent);
	}
}

void QCefView::dropEvent(QDropEvent *e)
{
	setFocusToCef();

	NSEditorApi::CAscLocalDragDropData* pData = convertMimeData(e->mimeData());
	pData->put_X(e->pos().x());
	pData->put_Y(e->pos().y());
	pData->put_CursorX(QCursor::pos().x());
	pData->put_CursorY(QCursor::pos().y());

	NSEditorApi::CAscMenuEvent* pEvent = new NSEditorApi::CAscMenuEvent();
	pEvent->m_nType = ASC_MENU_EVENT_TYPE_CEF_DROP;
	pEvent->m_pData = pData;
	m_pCefView->Apply(pEvent);

	e->acceptProposedAction();
}

NSEditorApi::CAscLocalDragDropData* QCefView::convertMimeData(const QMimeData *pMimeData)
{
	NSEditorApi::CAscLocalDragDropData* pData = NULL;

	if (pMimeData)
	{
		pData = new NSEditorApi::CAscLocalDragDropData();

		if (pMimeData->hasUrls())
		{
			QList<QUrl> list = pMimeData->urls();
			for (int i = 0; i < list.size(); i++)
			{
				QString sPath = list[i].toString();
				if (sPath.indexOf("file://", 0) == 0)
					sPath.replace("file://", "");

				pData->add_File(sPath.toStdWString());
			}
		}
		if (pMimeData->hasText() && !pMimeData->hasUrls())
			pData->put_Text(pMimeData->text().toStdWString());

		if (pMimeData->hasHtml())
			pData->put_Html(pMimeData->html().toStdWString());
	}

	return pData;
}

#endif
