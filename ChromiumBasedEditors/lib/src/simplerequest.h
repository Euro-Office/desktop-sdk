/*
 * SPDX-FileCopyrightText: 2026 Euro-Office contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

#ifndef SIMPLE_REQUEST_H
#define SIMPLE_REQUEST_H

#include <string>
#include <utility>
#include <vector>

class CPortalAuthorization;

// How AscSimpleRequest.createRequest turns a page's options into a request
// (NSRequest::CSimpleRequestClient). Without CEF, so tests/ can use it.
//
// The renderer passes the method as "METHOD[:params]", params separated by ",":
// "stream" for progress events, "file" when the body is the path of a local file to
// upload, "auth" for the portal's Authorization header. Files and the header are for
// the start page only (bStartPage): other pages must not read local files or make
// requests with the credentials of a cloud.
class CSimpleRequestOptions
{
public:
	CSimpleRequestOptions(const std::string& sMethod, const std::string& sBody, bool bStartPage);

	std::string Method;    // without params
	bool Progress = false;
	bool IsFile = false;   // the body is a local file
	bool HasBody = false;  // a body is sent: POST always, others when one is given
	bool Refused = false;  // the page asked for something it may not have

	// The Authorization header to add to a request to sUrl that has sHeader, "" for none.
	// Only when the start page asks for it: a stale header would break a new login to the
	// same cloud, e.g. Nextcloud's Login Flow, which must go without one.
	std::string Authorization(const std::string& sUrl, const std::string& sHeader,
							  const CPortalAuthorization& oAuth) const;

private:
	bool m_bAuth = false;
	bool m_bStartPage = false;
};

namespace NSSimpleRequest
{
	// For a "..." string literal in JavaScript
	std::string EscapeJs(std::string s);

	// {"name": "value", ...} with lower-case names and without cookies, for the page's
	// responseHeaders
	std::string HeadersToJs(const std::vector<std::pair<std::string, std::string>>& arHeaders);
}

#endif // SIMPLE_REQUEST_H
