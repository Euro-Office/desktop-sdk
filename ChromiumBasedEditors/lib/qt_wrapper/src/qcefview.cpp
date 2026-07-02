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
#include <QPainter>
#include <QApplication>
#include <QAbstractEventDispatcher>
#include <QTimer>
#include <QDebug>
#include <set>

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

	}

	if (IsSupportLayers())
		this->installEventFilter(this);
}

QCefView::~QCefView()
{
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

		// CEF coordinate space is DIPs (same as GetViewRect). Qt delivers DIPs.
		m_pCefView->SendMouseClickEvent(event->x(), event->y(), button, false, GetCefModifiers(event->modifiers(), event->buttons()), 1);
	}
	QWidget::mousePressEvent(event);
}

void QCefView::mouseReleaseEvent(QMouseEvent *event) {
	if (m_isWayland && m_pCefView) {
		int button = 1;
		if (event->button() == Qt::RightButton) button = 2;
		else if (event->button() == Qt::MiddleButton) button = 3;
		m_pCefView->SendMouseClickEvent(event->x(), event->y(), button, true, GetCefModifiers(event->modifiers(), event->buttons()), 1);
	}
	QWidget::mouseReleaseEvent(event);
}

void QCefView::mouseMoveEvent(QMouseEvent *event) {
	if (m_isWayland && m_pCefView) {
		m_pCefView->SendMouseMoveEvent(event->x(), event->y(), false, GetCefModifiers(event->modifiers(), event->buttons()));
	}
	QWidget::mouseMoveEvent(event);
}

#if QT_VERSION >= QT_VERSION_CHECK(5, 14, 0)
void QCefView::wheelEvent(QWheelEvent *event) {
	if (m_isWayland && m_pCefView) {
		m_pCefView->SendMouseWheelEvent(event->position().x(), event->position().y(), event->angleDelta().x(), event->angleDelta().y(), GetCefModifiers(event->modifiers(), event->buttons()));
	}
	QWidget::wheelEvent(event);
}
#else
void QCefView::wheelEvent(QWheelEvent *event) {
	if (m_isWayland && m_pCefView) {
		m_pCefView->SendMouseWheelEvent(event->pos().x(), event->pos().y(), event->angleDelta().x(), event->angleDelta().y(), GetCefModifiers(event->modifiers(), event->buttons()));
	}
	QWidget::wheelEvent(event);
}
#endif

void QCefView::keyPressEvent(QKeyEvent *event) {
	if (m_isWayland && m_pCefView) {
		int key = event->key();
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

// focus
void QCefView::focusInEvent(QFocusEvent* e)
{
	if (m_pCefView)
		m_pCefView->focus(true);
}
void QCefView::focusOutEvent(QFocusEvent* e)
{
	return;
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
	if (m_pCefView)
		m_pCefView->resizeEvent();
}
void QCefView::moveEvent(QMoveEvent* e)
{
	if (m_pCefView)
		m_pCefView->moveEvent();
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

void QCefView::OnPaint(const void* buffer, int width, int height)
{
	if (!m_isWayland) return;

	QImage img((const uchar*)buffer, width, height, QImage::Format_ARGB32_Premultiplied);
	m_imageBuffer = img.copy();

	// Schedule a repaint on the next event loop iteration.
	// Unlike processEvents() (which re-enters the event loop from within
	// a CEF callback and risks reentrancy), singleShot(0) posts an event
	// that Qt processes after CEF's OnPaint has fully returned.
	// repaint() forces a synchronous paint, ensuring the Wayland compositor
	// receives the surface commit promptly.
	QTimer::singleShot(0, this, [this]() {
		repaint();
	});
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
	}
	else if (IsSupportLayers())
	{
		Display* display = (Display*)CefGetXDisplay();
		Window x11root = XDefaultRootWindow(display);
		Window x11w = XCreateSimpleWindow(display, x11root, 0, 0, width(), height(), 0, 0,
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
		changes.width = parent->width();
		changes.height = parent->height();

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
