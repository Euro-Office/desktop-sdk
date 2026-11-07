/*
 * SPDX-FileCopyrightText: 2026 Euro-Office contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

#include <gtest/gtest.h>
#include <string>
#include "../include/applicationmanager.h"

// Checking certificate and private key files before signing
// (src/certificatecheck.cpp). The files in data/certificate are a throwaway
// self-signed certificate and its key, see data/certificate/README.md.

namespace {

std::wstring dataFile(const char* name)
{
    const std::string path = std::string(CERTIFICATE_TEST_DATA) + "/" + name;
    return std::wstring(path.begin(), path.end());
}

CertificateFileStatus checkCertificate(const char* name, const std::string& password = "")
{
    return CAscApplicationManager::CheckCertificateFile(dataFile(name), password);
}

CertificateFileStatus checkKey(const char* name, const std::string& password = "")
{
    return CAscApplicationManager::CheckPrivateKeyFile(dataFile(name), password);
}

} // namespace

TEST(CertificateCheckTest, PemAndDerCertificatesAreOk)
{
    EXPECT_EQ(checkCertificate("cert.pem"), CertificateFileStatus::Ok);
    EXPECT_EQ(checkCertificate("cert.der"), CertificateFileStatus::Ok);
}

TEST(CertificateCheckTest, UnencryptedKeyIsOk)
{
    EXPECT_EQ(checkKey("key.pem"), CertificateFileStatus::Ok);
}

TEST(CertificateCheckTest, EncryptedKeyNeedsTheRightPassword)
{
    EXPECT_EQ(checkKey("key_encrypted.pem"), CertificateFileStatus::NeedPassword);
    EXPECT_EQ(checkKey("key_encrypted.pem", "wrong"), CertificateFileStatus::NeedPassword);
    EXPECT_EQ(checkKey("key_encrypted.pem", "secret"), CertificateFileStatus::Ok);
}

TEST(CertificateCheckTest, Pkcs12HoldsCertificateAndKey)
{
    EXPECT_EQ(checkCertificate("cert_and_key.p12", "secret"), CertificateFileStatus::Complete);
    EXPECT_EQ(checkKey("cert_and_key.p12", "secret"), CertificateFileStatus::Complete);
}

TEST(CertificateCheckTest, Pkcs12NeedsTheRightPassword)
{
    EXPECT_EQ(checkCertificate("cert_and_key.p12", "wrong"), CertificateFileStatus::NeedPassword);
}

TEST(CertificateCheckTest, OtherFilesAreUnsupported)
{
    EXPECT_EQ(checkCertificate("not_a_certificate.txt"), CertificateFileStatus::Unsupported);
    EXPECT_EQ(checkKey("not_a_certificate.txt"), CertificateFileStatus::Unsupported);
    EXPECT_EQ(checkCertificate("missing.pem"), CertificateFileStatus::Unsupported);
    EXPECT_EQ(checkKey("missing.pem"), CertificateFileStatus::Unsupported);
}

TEST(CertificateCheckTest, KeyIsNotACertificate)
{
    EXPECT_EQ(checkCertificate("key.pem"), CertificateFileStatus::Unsupported);
}
