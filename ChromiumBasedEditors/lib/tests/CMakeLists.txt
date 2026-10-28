# SPDX-FileCopyrightText: 2026 Euro-Office contributors
# SPDX-License-Identifier: AGPL-3.0-only

# desktop-sdk unit tests. Reached from ../CMakeLists.txt when EO_BUILD_TESTS
# is ON; every suite is a GoogleTest executable registered with CTest through
# add_core_gtest() from core/common.cmake. See README.md.

add_core_gtest(
    NAME    ascdocumentscore_setup_test
    SOURCES ${CMAKE_CURRENT_LIST_DIR}/setup_test.cpp
    LIBS    kernel
    GTEST_MAIN
)
