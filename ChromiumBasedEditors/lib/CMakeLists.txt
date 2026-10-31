cmake_minimum_required(VERSION 3.17)
project(AscDocumentScoreProject LANGUAGES CXX C)

# ==============================================================================
# Global Variables and Options
# ==============================================================================

# Define external paths
set(CORE_ROOT_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../../../core")
set(CORE_BUILDS_BINARY_PATH "${CMAKE_CURRENT_BINARY_DIR}/bin")
set(CORE_BUILDS_LIBRARIES_PATH "${CMAKE_CURRENT_BINARY_DIR}/lib")
set(CORE_BUILDS_PLATFORM_PREFIX "linux_64")

include(${CORE_ROOT_DIR}/common.cmake)

# Options mapped from QMake CONFIG and DEFINES
option(DISABLE_PROTECTION "Disable protection feature" OFF)
option(DISABLE_SIGNATURES "Disable signatures feature" OFF)

# CEF headers and the libcef_dll wrapper come from the binary distribution
# (CEF_ROOT, set up in core/common.cmake). Only the cefclient sample code we
# build on is vendored here, see src/cef/README.md.
set(CEF_SAMPLES_PATH "${CMAKE_CURRENT_SOURCE_DIR}/src/cef")

# ==============================================================================
# Target: ascdocumentscore (Plugin / Shared Library)
# ==============================================================================


if(NOT TARGET kernel)
    add_subdirectory(${CORE_ROOT_DIR}/Common kernel)
endif()

if(NOT TARGET kernel_network)
    add_subdirectory(${CORE_ROOT_DIR}/Common/Network kernel_network)
endif()

if(NOT TARGET UnicodeConverter)
    add_subdirectory(${CORE_ROOT_DIR}/UnicodeConverter UnicodeConverter)
endif()

if(NOT TARGET CryptoPPLib)
    add_subdirectory(${CORE_ROOT_DIR}/Common/3dParty/cryptopp/project CryptoPPLib)
endif()

if(NOT TARGET CompoundFileLib)
    add_subdirectory(${CORE_ROOT_DIR}/Common/cfcpp CompoundFileLib)
endif()

if(NOT TARGET graphics)
    add_subdirectory(${CORE_ROOT_DIR}/DesktopEditor/graphics/cmake graphics)
endif()

if(NOT TARGET PdfFile)
    add_subdirectory(${CORE_ROOT_DIR}/PdfFile PdfFile)
endif()

if(NOT TARGET XpsFile)
    add_subdirectory(${CORE_ROOT_DIR}/XpsFile XpsFile)
endif()

if(NOT TARGET DjVuFile)
    add_subdirectory(${CORE_ROOT_DIR}/DjVuFile DjVuFile)
endif()

if(NOT TARGET doctrenderer)
    add_subdirectory(${CORE_ROOT_DIR}/DesktopEditor/doctrenderer doctrenderer)
endif()

if(NOT TARGET hunspell_wrapper)
    add_subdirectory(${CORE_ROOT_DIR}/Common/3dParty/hunspell/qt hunspell_wrapper)
endif()

if(NOT TARGET ooxmlsignature)
    add_subdirectory(${CORE_ROOT_DIR}/DesktopEditor/xmlsec/src ooxmlsignature)
endif()

# Pulls in x2t itself plus everything it needs that this project doesn't already
# build (Fb2File, HtmlFile2, EpubFile, OFDFile, IWorkFile, HWPFile, StarMathConverter,
# and x2t's OOXML/MS-binary format libs). Uses the same if(NOT TARGET ...) guard
# pattern as everything above, so it safely skips kernel/PdfFile/etc. that are
# already defined here rather than redefining them.
if(NOT TARGET x2t)
    add_subdirectory(${CORE_ROOT_DIR}/X2tConverter/build/cmake x2t)
endif()


#find_package(hunspell REQUIRED)
find_path(HUNSPELL_INCLUDE_DIR NAMES hunspell/hunspell.h REQUIRED)
find_library(HUNSPELL_LIBRARY NAMES hunspell-1.7 hunspell REQUIRED)

# 2. Create a "Fake" Modern Target (Interface/Imported)
# This mimics what find_package would have done
if(HUNSPELL_INCLUDE_DIR AND HUNSPELL_LIBRARY)
    add_library(hunspell::libhunspell UNKNOWN IMPORTED)
    set_target_properties(hunspell::libhunspell PROPERTIES
        INTERFACE_INCLUDE_DIRECTORIES "${HUNSPELL_INCLUDE_DIR}"
        IMPORTED_LOCATION "${HUNSPELL_LIBRARY}"
    )
endif()

add_library(ascdocumentscore SHARED)
if(APPLE)
    set_target_properties(ascdocumentscore PROPERTIES
        FRAMEWORK TRUE
        MACOSX_FRAMEWORK_IDENTIFIER asc.euro-office.ascdocumentscore
        MACOSX_FRAMEWORK_BUNDLE_VERSION 1.0
        MACOSX_FRAMEWORK_SHORT_VERSION_STRING 1.0
    )
endif()

set_default_options(ascdocumentscore)

# CEF headers require C++20
target_compile_features(ascdocumentscore PRIVATE cxx_std_20)

# Core Definitions
target_compile_definitions(ascdocumentscore PRIVATE
    PDFFILE_USE_DYNAMIC_LIBRARY
    DJVU_USE_DYNAMIC_LIBRARY
    XPS_USE_DYNAMIC_LIBRARY
    DESKTOP_USE_DYNAMIC_LIBRARY_BUILDING
    CRYPTOPP_DISABLE_ASM
    UNICODE _UNICODE
    COMMON_OPENSSL_BUILDING_INTERNAL
)

if(NOT DISABLE_PROTECTION)
    target_compile_definitions(ascdocumentscore PRIVATE FEATURE_ENABLE_PROTECT)
endif()

if(NOT DISABLE_SIGNATURES)
    target_compile_definitions(ascdocumentscore PRIVATE FEATURE_ENABLE_SIGNATURE)
endif()

if(NOT APPLE)
    target_compile_definitions(ascdocumentscore PRIVATE DOCUMENTSCORE_OPENSSL_SUPPORT)
endif()

# CEF Extensions & Versions
target_compile_definitions(ascdocumentscore PRIVATE
    CEF_VERSION_ABOVE_86
    CEF_VERSION_ABOVE_102
    OVERRIDE=override
)

# Platform Specific Definitions
if(APPLE)
    target_compile_definitions(ascdocumentscore PRIVATE _XCODE)
endif()

if(UNIX AND NOT APPLE)
    target_compile_definitions(ascdocumentscore PRIVATE _LINUX LINUX OS_LINUX _X11)
endif()

# CEF Base Definitions
target_compile_definitions(ascdocumentscore PRIVATE
    __STD_C USING_CEF_SHARED NDEBUG NO_CSR
)

# Core Library Includes
target_include_directories(ascdocumentscore PRIVATE
    #"${EO_CORE_3RD_PARTY_WORK_DIR}/hunspell/src"
    "${CMAKE_CURRENT_SOURCE_DIR}/include"
    "${CMAKE_CURRENT_SOURCE_DIR}/src"
    "${CMAKE_CURRENT_SOURCE_DIR}/tools"
    "${CMAKE_CURRENT_SOURCE_DIR}/tools/functions/internal"
    "${CEF_ROOT}"
    "${CEF_SAMPLES_PATH}"
    "${ICU_DESKTOP_INSTALL_DIR_ABS}/include"
    "${CORE_ROOT_DIR}/Common/3dParty/openssl/common"
    "${OPENSSL_INSTALL_DIR}/include"
)

# ------------------------------------------------------------------------------
# Source Files (ascdocumentscore)
# ------------------------------------------------------------------------------
set(ASCDOCUMENTSCORE_HEADERS
    "${CMAKE_CURRENT_SOURCE_DIR}/src/cookiesworker.h"
    "${CMAKE_CURRENT_SOURCE_DIR}/src/cefwrapper/client_app.h"
    "${CMAKE_CURRENT_SOURCE_DIR}/src/cefwrapper/client_renderer.h"
    "${CMAKE_CURRENT_SOURCE_DIR}/src/cefwrapper/client_renderer_params.h"
    "${CMAKE_CURRENT_SOURCE_DIR}/src/cefwrapper/client_scheme.h"
    "${CMAKE_CURRENT_SOURCE_DIR}/src/fileconverter.h"
    "${CMAKE_CURRENT_SOURCE_DIR}/src/x2t.h"
    "${CMAKE_CURRENT_SOURCE_DIR}/src/templatesmanager.h"
    "${CMAKE_CURRENT_SOURCE_DIR}/src/cefwrapper/client_resource_handler_async.h"
    "${CMAKE_CURRENT_SOURCE_DIR}/src/window_handle.h"
    "${CMAKE_CURRENT_SOURCE_DIR}/include/base.h"
    "${CMAKE_CURRENT_SOURCE_DIR}/include/applicationmanager.h"
    "${CMAKE_CURRENT_SOURCE_DIR}/include/keyboardchecker.h"
    "${CMAKE_CURRENT_SOURCE_DIR}/include/spellchecker.h"
    "${CMAKE_CURRENT_SOURCE_DIR}/include/cefapplication.h"
    "${CMAKE_CURRENT_SOURCE_DIR}/include/cefview.h"
    "${CMAKE_CURRENT_SOURCE_DIR}/include/applicationmanager_events.h"
    "${CMAKE_CURRENT_SOURCE_DIR}/src/applicationmanager_p.h"
    "${CMAKE_CURRENT_SOURCE_DIR}/src/filelocker.h"
    #"${CMAKE_CURRENT_SOURCE_DIR}/src/nativeviewer.h"
    "${CMAKE_CURRENT_SOURCE_DIR}/src/plugins.h"
    "${CMAKE_CURRENT_SOURCE_DIR}/src/providers.h"
    "${CMAKE_CURRENT_SOURCE_DIR}/src/cloud_crypto.h"
    "${CMAKE_CURRENT_SOURCE_DIR}/src/crypto_mode.h"
    "${CMAKE_CURRENT_SOURCE_DIR}/include/keychain.h"
    "${CMAKE_CURRENT_SOURCE_DIR}/src/utils.h"
    "${CMAKE_CURRENT_SOURCE_DIR}/src/cefwrapper/external_process.h"
)

set(ASCDOCUMENTSCORE_SOURCES
    "${CMAKE_CURRENT_SOURCE_DIR}/src/additional/create.cpp"
    "${CMAKE_CURRENT_SOURCE_DIR}/src/cefwrapper/client_scheme_wrapper.cpp"
    "${CMAKE_CURRENT_SOURCE_DIR}/src/cefwrapper/client_renderer_wrapper.cpp"
    "${CMAKE_CURRENT_SOURCE_DIR}/src/cefwrapper/client_resource_handler_async.cpp"
    "${CMAKE_CURRENT_SOURCE_DIR}/src/applicationmanager.cpp"
    "${CMAKE_CURRENT_SOURCE_DIR}/src/keyboardchecker.cpp"
    "${CMAKE_CURRENT_SOURCE_DIR}/src/spellchecker.cpp"
    "${CMAKE_CURRENT_SOURCE_DIR}/src/cefapplication.cpp"
    "${CMAKE_CURRENT_SOURCE_DIR}/src/cefview.cpp"
    "${CMAKE_CURRENT_SOURCE_DIR}/src/fileprinter.cpp"
    "${CMAKE_CURRENT_SOURCE_DIR}/src/crypto_mode.cpp"
    "${CMAKE_CURRENT_SOURCE_DIR}/src/keychain.cpp"
    "${CMAKE_CURRENT_SOURCE_DIR}/src/filelocker.cpp"
    "${CORE_ROOT_DIR}/Common/OfficeFileFormatChecker2.cpp"
    "${CORE_ROOT_DIR}/Common/3dParty/pole/pole.cpp"
    "${CORE_ROOT_DIR}/OOXML/Base/unicode_util.cpp"
    "${CMAKE_CURRENT_SOURCE_DIR}/tools/tools.cpp"
    "${CORE_ROOT_DIR}/MsBinaryFile/DocFile/MemoryStream.cpp"
    "${CORE_ROOT_DIR}/MsBinaryFile/XlsFile/Format/Logging/Log.cpp"
    "${CORE_ROOT_DIR}/MsBinaryFile/XlsFile/Format/Logging/Logger.cpp"
    "${CORE_ROOT_DIR}/Common/3dParty/openssl/common/common_openssl.cpp"
)

# Non-Mac Sources
if(NOT APPLE)
    list(APPEND ASCDOCUMENTSCORE_SOURCES
        "${CMAKE_CURRENT_SOURCE_DIR}/src/window_handle.cpp"
        "${CMAKE_CURRENT_SOURCE_DIR}/src/keyboardlayout.cpp"
    )
endif()

# Mac Objective-C/C++ Sources
if(APPLE)
    target_include_directories(ascdocumentscore PRIVATE "${CORE_ROOT_DIR}/DesktopEditor/common/Mac")
    list(APPEND ASCDOCUMENTSCORE_SOURCES
        "${CMAKE_CURRENT_SOURCE_DIR}/src/widget_impl.mm"
        "${CMAKE_CURRENT_SOURCE_DIR}/src/mac_keyboardlayout.mm"
        "${CMAKE_CURRENT_SOURCE_DIR}/src/mac_application.mm"
        "${CMAKE_CURRENT_SOURCE_DIR}/src/mac_cefview.mm"
        "${CMAKE_CURRENT_SOURCE_DIR}/src/mac_cefviewmedia.mm"
        "${CMAKE_CURRENT_SOURCE_DIR}/src/window_handle.mm"
        "${CORE_ROOT_DIR}/DesktopEditor/common/Mac/NSString+StringUtils.mm"
        "${CMAKE_CURRENT_SOURCE_DIR}/src/mac_videoplayer/footerpanel.mm"
        "${CMAKE_CURRENT_SOURCE_DIR}/src/mac_videoplayer/subpanel.mm"
        "${CMAKE_CURRENT_SOURCE_DIR}/src/mac_videoplayer/iconpushbutton.mm"
        "${CMAKE_CURRENT_SOURCE_DIR}/src/mac_videoplayer/playerview.mm"
        "${CMAKE_CURRENT_SOURCE_DIR}/src/mac_videoplayer/playercontroller.mm"
        "${CMAKE_CURRENT_SOURCE_DIR}/src/mac_videoplayer/slider.mm"
        "${CMAKE_CURRENT_SOURCE_DIR}/src/mac_videoplayer/videoview.mm"
        "${CMAKE_CURRENT_SOURCE_DIR}/src/mac_videoplayer/utils.mm"
        "${CMAKE_CURRENT_SOURCE_DIR}/src/mac_videoplayer/timelabel.mm"
        "${CMAKE_CURRENT_SOURCE_DIR}/src/mac_videoplayer/footerskin.mm"
    )

    # Mac Bundle Resources
    file(GLOB PLAYER_BUTTON_ICONS "${CMAKE_CURRENT_SOURCE_DIR}/../videoplayerlib/icons/*")
    set_source_files_properties(${PLAYER_BUTTON_ICONS} PROPERTIES MACOSX_PACKAGE_LOCATION Resources)
    list(APPEND ASCDOCUMENTSCORE_SOURCES ${PLAYER_BUTTON_ICONS})
endif()

# Windows Sources
if(WIN32)
    list(APPEND ASCDOCUMENTSCORE_SOURCES
        "${CMAKE_CURRENT_SOURCE_DIR}/src/cefwrapper/monitor_info.cpp"
    )
endif()


# ------------------------------------------------------------------------------
# CEF wrapper (libcef_dll_wrapper from the binary distribution)
# ------------------------------------------------------------------------------
if(NOT TARGET libcef_dll_wrapper)
    add_subdirectory("${CEF_LIBCEF_DLL_WRAPPER_PATH}" libcef_dll_wrapper)
endif()

# ------------------------------------------------------------------------------
# CEF Client Sources
# ------------------------------------------------------------------------------
    list(APPEND ASCDOCUMENTSCORE_HEADERS
    "${CEF_SAMPLES_PATH}/tests/shared/browser/client_app_browser.h"
    "${CEF_SAMPLES_PATH}/tests/shared/browser/file_util.h"
    "${CEF_SAMPLES_PATH}/tests/shared/browser/geometry_util.h"
    "${CEF_SAMPLES_PATH}/tests/shared/browser/main_message_loop.h"
    "${CEF_SAMPLES_PATH}/tests/shared/browser/main_message_loop_external_pump.h"
    "${CEF_SAMPLES_PATH}/tests/shared/browser/main_message_loop_std.h"
    "${CEF_SAMPLES_PATH}/tests/shared/browser/resource_util.h"
    "${CEF_SAMPLES_PATH}/tests/shared/common/binary_value_utils.h"
    "${CEF_SAMPLES_PATH}/tests/shared/common/client_app.h"
    "${CEF_SAMPLES_PATH}/tests/shared/common/client_app_other.h"
    "${CEF_SAMPLES_PATH}/tests/shared/common/client_switches.h"
    "${CEF_SAMPLES_PATH}/tests/shared/common/string_util.h"
    "${CEF_SAMPLES_PATH}/tests/shared/renderer/client_app_renderer.h"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/binding_test.h"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/browser_window.h"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/bytes_write_handler.h"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/client_browser.h"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/client_handler.h"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/client_handler_std.h"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/client_prefs.h"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/client_types.h"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/dialog_test.h"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/image_cache.h"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/main_context.h"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/main_context_impl.h"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/media_router_test.h"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/preferences_test.h"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/resource.h"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/response_filter_test.h"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/root_window.h"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/root_window_manager.h"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/root_window_views.h"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/scheme_test.h"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/server_test.h"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/temp_window.h"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/test_runner.h"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/urlrequest_test.h"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/views_menu_bar.h"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/views_overlay_controls.h"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/views_style.h"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/views_window.h"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/window_test.h"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/window_test_runner.h"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/window_test_runner_views.h"
    "${CEF_SAMPLES_PATH}/tests/cefclient/common/scheme_test_common.h"
    "${CEF_SAMPLES_PATH}/tests/cefclient/renderer/client_renderer.h"
    "${CEF_SAMPLES_PATH}/tests/cefclient/renderer/ipc_performance_test.h"
    "${CEF_SAMPLES_PATH}/tests/cefclient/renderer/performance_test.h"
    "${CEF_SAMPLES_PATH}/tests/cefclient/renderer/performance_test_setup.h"
    )

list(APPEND ASCDOCUMENTSCORE_SOURCES
    "${CEF_SAMPLES_PATH}/tests/shared/browser/client_app_browser.cc"
    "${CEF_SAMPLES_PATH}/tests/shared/browser/file_util.cc"
    "${CEF_SAMPLES_PATH}/tests/shared/browser/geometry_util.cc"
    "${CEF_SAMPLES_PATH}/tests/shared/browser/main_message_loop.cc"
    "${CEF_SAMPLES_PATH}/tests/shared/browser/main_message_loop_external_pump.cc"
    "${CEF_SAMPLES_PATH}/tests/shared/browser/main_message_loop_std.cc"
    "${CEF_SAMPLES_PATH}/tests/shared/common/binary_value_utils.cc"
    "${CEF_SAMPLES_PATH}/tests/shared/common/client_app.cc"
    "${CEF_SAMPLES_PATH}/tests/shared/common/client_app_other.cc"
    "${CEF_SAMPLES_PATH}/tests/shared/common/client_switches.cc"
    "${CEF_SAMPLES_PATH}/tests/shared/common/string_util.cc"
    "${CEF_SAMPLES_PATH}/tests/shared/renderer/client_app_renderer.cc"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/binding_test.cc"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/browser_window.cc"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/bytes_write_handler.cc"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/client_app_delegates_browser.cc"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/client_browser.cc"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/client_handler.cc"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/client_handler_std.cc"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/client_prefs.cc"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/dialog_test.cc"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/image_cache.cc"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/main_context.cc"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/main_context_impl.cc"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/media_router_test.cc"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/preferences_test.cc"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/response_filter_test.cc"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/root_window.cc"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/root_window_create.cc"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/root_window_manager.cc"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/root_window_views.cc"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/scheme_test.cc"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/server_test.cc"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/test_runner.cc"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/urlrequest_test.cc"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/views_menu_bar.cc"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/views_overlay_controls.cc"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/views_style.cc"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/views_window.cc"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/window_test.cc"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/window_test_runner.cc"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/window_test_runner_views.cc"
    "${CEF_SAMPLES_PATH}/tests/cefclient/common/scheme_test_common.cc"
    "${CEF_SAMPLES_PATH}/tests/cefclient/renderer/client_renderer.cc"
    "${CEF_SAMPLES_PATH}/tests/cefclient/renderer/ipc_performance_test.cc"
    "${CEF_SAMPLES_PATH}/tests/cefclient/renderer/performance_test.cc"
    "${CEF_SAMPLES_PATH}/tests/cefclient/renderer/performance_test_tests.cc"
)

if(WIN32)
    list(APPEND ASCDOCUMENTSCORE_SOURCES
        "${CEF_SAMPLES_PATH}/tests/shared/browser/main_message_loop_external_pump_win.cc"
        "${CEF_SAMPLES_PATH}/tests/shared/browser/resource_util_win.cc"
        "${CEF_SAMPLES_PATH}/tests/shared/browser/util_win.cc"
        "${CEF_SAMPLES_PATH}/tests/cefclient/browser/browser_window_std_win.cc"
        "${CEF_SAMPLES_PATH}/tests/cefclient/browser/main_context_impl_win.cc"
        "${CEF_SAMPLES_PATH}/tests/cefclient/browser/main_message_loop_multithreaded_win.cc"
        "${CEF_SAMPLES_PATH}/tests/cefclient/browser/resource_util_win_idmap.cc"
        "${CEF_SAMPLES_PATH}/tests/cefclient/browser/root_window_win.cc"
        "${CEF_SAMPLES_PATH}/tests/cefclient/browser/temp_window_win.cc"
        "${CEF_SAMPLES_PATH}/tests/cefclient/browser/window_test_runner_win.cc"
    )
    list(APPEND ASCDOCUMENTSCORE_HEADERS
    "${CEF_SAMPLES_PATH}/tests/shared/browser/util_win.h"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/browser_window_std_win.h"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/main_message_loop_multithreaded_win.h"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/root_window_win.h"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/temp_window_win.h"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/window_test_runner_win.h"
    )
elseif(APPLE)
    list(APPEND ASCDOCUMENTSCORE_SOURCES
        "${CEF_SAMPLES_PATH}/tests/shared/browser/resource_util_posix.cc"
        "${CEF_SAMPLES_PATH}/tests/cefclient/browser/main_context_impl_posix.cc"
        "${CEF_SAMPLES_PATH}/tests/shared/browser/main_message_loop_external_pump_mac.mm"
        "${CEF_SAMPLES_PATH}/tests/shared/browser/resource_util_mac.mm"
        "${CEF_SAMPLES_PATH}/tests/cefclient/browser/browser_window_std_mac.mm"
        "${CEF_SAMPLES_PATH}/tests/cefclient/browser/root_window_mac.mm"
        "${CEF_SAMPLES_PATH}/tests/cefclient/browser/temp_window_mac.mm"
        "${CEF_SAMPLES_PATH}/tests/cefclient/browser/window_test_runner_mac.mm"
    )
    list(APPEND ASCDOCUMENTSCORE_HEADERS
        "${CEF_SAMPLES_PATH}/tests/cefclient/browser/browser_window_std_mac.h"
        "${CEF_SAMPLES_PATH}/tests/cefclient/browser/root_window_mac.h"
        "${CEF_SAMPLES_PATH}/tests/cefclient/browser/temp_window_mac.h"
        "${CEF_SAMPLES_PATH}/tests/cefclient/browser/window_test_runner_mac.h"
    )
else() # Linux
    list(APPEND ASCDOCUMENTSCORE_SOURCES
        "${CEF_SAMPLES_PATH}/tests/shared/browser/main_message_loop_external_pump_linux.cc"
        "${CEF_SAMPLES_PATH}/tests/shared/browser/resource_util_posix.cc"
        "${CEF_SAMPLES_PATH}/tests/cefclient/browser/browser_window_std_gtk.cc"
        "${CEF_SAMPLES_PATH}/tests/cefclient/browser/dialog_handler_gtk.cc"
        "${CEF_SAMPLES_PATH}/tests/cefclient/browser/main_context_impl_posix.cc"
        "${CEF_SAMPLES_PATH}/tests/cefclient/browser/main_message_loop_multithreaded_gtk.cc"
        "${CEF_SAMPLES_PATH}/tests/cefclient/browser/resource_util_linux.cc"
        "${CEF_SAMPLES_PATH}/tests/cefclient/browser/root_window_gtk.cc"
        "${CEF_SAMPLES_PATH}/tests/cefclient/browser/temp_window_x11.cc"
        "${CEF_SAMPLES_PATH}/tests/cefclient/browser/util_gtk.cc"
        "${CEF_SAMPLES_PATH}/tests/cefclient/browser/window_test_runner_gtk.cc"
    )
    list(APPEND ASCDOCUMENTSCORE_HEADERS
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/browser_window_std_gtk.h"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/dialog_handler_gtk.h"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/main_message_loop_multithreaded_gtk.h"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/root_window_gtk.h"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/temp_window_x11.h"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/util_gtk.h"
    "${CEF_SAMPLES_PATH}/tests/cefclient/browser/window_test_runner_gtk.h"
    )
endif()


message(STATUS "SRC COUNT: ${ASCDOCUMENTSCORE_SOURCES}")
message(STATUS "HDR COUNT: ${ASCDOCUMENTSCORE_HEADERS}")


target_sources(ascdocumentscore PRIVATE ${ASCDOCUMENTSCORE_HEADERS} ${ASCDOCUMENTSCORE_SOURCES})

# ------------------------------------------------------------------------------
# Linking & Libraries (ascdocumentscore)
# ------------------------------------------------------------------------------

# Add Crypto & Compound dependencies
target_link_directories(ascdocumentscore PRIVATE "${CORE_BUILDS_LIBRARIES_PATH}"
    $<$<CONFIG:Debug>:${CEF_ROOT}/Debug>
    $<$<NOT:$<CONFIG:Debug>>:${CEF_ROOT}/Release>
)

if(APPLE)
    target_link_options(ascdocumentscore PRIVATE
        $<$<CONFIG:Debug>:-F${CEF_ROOT}/Debug>
        $<$<NOT:$<CONFIG:Debug>>:-F${CEF_ROOT}/Release>
    )
endif()

# Boost and ICU
target_link_libraries(ascdocumentscore PRIVATE libcef_dll_wrapper)

target_link_libraries(ascdocumentscore PUBLIC
                    hunspell::libhunspell
                    Boost::system
                    Boost::filesystem
                    Boost::regex
                    Boost::date_time
                    CryptoPPLib
                    CompoundFileLib
                    graphics kernel UnicodeConverter kernel_network
                    PdfFile XpsFile DjVuFile hunspell_wrapper ooxmlsignature doctrenderer
                    ${LIBICUUC_DESKTOP}
                    ${LIBICUDATA_DESKTOP}
                    ${LIBICUI_DESKTOP}
                    ${OPENSSL_LIBSSL}
                    ${OPENSSL_LIBCRYPTO}
)


if(WIN32)
    target_compile_definitions(ascdocumentscore PRIVATE NOMINMAX _WINDOWS WIN32)
    # target_link_directories(ascdocumentscore PRIVATE "${CORE_ROOT_DIR}/Common/3dParty/cef/${CORE_BUILDS_PLATFORM_PREFIX}/build") # dead code?
    target_link_libraries(ascdocumentscore PRIVATE
        libcef wininet dnsapi version msimg32 ws2_32 usp10 psapi
        dbghelp winmm shlwapi kernel32 gdi32 winspool comdlg32
        advapi32 shell32 ole32 oleaut32 user32 uuid odbc32
        odbccp32 delayimp credui netapi32 comctl32 rpcrt4 gdiplus
        Urlmon OpenGL32 Crypt32 Imm32
    )
elseif(APPLE)
    # target_link_options(ascdocumentscore PRIVATE -F"${CORE_ROOT_DIR}/Common/3dParty/cef/${CORE_BUILDS_PLATFORM_PREFIX}/build")
    target_link_libraries(ascdocumentscore PRIVATE
        "-framework Security"
        "-framework AVFoundation"
        "-framework CoreMedia"
        "-framework Carbon"
        "-framework AppKit"
        "-framework OpenGL"
        "-framework \"Chromium Embedded Framework\""
    )
else() # Linux
    find_package(PkgConfig REQUIRED)
    pkg_check_modules(GTK REQUIRED glib-2.0 gtk+-3.0 atk)

    target_compile_options(ascdocumentscore PRIVATE -fPIC)
    
    # RPATH & Linker options
    target_link_options(ascdocumentscore PRIVATE "-Wl,-rpath,$ORIGIN" "-Wl,-rpath,$ORIGIN/converter" "-Wl,--disable-new-dtags")
    
    target_include_directories(ascdocumentscore PRIVATE ${GTK_INCLUDE_DIRS})
    target_link_libraries(ascdocumentscore PRIVATE
        cef ${GTK_LIBRARIES} X11 X11-xcb xkbcommon-x11 xkbcommon
    )
endif()

# ==============================================================================
# Target: editors_helper (Executable)
# ==============================================================================

include(${CORE_ROOT_DIR}/OfficeUtils/CMakeLists.txt)

add_executable(editors_helper "${CMAKE_CURRENT_SOURCE_DIR}/helper_main.cpp" ${CORE_ROOT_DIR}/Common/3dParty/openssl/common/common_openssl.cpp)

set_default_options(editors_helper)

if(WIN32)
    set_target_properties(editors_helper PROPERTIES WIN32_EXECUTABLE TRUE)
    target_link_options(editors_helper PRIVATE "/ENTRY:mainCRTStartup")
endif()

add_officeutils(editors_helper ${CORE_ROOT_DIR}/OfficeUtils)

target_link_directories(editors_helper PRIVATE
    $<$<CONFIG:Debug>:${CEF_ROOT}/Debug>
    $<$<NOT:$<CONFIG:Debug>>:${CEF_ROOT}/Release>
)

target_link_libraries(editors_helper PUBLIC 
    ascdocumentscore
    Boost::system
    Boost::filesystem
    Boost::regex
    Boost::date_time
    ${OPENSSL_LIBSSL}
    ${OPENSSL_LIBCRYPTO}
)

target_include_directories(editors_helper PRIVATE
    ${OPENSSL_INSTALL_DIR}/include
    ${CORE_ROOT_DIR}/Common/3dParty/openssl/common
)

# Output directory routing based on BUILD_XP flag
set_target_properties(editors_helper PROPERTIES RUNTIME_OUTPUT_DIRECTORY "${CORE_BUILDS_BINARY_PATH}")

target_compile_definitions(editors_helper PRIVATE COMMON_OPENSSL_BUILDING_INTERNAL)

if(WIN32)
    target_sources(editors_helper PRIVATE "${CMAKE_CURRENT_SOURCE_DIR}/helper.exe.manifest")
    
    target_link_libraries(editors_helper PUBLIC ws2_32 crypt32 user32 advapi32 libcef)

    target_compile_definitions(editors_helper PRIVATE WIN32 _WINDOWS)

elseif(LINUX)
    target_compile_definitions(editors_helper PRIVATE _LINUX LINUX OS_LINUX _X11)
    target_link_options(editors_helper PRIVATE 
        "-Wl,-rpath,$ORIGIN" 
        "-Wl,-rpath,$ORIGIN/converter"
        #"-Wl,-unresolved-symbols=ignore-in-shared-libs"
    )
    # Extra Linux dependencies defined in ascdocumentscore_helper.pro
    target_link_libraries(editors_helper PRIVATE 
        graphics kernel kernel_network UnicodeConverter cef
    )
elseif(APPLE)
    target_link_options(editors_helper PRIVATE
        $<$<CONFIG:Debug>:-F${CEF_ROOT}/Debug>
        $<$<NOT:$<CONFIG:Debug>>:-F${CEF_ROOT}/Release>
    )
    target_link_libraries(editors_helper PRIVATE
        "-framework Security"
        "-framework AVFoundation"
        "-framework CoreMedia"
        "-framework Carbon"
        "-framework AppKit"
        "-framework OpenGL"
        "-framework \"Chromium Embedded Framework\""
        graphics kernel kernel_network UnicodeConverter
    )
endif()

if(APPLE)
    function(configure_cef_helper_plist bundle_name bundle_id_suffix)
        set(EXECUTABLE_NAME "${bundle_name}")
        set(PRODUCT_NAME "${bundle_name}")
        set(BUNDLE_ID_SUFFIX "${bundle_id_suffix}")
        set(VERSION_SHORT "1.0")
        configure_file("${CEF_SAMPLES_PATH}/tests/cefsimple/mac/helper-Info.plist"
                       "${CMAKE_CURRENT_BINARY_DIR}/helper-plists/${bundle_name}-Info.plist")
    endfunction()

    configure_cef_helper_plist("editors_helper" "")
    configure_cef_helper_plist("editors_helper (GPU)" ".GPU")
    configure_cef_helper_plist("editors_helper (Renderer)" ".Renderer")

    # EO_CORE_OUTPUT_DIR is where x2t/converters/ICU land (via each library's own
    # copy_artifacts_to_folder() call) — point it at "<staging-root>/converter"
    # when configuring so that lines up with what the Xcode scripts expect.
    # The staging root itself (this bundle-packaging step's output) is that
    # directory's parent.
    get_filename_component(MAC_STAGE_DIR "${EO_CORE_OUTPUT_DIR}" DIRECTORY)

    add_custom_command(TARGET editors_helper POST_BUILD
        COMMAND bash "${CMAKE_CURRENT_SOURCE_DIR}/package_mac_helpers.sh"
                "$<TARGET_FILE:editors_helper>"
                "${CMAKE_CURRENT_BINARY_DIR}/helper-plists"
                "${MAC_STAGE_DIR}"
                "${EO_CORE_3RD_PARTY_INSTALL_DIR}/icu/lib"
                "$<TARGET_BUNDLE_DIR:ascdocumentscore>"
                "$<TARGET_BUNDLE_DIR:ooxmlsignature>"
                "${CEF_ROOT}/$<IF:$<CONFIG:Debug>,Debug,Release>/Chromium Embedded Framework.framework"
                "$<TARGET_FILE:kernel>"
                "$<TARGET_FILE:kernel_network>"
                "$<TARGET_FILE:graphics>"
                "$<TARGET_FILE:PdfFile>"
                "$<TARGET_FILE:XpsFile>"
                "$<TARGET_FILE:DjVuFile>"
                "$<TARGET_FILE:doctrenderer>"
                "$<TARGET_FILE:DocxRenderer>"
                "$<TARGET_FILE:UnicodeConverter>"
        COMMENT "Packaging CEF helper .app bundles"
    )
endif()
