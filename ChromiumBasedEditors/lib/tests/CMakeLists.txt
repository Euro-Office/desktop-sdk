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

# The Linux implementation (fcntl, GIO for files that aren't local); the
# Windows and macOS lockers are separate code paths.
if(UNIX AND NOT APPLE)
    add_core_gtest(
        NAME    ascdocumentscore_filelocker_test
        SOURCES ${CMAKE_CURRENT_LIST_DIR}/filelocker_test.cpp ${SDK_SRC}/filelocker.cpp
        LIBS    kernel ${GTK_LIBRARIES}
        GTEST_MAIN
    )
    target_include_directories(ascdocumentscore_filelocker_test PRIVATE ${GTK_INCLUDE_DIRS})
    target_compile_definitions(ascdocumentscore_filelocker_test PRIVATE _LINUX LINUX)
endif()

# The key and certificate files are in data/certificate
add_core_gtest(
    NAME    ascdocumentscore_certificatecheck_test
    SOURCES ${CMAKE_CURRENT_LIST_DIR}/certificatecheck_test.cpp ${SDK_SRC}/certificatecheck.cpp
    LIBS    kernel ooxmlsignature
    GTEST_MAIN
)
target_compile_definitions(ascdocumentscore_certificatecheck_test PRIVATE
    DESKTOP_NO_USE_DYNAMIC_LIBRARY
    CERTIFICATE_TEST_DATA="${CMAKE_CURRENT_LIST_DIR}/data/certificate")
