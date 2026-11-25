/*
 * SPDX-FileCopyrightText: 2026 Euro-Office contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

#include "simplerequest.h"
#include "portalauthorization.h"

namespace
{
	void ReplaceAll(std::string& s, const std::string& sFrom, const std::string& sTo)
	{
		for (std::string::size_type pos = s.find(sFrom); pos != std::string::npos; pos = s.find(sFrom, pos + sTo.length()))
			s.replace(pos, sFrom.length(), sTo);
	}

	std::string Lower(std::string s)
	{
		for (char& c : s)
			c = (char)tolower((unsigned char)c);
		return s;
	}

	bool HasParam(const std::string& sParams, const std::string& sName)
	{
		std::string::size_type start = 0;
		while (start <= sParams.length())
		{
			std::string::size_type end = sParams.find(',', start);
			if (end == std::string::npos)
				end = sParams.length();
			if (sParams.compare(start, end - start, sName) == 0)
				return true;
			start = end + 1;
		}
		return false;
	}
}

CSimpleRequestOptions::CSimpleRequestOptions(const std::string& sMethod, const std::string& sBody, bool bStartPage)
	: m_bStartPage(bStartPage)
{
	std::string sParams;
	std::string::size_type posParams = sMethod.find(':');
	Method = sMethod.substr(0, posParams);
	if (posParams != std::string::npos)
		sParams = sMethod.substr(posParams + 1);

	Progress = HasParam(sParams, "stream");
	IsFile = HasParam(sParams, "file");
	m_bAuth = HasParam(sParams, "auth");

	if ((IsFile || m_bAuth) && !bStartPage)
		Refused = true;

	// POST, as before, and WebDAV methods such as PROPFIND, SEARCH and PUT
	HasBody = !Refused && (IsFile || "POST" == Method || (!sBody.empty() && "GET" != Method && "HEAD" != Method));
}

std::string CSimpleRequestOptions::Authorization(const std::string& sUrl, const std::string& sHeader,
												 const CPortalAuthorization& oAuth) const
{
	if (!m_bStartPage || !m_bAuth || !sHeader.empty())
		return "";
	// as for requests the app makes itself (no initiator)
	return oAuth.Get(sUrl, "");
}

std::string NSSimpleRequest::EscapeJs(std::string s)
{
	ReplaceAll(s, "\\", "\\\\");
	ReplaceAll(s, "\"", "\\\"");
	ReplaceAll(s, "\n", "\\n");
	ReplaceAll(s, "\r", "\\r");
	// line terminators in JavaScript, also inside strings before ES2019
	ReplaceAll(s, "\xE2\x80\xA8", "\\u2028");
	ReplaceAll(s, "\xE2\x80\xA9", "\\u2029");
	return s;
}

std::string NSSimpleRequest::HeadersToJs(const std::vector<std::pair<std::string, std::string>>& arHeaders)
{
	std::string sResult = "{";
	bool bFirst = true;
	for (const auto& oHeader : arHeaders)
	{
		const std::string sName = Lower(oHeader.first);
		if (sName == "set-cookie")
			continue;
		if (!bFirst)
			sResult += ", ";
		bFirst = false;
		sResult += "\"" + EscapeJs(sName) + "\": \"" + EscapeJs(oHeader.second) + "\"";
	}
	return sResult + "}";
}
