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

#ifndef CEFCLIENT_CEFWEBVIEW_H
#define CEFCLIENT_CEFWEBVIEW_H

#include "./base.h"
#include "./applicationmanager_events.h"

enum CefViewWrapperType
{
	cvwtSimple      = 0,
	cvwtEditor      = 1
};

enum class AscEditorType
{
	etDocument              = 0,
	etPresentation          = 1,
	etSpreadsheet           = 2,
	etDocumentMasterForm    = 3,
	etDocumentMasterOForm   = 4,
	etPdf                   = 5,
	etDraw                  = 6,
	etUndefined             = 255
};

class CCefView_Private;
class CAscApplicationManager;

class CCefViewWidgetImpl
{
public:
	WindowHandleId cef_handle;
	unsigned int cef_ex_style;
	unsigned int cef_style;

	unsigned int cef_x;
	unsigned int cef_y;
	unsigned int cef_width;
	unsigned int cef_height;

	unsigned char backgroundR;
	unsigned char backgroundG;
	unsigned char backgroundB;

public:
	CCefViewWidgetImpl()
	{
		cef_handle = 0;
		cef_ex_style = 0;
		cef_style = 0;

		cef_x = 0;
		cef_y = 0;
		cef_width = 0;
		cef_height = 0;

		backgroundR = 255;
		backgroundG = 255;
		backgroundB = 255;
	}

	virtual ~CCefViewWidgetImpl() {}

public:
	virtual void UpdateSize() {}
	virtual void AfterCreate() {}
	virtual void OnLoaded() {}
	virtual void OnRelease() {}

	virtual double GetDeviceScaleFactor() { return 1.0; }
	virtual bool IsWayland() { return false; }

	// UI layout scale as a percentage (100 = no scaling), bucketed off real
	// monitor DPI the same way LibreOffice's CountDPIScaleFactor() does.
	// Deliberately independent of GetDeviceScaleFactor()/devicePixelRatio,
	// which dsf-1.0-osr (see cefview.cpp GetViewRect/GetScreenInfo) forces
	// to always report 1:1 for CEF's OSR coordinate mapping -- reusing that
	// value here would lose the real DPI signal on HiDPI displays.
	virtual double GetUIScalePercentage() { return 100.0; }

	// Returns the widget's top-left position in screen device (pixel) coordinates.
	// Used by CEF's GetScreenPoint to map view DIPs to screen pixels.
	virtual void GetWidgetScreenPosition(int& screenX, int& screenY) { screenX = 0; screenY = 0; }

	virtual void OnPaint(const void* buffer, int width, int height) {}

	// Native OS clipboard bridge. CEF's own OS clipboard integration does not
	// work in off-screen-rendering mode under Wayland (Chromium's clipboard
	// requires a real wl_surface + input serial to claim ownership, which OSR
	// mode never has), so copy/paste is routed through here to whatever real
	// clipboard mechanism the platform widget implementation provides.
	// sJson carries a JSON object of MIME type -> data (mirroring the
	// c_oAscClipboardDataFormat entries sdkjs already builds for copy: at
	// least "text/plain" and "text/html", plus "text/x-custom" for the
	// internal high-fidelity fragment format used for same-app paste).
	virtual void SetClipboardData(const std::wstring& sJson) {}
	virtual std::wstring GetClipboardData() { return L""; }

	// Native OS cursor bridge. In windowed CEF mode, CEF owns a real native
	// window and sets the OS cursor itself when the page requests a cursor
	// change (text I-beam, resize handles, hand, move, etc). In
	// off-screen-rendering mode (used for Wayland, see IsWayland above)
	// there is no CEF-owned window, so nothing sets the OS cursor unless we
	// do it here ourselves. cursorType is a cef_cursor_type_t value.
	virtual void SetCursorType(int cursorType) {}

	// Bridge for CSS `cursor: url(...)` custom-image cursors (CEF reports
	// these as cef_cursor_type_t::CT_CUSTOM with the actual bitmap here
	// instead of a named type -- see SetCursorType above). buffer is a
	// premultiplied BGRA pixel buffer of width x height; hotspotX/Y is the
	// cursor's hotspot in that bitmap's own pixel coordinates.
	virtual void SetCursorCustom(const void* buffer, int width, int height, int hotspotX, int hotspotY) {}

	static void SetParentNull(WindowHandleId handle);
};

class DESKTOP_DECL CCefView
{
public:
	CCefView(CCefViewWidgetImpl* parent, int nId);
	virtual ~CCefView();

	void load(const std::wstring& url);
	void reload();
	std::wstring GetUrl();
	std::wstring GetOriginalUrl();
	std::wstring GetUrlAsLocal();

	void focus(bool value = true);

	void resizeEvent();
	void moveEvent();
	bool isDoubleResizeEvent();

	void Apply(NSEditorApi::CAscMenuEvent* );
	NSEditorApi::CAscMenuEvent* ApplySync(NSEditorApi::CAscMenuEvent* );

	NSEditorApi::CAscCefMenuEvent* CreateCefEvent(int nType);

	bool StartDownload(const std::wstring& sUrl);

	void SetExternalCloud(const std::wstring& sProviderId);

	CAscApplicationManager* GetAppManager();
	void SetAppManager(CAscApplicationManager* );

	CCefViewWidgetImpl* GetWidgetImpl();
	void OnDestroyWidgetImpl();

	int GetId();
	CefViewWrapperType GetType();

	void SetModified(bool bIsModified);
	bool GetModified();

	bool IsPresentationReporter();
	void LoadReporter(void* reporter_data);

	double GetDeviceScale();

	// Pushes GetWidgetImpl()->GetUIScalePercentage() into the page as CSS
	// custom properties (--pixel-ratio-factor, --x-small-btn-size,
	// --x-small-btn-icon-size) and corrects window.devicePixelRatio for
	// sdkjs's own canvas scaling, which reads it directly. Call on load and
	// whenever the widget's DPI may have changed (e.g. moved to another
	// monitor).
	// Injects into every frame of the browser, not just the main one -- the
	// actual editor UI (ribbon, AscCommon) loads in a nested iframe, which
	// is a separate browsing context with its own documentElement/CSSOM;
	// setting these CSS custom properties on the main frame alone has no
	// effect on an iframe's own styles.
	void UpdateUIScalePercentage();

	int GetPrintPageOrientation(const int& nPage);

	bool IsDestroy();

	void SetParentWidgetInfo(const std::wstring& json);

	int GetRecentId();

	void ExecuteInAllFrames(const std::string& sCode, const bool& isMain = true);

	void SendMouseClickEvent(int x, int y, int button, bool mouseUp, int modifiers, int clickCount);
	void SendMouseMoveEvent(int x, int y, bool mouseLeave, int modifiers);
	void SendMouseWheelEvent(int x, int y, int deltaX, int deltaY, int modifiers);
	void SendKeyEvent(int type, int key, int modifiers, const std::wstring& character);

protected:
	int m_nId;
	CefViewWrapperType m_eWrapperType;
	CCefView_Private* m_pInternal;

public:

	friend class CCefView_Private;
	friend class CAscClientHandler;
	friend class CAscApplicationManager;
	friend class CAscApplicationManager_Private;
	friend class CASCFileConverterToEditor;
	friend class CCefViewEditor;
};

class DESKTOP_DECL CCefViewEditor : public CCefView
{
protected:
	AscEditorType m_eType;

public:
	CCefViewEditor(CCefViewWidgetImpl* parent, int nId);
	virtual ~CCefViewEditor();

	void SetEditorType(AscEditorType eType);
	AscEditorType GetEditorType();

	void OpenLocalFile(const std::wstring& sFilePath, const int& nFileFormat, const std::wstring& params = L"");
	void CreateLocalFile(const AscEditorType& nFileFormat, const std::wstring& sName = L"", const std::wstring& sTemplatePath = L"");
	void CreateLocalFile(const AscEditorType& nFileFormat, const int& nTemplateId, const std::wstring& sName = L"");
	bool OpenCopyAsRecoverFile(const int& nIdSrc);
	bool OpenRecoverFile(const int& nId);
	bool OpenRecentFile(const int& nId);
	bool OpenReporter(const std::wstring& sFolder);

	bool CheckCloudCryptoNeedBuild();
	bool IsBuilding();
	bool IsSaveLocked();

	std::wstring GetLocalFilePath();
	std::wstring GetRecoveryDir();

	static int GetFileFormat(const std::wstring& sFilePath);

	void UpdatePlugins();
};

#if defined(_LINUX) && !defined(_MAC)
DESKTOP_DECL void* CefGetXDisplay(void);
#endif

#endif  // CEFCLIENT_CEFWEBVIEW_H
