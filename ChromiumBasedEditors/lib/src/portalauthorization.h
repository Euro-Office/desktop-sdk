/*
 * SPDX-FileCopyrightText: 2026 Euro-Office contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

#ifndef PORTAL_AUTHORIZATION_H
#define PORTAL_AUTHORIZATION_H

#include <map>
#include <mutex>
#include <string>

// The Authorization headers set with CAscApplicationManager::SetPortalAuthorization
// and which requests get them. Without CEF, so tests/ can use it.
class CPortalAuthorization
{
public:
	// "https://Cloud.example.com/nc" -> "https://cloud.example.com/nc/", "" if not a URL
	static std::string NormalizePrefix(std::string sUrl);

	// An empty sAuthorization removes the portal's header
	void Set(const std::string& sPortal, const std::string& sAuthorization);

	// Header for a request to sUrl. sInitiator is the origin of the page that started
	// the request (CEF's request_initiator), empty for navigations the app starts
	// itself. Only the portal's own pages and the app get the header, so other pages,
	// including about:blank, about:srcdoc and data: frames they create, can't make
	// credentialed requests to the portal.
	std::string Get(const std::string& sUrl, const std::string& sInitiator) const;

	// Whether a request to sUrl carries a portal's header it must not have, e.g.
	// after a redirect to another host
	bool IsMisplaced(const std::string& sUrl, const std::string& sAuthorization) const;

	bool IsEmpty() const;

private:
	mutable std::mutex m_oMutex;
	std::map<std::string, std::string> m_mapAuth; // portal prefix -> header
};

#endif // PORTAL_AUTHORIZATION_H
