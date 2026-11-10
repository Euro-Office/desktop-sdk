/*
 * SPDX-FileCopyrightText: 2026 Euro-Office contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

#include "portalauthorization.h"

namespace
{
	// "https://cloud.example.com/nc/" -> "https://cloud.example.com"
	std::string Origin(const std::string& sPrefix)
	{
		std::string::size_type nHostEnd = sPrefix.find('/', sPrefix.find("://") + 3);
		return sPrefix.substr(0, nHostEnd);
	}

	// A request URL without query and fragment, normalized like a portal prefix
	std::string RequestPrefix(const std::string& sUrl)
	{
		return CPortalAuthorization::NormalizePrefix(sUrl.substr(0, sUrl.find_first_of("?#")));
	}

	bool StartsWith(const std::string& s, const std::string& sPrefix)
	{
		return 0 == s.compare(0, sPrefix.length(), sPrefix);
	}
}

std::string CPortalAuthorization::NormalizePrefix(std::string sUrl)
{
	std::string::size_type nSchemeEnd = sUrl.find("://");
	if (nSchemeEnd == std::string::npos || nSchemeEnd == 0)
		return "";

	std::string::size_type nHostEnd = sUrl.find('/', nSchemeEnd + 3);
	if (nHostEnd == std::string::npos)
		nHostEnd = sUrl.length();
	if (nHostEnd == nSchemeEnd + 3)
		return "";
	for (std::string::size_type i = 0; i < nHostEnd; ++i)
		sUrl[i] = (char)tolower((unsigned char)sUrl[i]);

	if (sUrl.back() != '/')
		sUrl += '/';
	return sUrl;
}

void CPortalAuthorization::Set(const std::string& sPortal, const std::string& sAuthorization)
{
	std::string sPrefix = NormalizePrefix(sPortal);
	if (sPrefix.empty())
		return;

	std::lock_guard<std::mutex> oLock(m_oMutex);
	if (sAuthorization.empty())
		m_mapAuth.erase(sPrefix);
	else
		m_mapAuth[sPrefix] = sAuthorization;
}

std::string CPortalAuthorization::Get(const std::string& sUrl, const std::string& sInitiator) const
{
	std::string sUrlNorm = RequestPrefix(sUrl);
	std::string sInitiatorLower = sInitiator;
	for (char& c : sInitiatorLower)
		c = (char)tolower((unsigned char)c);

	std::lock_guard<std::mutex> oLock(m_oMutex);
	for (const auto& oPortal : m_mapAuth)
	{
		if (!StartsWith(sUrlNorm, oPortal.first))
			continue;
		if (!sInitiatorLower.empty() && sInitiatorLower != Origin(oPortal.first))
			continue;
		return oPortal.second;
	}
	return "";
}

bool CPortalAuthorization::IsMisplaced(const std::string& sUrl, const std::string& sAuthorization) const
{
	std::string sUrlNorm = RequestPrefix(sUrl);

	std::lock_guard<std::mutex> oLock(m_oMutex);
	bool bIsOwn = false;
	for (const auto& oPortal : m_mapAuth)
	{
		if (oPortal.second != sAuthorization)
			continue;
		if (StartsWith(sUrlNorm, oPortal.first))
			return false;
		bIsOwn = true;
	}
	return bIsOwn;
}

bool CPortalAuthorization::IsEmpty() const
{
	std::lock_guard<std::mutex> oLock(m_oMutex);
	return m_mapAuth.empty();
}
