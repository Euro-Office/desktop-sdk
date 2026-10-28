# SPDX-FileCopyrightText: 2026 Euro-Office contributors
# SPDX-License-Identifier: AGPL-3.0-only

# desktop-sdk unit tests. Reached from ../CMakeLists.txt when EO_BUILD_TESTS
# is ON; every suite is a GoogleTest executable registered with CTest through
# add_core_gtest() from core/common.cmake. See README.md.

# Code under test that doesn't need CEF is compiled into each suite directly,
# as core's suites do, instead of linking ascdocumentscore (see README.md).
set(SDK_SRC "${CMAKE_CURRENT_LIST_DIR}/../src")

add_core_gtest(
    NAME    ascdocumentscore_setup_test
    SOURCES ${CMAKE_CURRENT_LIST_DIR}/setup_test.cpp
    LIBS    kernel
    GTEST_MAIN
)

# crypto_mode.cpp includes aes256.cpp itself
add_core_gtest(
    NAME    ascdocumentscore_crypto_test
    SOURCES ${CMAKE_CURRENT_LIST_DIR}/crypto_test.cpp ${SDK_SRC}/crypto_mode.cpp
    LIBS    kernel
    GTEST_MAIN
)
