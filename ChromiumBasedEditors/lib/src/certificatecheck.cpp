/*
 * SPDX-FileCopyrightText: 2026 Euro-Office contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// Kept apart from applicationmanager.cpp so it builds without CEF, for the
// unit tests in tests/.

#include "../include/applicationmanager.h"
#include "../../../../core/DesktopEditor/xmlsec/src/include/CertificateCommon.h"

static CertificateFileStatus ToCertificateFileStatus(int nResult)
{
	switch (nResult)
	{
	case OPEN_SSL_WARNING_OK:
		return CertificateFileStatus::Ok;
	case OPEN_SSL_WARNING_ALL_OK:
		return CertificateFileStatus::Complete;
	case OPEN_SSL_WARNING_PASS:
		return CertificateFileStatus::NeedPassword;
	default:
		return CertificateFileStatus::Unsupported;
	}
}

CertificateFileStatus CAscApplicationManager::CheckCertificateFile(const std::wstring& sFile, const std::string& sPassword)
{
	return ToCertificateFileStatus(NSOpenSSL::LoadCert(sFile, sPassword));
}

CertificateFileStatus CAscApplicationManager::CheckPrivateKeyFile(const std::wstring& sFile, const std::string& sPassword)
{
	return ToCertificateFileStatus(NSOpenSSL::LoadKey(sFile, sPassword));
}
