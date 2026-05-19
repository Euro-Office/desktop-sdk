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

#ifndef CEF_ASC_CLIENT_APP_H_
#define CEF_ASC_CLIENT_APP_H_

#ifdef CEF_2623
#include "cefclient/common/client_app.h"
#include "cefclient/browser/client_app_browser.h"
#include "cefclient/renderer/client_app_renderer.h"
#include "cefclient/common/client_app_other.h"
#include "cefclient/renderer/client_renderer.h"
#else
#include "tests/shared/common/client_app.h"
#include "tests/shared/browser/client_app_browser.h"
#include "tests/shared/renderer/client_app_renderer.h"
#include "tests/shared/common/client_app_other.h"
#include "tests/cefclient/renderer/client_renderer.h"
#endif

#include "./clienthandler.h"

namespace asc_client_renderer
{
    // Create the render delegate.
    void CreateRenderDelegates(client::ClientAppRenderer::DelegateSet& delegates);
}

class CAscClientAppBrowser : public client::ClientAppBrowser
{
public:
    CAscClientAppBrowser() : client::ClientAppBrowser()
    {
    }

    virtual ~CAscClientAppBrowser()
    {
    }
public:
    virtual void OnBeforeCommandLineProcessing(
        const CefString& process_type,
        CefRefPtr<CefCommandLine> command_line) OVERRIDE
    {
        if (process_type.empty())
        {
#ifndef _MAC
            command_line->AppendSwitch("--disable-accelerated-2d-canvas");
            command_line->AppendSwitch("--disable-d3d11");
#endif

#if defined(_LINUX) && !defined(_MAC)
            command_line->AppendSwitch("--disable-gpu");
#endif

            command_line->AppendSwitch("--disable-extensions");
            command_line->AppendSwitchWithValue("--log-severity", "disable");

            command_line->AppendSwitch("--allow-file-access-from-files");
            command_line->AppendSwitch("--allow-file-access");

            //command_line->AppendSwitch("--allow-running-insecure-content");

            //command_line->AppendSwitch("--disable-web-security");
        }
    }

public:
    IMPLEMENT_REFCOUNTING(CAscClientAppBrowser);
};

class CAscClientAppOther : public client::ClientAppOther
{
public:
    CAscClientAppOther() : client::ClientAppOther()
    {
    }

    virtual ~CAscClientAppOther()
    {
    }
public:
    virtual void OnBeforeCommandLineProcessing(
        const CefString& process_type,
        CefRefPtr<CefCommandLine> command_line) OVERRIDE
    {
        if (process_type.empty())
        {
#ifndef _MAC
            command_line->AppendSwitch("--disable-accelerated-2d-canvas");
            command_line->AppendSwitch("--disable-d3d11");
#endif

#if defined(_LINUX) && !defined(_MAC)
            command_line->AppendSwitch("--disable-gpu");
#endif

            command_line->AppendSwitch("--disable-extensions");
            command_line->AppendSwitchWithValue("--log-severity", "disable");

            //command_line->AppendSwitch("--allow-file-access-from-files");
            //command_line->AppendSwitch("--allow-file-access");

            //command_line->AppendSwitch("--allow-running-insecure-content");

            //command_line->AppendSwitch("--disable-web-security");
        }
    }

public:
    IMPLEMENT_REFCOUNTING(CAscClientAppOther);
};

class CAscClientAppRenderer : public client::ClientAppRenderer
{
public:
    CAscClientAppRenderer() : client::ClientAppRenderer()
    {
    }

    virtual ~CAscClientAppRenderer()
    {
    }
public:
    virtual void OnBeforeCommandLineProcessing(
        const CefString& process_type,
        CefRefPtr<CefCommandLine> command_line) OVERRIDE
    {
        if (process_type.empty())
        {
#ifndef _MAC
            command_line->AppendSwitch("--disable-accelerated-2d-canvas");
            command_line->AppendSwitch("--disable-d3d11");
#endif

#if defined(_LINUX) && !defined(_MAC)
            command_line->AppendSwitch("--disable-gpu");
#endif

            command_line->AppendSwitch("--disable-extensions");
            command_line->AppendSwitchWithValue("--log-severity", "disable");

            //command_line->AppendSwitch("--allow-file-access-from-files");
            //command_line->AppendSwitch("--allow-file-access");

            //command_line->AppendSwitch("--allow-running-insecure-content");

            //command_line->AppendSwitch("--disable-web-security");
        }
    }
};

#endif
