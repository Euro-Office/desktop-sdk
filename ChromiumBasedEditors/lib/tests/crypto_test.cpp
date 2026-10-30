/*
 * SPDX-FileCopyrightText: 2026 Euro-Office contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */

#include <gtest/gtest.h>
#include <cstring>
#include <map>
#include "../src/crypto_mode.h"
#include "../src/aes256.h"
#include "../../../../core/DesktopEditor/common/File.h"

// AES-256 (src/aes256.cpp) and the encrypted crypto-mode file that stores the
// user's encryption passwords (src/crypto_mode.cpp).

namespace {

ByteArray makeKey(unsigned char seed)
{
    ByteArray key(32);
    for (size_t i = 0; i < key.size(); ++i)
        key[i] = static_cast<unsigned char>(seed + i * 7);
    return key;
}

ByteArray makePlain(size_t length)
{
    ByteArray plain(length);
    for (size_t i = 0; i < length; ++i)
        plain[i] = static_cast<unsigned char>(i * 31 + 5);
    return plain;
}

NSAscCrypto::CCryptoKey makeCryptoKey(const ByteArray& bytes)
{
    NSAscCrypto::CCryptoKey key;
    key.len = static_cast<int>(bytes.size());
    key.data = new unsigned char[key.len];
    std::memcpy(key.data, bytes.data(), bytes.size());
    return key;
}

std::wstring tempFile()
{
    return NSFile::CFileBinary::CreateTempFileWithUniqueName(
        NSFile::CFileBinary::GetTempPath(), L"sdk_crypto_test");
}

} // namespace

class Aes256RoundTrip : public ::testing::TestWithParam<size_t> {};

TEST_P(Aes256RoundTrip, DecryptReturnsThePlainText)
{
    const ByteArray key = makeKey(1);
    const ByteArray plain = makePlain(GetParam());

    ByteArray encrypted;
    Aes256::encrypt(key, plain, encrypted);
    EXPECT_NE(encrypted, plain);

    ByteArray decrypted;
    Aes256::decrypt(key, encrypted, decrypted);
    EXPECT_EQ(decrypted, plain);
}

// Around the 16-byte block size, where padding changes.
INSTANTIATE_TEST_SUITE_P(Lengths, Aes256RoundTrip,
                         ::testing::Values(1, 15, 16, 17, 31, 32, 33, 1000));

TEST(Aes256, WrongKeyDoesNotRevealThePlainText)
{
    const ByteArray plain = makePlain(64);

    ByteArray encrypted;
    Aes256::encrypt(makeKey(1), plain, encrypted);

    ByteArray decrypted;
    Aes256::decrypt(makeKey(2), encrypted, decrypted);
    EXPECT_NE(decrypted, plain);
}

TEST(CryptoMode, SavedModesLoadBack)
{
    NSAscCrypto::CCryptoKey keyEnc = makeCryptoKey(makeKey(10));
    NSAscCrypto::CCryptoKey keyDec = makeCryptoKey(makeKey(20));

    std::map<NSAscCrypto::AscCryptoType, NSAscCrypto::CAscCryptoJsonValue> modes;
    modes[NSAscCrypto::Simple].m_eType = NSAscCrypto::Simple;
    modes[NSAscCrypto::Simple].m_sValue = "simple-password";
    modes[NSAscCrypto::Advanced].m_eType = NSAscCrypto::Advanced;
    modes[NSAscCrypto::Advanced].m_sValue = "advanced password with spaces";

    const std::wstring file = tempFile();
    ASSERT_FALSE(file.empty());
    NSAscCrypto::CCryptoMode().Save(keyEnc, keyDec, modes, file);

    NSAscCrypto::CCryptoMode loaded;
    loaded.Load(keyEnc, keyDec, file);
    NSFile::CFileBinary::Remove(file);

    ASSERT_EQ(loaded.m_modes.size(), 2u);
    // std::map saves them ordered by type
    EXPECT_EQ(loaded.m_modes[0].m_eType, NSAscCrypto::Simple);
    EXPECT_EQ(loaded.m_modes[0].m_sValue, "simple-password");
    EXPECT_EQ(loaded.m_modes[1].m_eType, NSAscCrypto::Advanced);
    EXPECT_EQ(loaded.m_modes[1].m_sValue, "advanced password with spaces");
}

TEST(CryptoMode, PasswordsAreNotStoredInPlainText)
{
    NSAscCrypto::CCryptoKey keyEnc = makeCryptoKey(makeKey(10));
    NSAscCrypto::CCryptoKey keyDec = makeCryptoKey(makeKey(20));

    std::map<NSAscCrypto::AscCryptoType, NSAscCrypto::CAscCryptoJsonValue> modes;
    modes[NSAscCrypto::Simple].m_eType = NSAscCrypto::Simple;
    modes[NSAscCrypto::Simple].m_sValue = "very-secret-password";

    const std::wstring file = tempFile();
    ASSERT_FALSE(file.empty());
    NSAscCrypto::CCryptoMode().Save(keyEnc, keyDec, modes, file);

    std::string content;
    EXPECT_TRUE(NSFile::CFileBinary::ReadAllTextUtf8A(file, content));
    NSFile::CFileBinary::Remove(file);

    EXPECT_EQ(content.find("very-secret-password"), std::string::npos);
}

TEST(CryptoMode, MissingFileLoadsNothing)
{
    NSAscCrypto::CCryptoKey keyEnc = makeCryptoKey(makeKey(10));
    NSAscCrypto::CCryptoKey keyDec = makeCryptoKey(makeKey(20));

    NSAscCrypto::CCryptoMode loaded;
    loaded.Load(keyEnc, keyDec, NSFile::CFileBinary::GetTempPath() + L"/does-not-exist.bin");
    EXPECT_TRUE(loaded.m_modes.empty());
}
