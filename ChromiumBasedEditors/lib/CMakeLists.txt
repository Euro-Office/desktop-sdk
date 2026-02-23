cmake_minimum_required(VERSION 3.17)
project(AscDocumentScoreProject LANGUAGES CXX C)

# ==============================================================================
# Global Variables and Options
# ==============================================================================

# Define external paths (adjust these as necessary for your environment)
set(CORE_ROOT_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../../../core")
set(CORE_BUILDS_BINARY_PATH "${CMAKE_CURRENT_BINARY_DIR}/bin")
set(CORE_BUILDS_LIBRARIES_PATH "${CMAKE_CURRENT_BINARY_DIR}/lib")
set(CORE_BUILDS_PLATFORM_PREFIX "linux_64") # Example, update dynamically if needed

include(${CORE_ROOT_DIR}/common.cmake)

# Options mapped from QMake CONFIG and DEFINES
option(DISABLE_PROTECTION "Disable protection feature" OFF)
option(DISABLE_SIGNATURES "Disable signatures feature" OFF)
option(USE_V8 "Use V8 on macOS" OFF)
option(CEF_VERSION_107 "Use CEF Version 107 on Linux" OFF)

# Platform-specific CEF source path
if(WIN32)
    set(CEF_SRC_PATH "${CMAKE_CURRENT_SOURCE_DIR}/src/cef/windows")
elseif(APPLE)
    set(CEF_SRC_PATH "${CMAKE_CURRENT_SOURCE_DIR}/src/cef/mac")
else()
    set(CEF_SRC_PATH "${CMAKE_CURRENT_SOURCE_DIR}/src/cef/linux")
endif()

# ==============================================================================
# Target: ascdocumentscore (Plugin / Shared Library)
# ==============================================================================
add_library(ascdocumentscore SHARED)


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

if(NOT TARGET BoostCustomBuild)
    add_subdirectory(${CORE_ROOT_DIR}/Common/3dParty/boost BoostCustomBuild)
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

if(NOT TARGET hunspell)
    add_subdirectory(${CORE_ROOT_DIR}/Common/3dParty/hunspell/qt hunspell)
endif()

if(NOT TARGET ooxmlsignature)
    add_subdirectory(${CORE_ROOT_DIR}/DesktopEditor/xmlsec/src ooxmlsignature)
endif()



# Enforce C++17 Standard
target_compile_features(ascdocumentscore PRIVATE cxx_std_17)


# Core Definitions
target_compile_definitions(ascdocumentscore PRIVATE
    PDFFILE_USE_DYNAMIC_LIBRARY
    DJVU_USE_DYNAMIC_LIBRARY
    XPS_USE_DYNAMIC_LIBRARY
    DESKTOP_USE_DYNAMIC_LIBRARY_BUILDING
    CRYPTOPP_DISABLE_ASM
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
    ENABLE_CEF_EXTENSIONS
    CEF_VERSION_ABOVE_86
    CEF_VERSION_ABOVE_102
    OVERRIDE=override
)

# Platform Specific Definitions
if(APPLE)
    target_compile_definitions(ascdocumentscore PRIVATE _XCODE)
    if(USE_V8)
        target_compile_definitions(ascdocumentscore PRIVATE CEF_VERSION_103 OLD_MACOS_SYSTEM)
        set(CEF_SRC_PATH "${CMAKE_CURRENT_SOURCE_DIR}/src/cef_103/mac")
    endif()
endif()

if(UNIX AND NOT APPLE)
    target_compile_definitions(ascdocumentscore PRIVATE _LINUX)
    if(CEF_VERSION_107)
        target_compile_definitions(ascdocumentscore PRIVATE CEF_VERSION_107)
        set(CEF_SRC_PATH "${CMAKE_CURRENT_SOURCE_DIR}/src/cef_107/linux")
    endif()
endif()

# CEF Base Definitions
target_compile_definitions(ascdocumentscore PRIVATE
    __STD_C USING_CEF_SHARED NDEBUG WRAPPING_CEF_SHARED NO_CSR
)

# Core Library Includes
target_include_directories(ascdocumentscore PRIVATE
    "${EO_CORE_3RD_PARTY_WORK_DIR}/hunspell/src"
    "${CMAKE_CURRENT_SOURCE_DIR}/include"
    "${CMAKE_CURRENT_SOURCE_DIR}/src"
    "${CMAKE_CURRENT_SOURCE_DIR}/tools"
    "${CMAKE_CURRENT_SOURCE_DIR}/tools/functions/internal"
    "${CEF_SRC_PATH}"
)

# ------------------------------------------------------------------------------
# Source Files (ascdocumentscore)
# ------------------------------------------------------------------------------
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
# CEF Base & Wrapper Sources (from base.pri)
# ------------------------------------------------------------------------------
list(APPEND ASCDOCUMENTSCORE_SOURCES
    "${CEF_SRC_PATH}/libcef_dll/base/cef_atomic_flag.cc"
    "${CEF_SRC_PATH}/libcef_dll/base/cef_callback_helpers.cc"
    "${CEF_SRC_PATH}/libcef_dll/base/cef_callback_internal.cc"
    "${CEF_SRC_PATH}/libcef_dll/base/cef_lock.cc"
    "${CEF_SRC_PATH}/libcef_dll/base/cef_lock_impl.cc"
    "${CEF_SRC_PATH}/libcef_dll/base/cef_logging.cc"
    "${CEF_SRC_PATH}/libcef_dll/base/cef_ref_counted.cc"
    "${CEF_SRC_PATH}/libcef_dll/base/cef_thread_checker_impl.cc"
    "${CEF_SRC_PATH}/libcef_dll/base/cef_weak_ptr.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/accessibility_handler_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/app_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/audio_handler_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/base_ref_counted_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/base_scoped_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/browser_process_handler_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/client_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/command_handler_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/completion_callback_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/context_menu_handler_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/cookie_access_filter_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/cookie_visitor_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/delete_cookies_callback_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/dev_tools_message_observer_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/dialog_handler_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/display_handler_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/domvisitor_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/download_handler_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/download_image_callback_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/drag_handler_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/end_tracing_callback_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/extension_handler_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/find_handler_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/focus_handler_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/frame_handler_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/jsdialog_handler_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/keyboard_handler_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/life_span_handler_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/load_handler_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/media_observer_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/media_route_create_callback_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/media_sink_device_info_callback_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/menu_model_delegate_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/navigation_entry_visitor_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/pdf_print_callback_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/permission_handler_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/print_handler_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/read_handler_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/render_handler_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/render_process_handler_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/request_context_handler_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/request_handler_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/resolve_callback_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/resource_bundle_handler_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/resource_handler_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/resource_request_handler_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/response_filter_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/run_file_dialog_callback_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/scheme_handler_factory_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/server_handler_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/set_cookie_callback_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/string_visitor_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/task_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/test/test_server_handler_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/test/translator_test_ref_ptr_client_child_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/test/translator_test_ref_ptr_client_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/test/translator_test_scoped_client_child_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/test/translator_test_scoped_client_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/urlrequest_client_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/v8accessor_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/v8array_buffer_release_callback_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/v8handler_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/v8interceptor_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/views/browser_view_delegate_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/views/button_delegate_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/views/menu_button_delegate_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/views/panel_delegate_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/views/textfield_delegate_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/views/view_delegate_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/views/window_delegate_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/cpptoc/write_handler_cpptoc.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/auth_callback_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/before_download_callback_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/binary_value_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/browser_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/browser_host_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/callback_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/command_line_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/context_menu_params_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/cookie_manager_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/dictionary_value_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/domdocument_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/domnode_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/download_item_callback_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/download_item_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/drag_data_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/extension_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/file_dialog_callback_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/frame_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/get_extension_resource_callback_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/image_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/jsdialog_callback_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/list_value_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/media_access_callback_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/media_router_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/media_route_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/media_sink_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/media_source_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/menu_model_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/navigation_entry_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/permission_prompt_callback_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/post_data_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/post_data_element_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/preference_manager_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/preference_registrar_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/print_dialog_callback_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/print_job_callback_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/print_settings_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/process_message_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/registration_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/request_context_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/request_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/resource_bundle_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/resource_read_callback_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/resource_skip_callback_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/response_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/run_context_menu_callback_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/run_quick_menu_callback_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/scheme_registrar_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/select_client_certificate_callback_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/server_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/shared_memory_region_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/shared_process_message_builder_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/sslinfo_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/sslstatus_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/stream_reader_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/stream_writer_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/task_runner_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/test/test_server_connection_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/test/test_server_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/test/translator_test_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/test/translator_test_ref_ptr_library_child_child_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/test/translator_test_ref_ptr_library_child_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/test/translator_test_ref_ptr_library_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/test/translator_test_scoped_library_child_child_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/test/translator_test_scoped_library_child_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/test/translator_test_scoped_library_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/thread_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/urlrequest_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/v8context_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/v8exception_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/v8stack_frame_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/v8stack_trace_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/v8value_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/value_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/views/box_layout_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/views/browser_view_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/views/button_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/views/display_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/views/fill_layout_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/views/label_button_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/views/layout_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/views/menu_button_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/views/menu_button_pressed_lock_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/views/overlay_controller_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/views/panel_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/views/scroll_view_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/views/textfield_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/views/view_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/views/window_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/waitable_event_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/x509certificate_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/x509cert_principal_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/xml_reader_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/ctocpp/zip_reader_ctocpp.cc"
    "${CEF_SRC_PATH}/libcef_dll/shutdown_checker.cc"
    "${CEF_SRC_PATH}/libcef_dll/transfer_util.cc"
    "${CEF_SRC_PATH}/libcef_dll/wrapper/cef_byte_read_handler.cc"
    "${CEF_SRC_PATH}/libcef_dll/wrapper/cef_closure_task.cc"
    "${CEF_SRC_PATH}/libcef_dll/wrapper/cef_message_router.cc"
    "${CEF_SRC_PATH}/libcef_dll/wrapper/cef_resource_manager.cc"
    "${CEF_SRC_PATH}/libcef_dll/wrapper/cef_scoped_temp_dir.cc"
    "${CEF_SRC_PATH}/libcef_dll/wrapper/cef_stream_resource_handler.cc"
    "${CEF_SRC_PATH}/libcef_dll/wrapper/cef_xml_object.cc"
    "${CEF_SRC_PATH}/libcef_dll/wrapper/cef_zip_archive.cc"
    "${CEF_SRC_PATH}/libcef_dll/wrapper/libcef_dll_wrapper.cc"
    "${CEF_SRC_PATH}/libcef_dll/wrapper/libcef_dll_wrapper2.cc"
)

# ------------------------------------------------------------------------------
# CEF Client Sources
# ------------------------------------------------------------------------------
list(APPEND ASCDOCUMENTSCORE_SOURCES
    "${CEF_SRC_PATH}/tests/shared/browser/client_app_browser.cc"
    "${CEF_SRC_PATH}/tests/shared/browser/extension_util.cc"
    "${CEF_SRC_PATH}/tests/shared/browser/file_util.cc"
    "${CEF_SRC_PATH}/tests/shared/browser/geometry_util.cc"
    "${CEF_SRC_PATH}/tests/shared/browser/main_message_loop.cc"
    "${CEF_SRC_PATH}/tests/shared/browser/main_message_loop_external_pump.cc"
    "${CEF_SRC_PATH}/tests/shared/browser/main_message_loop_std.cc"
    "${CEF_SRC_PATH}/tests/shared/common/binary_value_utils.cc"
    "${CEF_SRC_PATH}/tests/shared/common/client_app.cc"
    "${CEF_SRC_PATH}/tests/shared/common/client_app_other.cc"
    "${CEF_SRC_PATH}/tests/shared/common/client_switches.cc"
    "${CEF_SRC_PATH}/tests/shared/common/string_util.cc"
    "${CEF_SRC_PATH}/tests/shared/renderer/client_app_renderer.cc"
    "${CEF_SRC_PATH}/tests/cefclient/browser/binding_test.cc"
    "${CEF_SRC_PATH}/tests/cefclient/browser/browser_window.cc"
    "${CEF_SRC_PATH}/tests/cefclient/browser/bytes_write_handler.cc"
    "${CEF_SRC_PATH}/tests/cefclient/browser/client_app_delegates_browser.cc"
    "${CEF_SRC_PATH}/tests/cefclient/browser/client_browser.cc"
    "${CEF_SRC_PATH}/tests/cefclient/browser/client_handler.cc"
    "${CEF_SRC_PATH}/tests/cefclient/browser/client_handler_std.cc"
    "${CEF_SRC_PATH}/tests/cefclient/browser/client_prefs.cc"
    "${CEF_SRC_PATH}/tests/cefclient/browser/dialog_test.cc"
    "${CEF_SRC_PATH}/tests/cefclient/browser/image_cache.cc"
    "${CEF_SRC_PATH}/tests/cefclient/browser/main_context.cc"
    "${CEF_SRC_PATH}/tests/cefclient/browser/main_context_impl.cc"
    "${CEF_SRC_PATH}/tests/cefclient/browser/media_router_test.cc"
    "${CEF_SRC_PATH}/tests/cefclient/browser/preferences_test.cc"
    "${CEF_SRC_PATH}/tests/cefclient/browser/response_filter_test.cc"
    "${CEF_SRC_PATH}/tests/cefclient/browser/root_window.cc"
    "${CEF_SRC_PATH}/tests/cefclient/browser/root_window_create.cc"
    "${CEF_SRC_PATH}/tests/cefclient/browser/root_window_manager.cc"
    "${CEF_SRC_PATH}/tests/cefclient/browser/root_window_views.cc"
    "${CEF_SRC_PATH}/tests/cefclient/browser/scheme_test.cc"
    "${CEF_SRC_PATH}/tests/cefclient/browser/server_test.cc"
    "${CEF_SRC_PATH}/tests/cefclient/browser/test_runner.cc"
    "${CEF_SRC_PATH}/tests/cefclient/browser/urlrequest_test.cc"
    "${CEF_SRC_PATH}/tests/cefclient/browser/views_menu_bar.cc"
    "${CEF_SRC_PATH}/tests/cefclient/browser/views_overlay_controls.cc"
    "${CEF_SRC_PATH}/tests/cefclient/browser/views_style.cc"
    "${CEF_SRC_PATH}/tests/cefclient/browser/views_window.cc"
    "${CEF_SRC_PATH}/tests/cefclient/browser/window_test.cc"
    "${CEF_SRC_PATH}/tests/cefclient/browser/window_test_runner.cc"
    "${CEF_SRC_PATH}/tests/cefclient/browser/window_test_runner_views.cc"
    "${CEF_SRC_PATH}/tests/cefclient/common/scheme_test_common.cc"
    "${CEF_SRC_PATH}/tests/cefclient/renderer/client_renderer.cc"
    "${CEF_SRC_PATH}/tests/cefclient/renderer/ipc_performance_test.cc"
    "${CEF_SRC_PATH}/tests/cefclient/renderer/performance_test.cc"
    "${CEF_SRC_PATH}/tests/cefclient/renderer/performance_test_tests.cc"
)

if(WIN32)
    list(APPEND ASCDOCUMENTSCORE_SOURCES
        "${CEF_SRC_PATH}/tests/shared/browser/main_message_loop_external_pump_win.cc"
        "${CEF_SRC_PATH}/tests/shared/browser/resource_util_win.cc"
        "${CEF_SRC_PATH}/tests/shared/browser/util_win.cc"
        "${CEF_SRC_PATH}/tests/cefclient/browser/browser_window_std_win.cc"
        "${CEF_SRC_PATH}/tests/cefclient/browser/main_context_impl_win.cc"
        "${CEF_SRC_PATH}/tests/cefclient/browser/main_message_loop_multithreaded_win.cc"
        "${CEF_SRC_PATH}/tests/cefclient/browser/resource_util_win_idmap.cc"
        "${CEF_SRC_PATH}/tests/cefclient/browser/root_window_win.cc"
        "${CEF_SRC_PATH}/tests/cefclient/browser/temp_window_win.cc"
        "${CEF_SRC_PATH}/tests/cefclient/browser/window_test_runner_win.cc"
    )
elseif(APPLE)
    list(APPEND ASCDOCUMENTSCORE_SOURCES
        "${CEF_SRC_PATH}/tests/shared/browser/resource_util_posix.cc"
        "${CEF_SRC_PATH}/tests/cefclient/browser/main_context_impl_posix.cc"
        "${CEF_SRC_PATH}/tests/shared/browser/main_message_loop_external_pump_mac.mm"
        "${CEF_SRC_PATH}/tests/shared/browser/resource_util_mac.mm"
        "${CEF_SRC_PATH}/tests/cefclient/browser/browser_window_std_mac.mm"
        "${CEF_SRC_PATH}/tests/cefclient/browser/root_window_mac.mm"
        "${CEF_SRC_PATH}/tests/cefclient/browser/temp_window_mac.mm"
        "${CEF_SRC_PATH}/tests/cefclient/browser/window_test_runner_mac.mm"
        "${CEF_SRC_PATH}/libcef_dll/wrapper/libcef_dll_dylib.cc"
        "${CEF_SRC_PATH}/libcef_dll/wrapper/cef_library_loader_mac.mm"
    )
else() # Linux
    list(APPEND ASCDOCUMENTSCORE_SOURCES
        "${CEF_SRC_PATH}/tests/shared/browser/main_message_loop_external_pump_linux.cc"
        "${CEF_SRC_PATH}/tests/shared/browser/resource_util_posix.cc"
        "${CEF_SRC_PATH}/tests/cefclient/browser/browser_window_std_gtk.cc"
        "${CEF_SRC_PATH}/tests/cefclient/browser/dialog_handler_gtk.cc"
        "${CEF_SRC_PATH}/tests/cefclient/browser/main_context_impl_posix.cc"
        "${CEF_SRC_PATH}/tests/cefclient/browser/main_message_loop_multithreaded_gtk.cc"
        "${CEF_SRC_PATH}/tests/cefclient/browser/resource_util_linux.cc"
        "${CEF_SRC_PATH}/tests/cefclient/browser/root_window_gtk.cc"
        "${CEF_SRC_PATH}/tests/cefclient/browser/temp_window_x11.cc"
        "${CEF_SRC_PATH}/tests/cefclient/browser/util_gtk.cc"
        "${CEF_SRC_PATH}/tests/cefclient/browser/window_test_runner_gtk.cc"
    )
endif()

target_sources(ascdocumentscore PRIVATE ${ASCDOCUMENTSCORE_SOURCES})

# ------------------------------------------------------------------------------
# Linking & Libraries (ascdocumentscore)
# ------------------------------------------------------------------------------

# Add Crypto & Compound dependencies
target_link_directories(ascdocumentscore PRIVATE "${CORE_BUILDS_LIBRARIES_PATH}")
target_link_libraries(ascdocumentscore PRIVATE CryptoPPLib CompoundFileLib)

# Boost and ICU (Assuming targets exist via your core subdirectories)
target_link_libraries(ascdocumentscore PRIVATE     
                        boost_system 
                        boost_filesystem 
                        boost_regex 
                        boost_date_time
)

if(WIN32)
    target_compile_definitions(ascdocumentscore PRIVATE NOMINMAX _WINDOWS)
    target_link_directories(ascdocumentscore PRIVATE "${CORE_ROOT_DIR}/Common/3dParty/cef/${CORE_BUILDS_PLATFORM_PREFIX}/build")
    target_link_libraries(ascdocumentscore PRIVATE
        libcef wininet dnsapi version msimg32 ws2_32 usp10 psapi
        dbghelp winmm shlwapi kernel32 gdi32 winspool comdlg32
        advapi32 shell32 ole32 oleaut32 user32 uuid odbc32
        odbccp32 delayimp credui netapi32 comctl32 rpcrt4 gdiplus
        Urlmon OpenGL32 Crypt32 Imm32
    )
elseif(APPLE)
    target_link_options(ascdocumentscore PRIVATE -F"${CORE_ROOT_DIR}/Common/3dParty/cef/${CORE_BUILDS_PLATFORM_PREFIX}/build")
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
    target_link_directories(ascdocumentscore PRIVATE "${CORE_ROOT_DIR}/Common/3dParty/cef/${CORE_BUILDS_PLATFORM_PREFIX}/build")
    
    # RPATH & Linker options
    target_link_options(ascdocumentscore PRIVATE "-Wl,-rpath,'$ORIGIN'" "-Wl,-rpath,'$ORIGIN/converter'" "-Wl,--disable-new-dtags")
    
    target_include_directories(ascdocumentscore PRIVATE ${GTK_INCLUDE_DIRS})
    target_link_libraries(ascdocumentscore PRIVATE
        ${GTK_LIBRARIES} X11 X11-xcb xkbcommon-x11 xkbcommon
        graphics kernel UnicodeConverter kernel_network
        PdfFile XpsFile DjVuFile hunspell ooxmlsignature doctrenderer
    )
endif()

# ==============================================================================
# Target: editors_helper (Executable)
# ==============================================================================
add_executable(editors_helper "${CMAKE_CURRENT_SOURCE_DIR}/helper_main.cpp")


target_link_libraries(editors_helper PUBLIC 
    ascdocumentscore
    boost_system 
    boost_filesystem 
    boost_regex 
    boost_date_time
)

# Output directory routing based on BUILD_XP flag
set_target_properties(editors_helper PROPERTIES RUNTIME_OUTPUT_DIRECTORY "${CORE_BUILDS_BINARY_PATH}")

if(WIN32)
    target_sources(editors_helper PRIVATE "${CMAKE_CURRENT_SOURCE_DIR}/helper.exe.manifest")
elseif(UNIX AND NOT APPLE)
    target_compile_definitions(editors_helper PRIVATE _LINUX)
    target_link_options(editors_helper PRIVATE 
        "-Wl,-rpath,'$ORIGIN'" 
        "-Wl,-rpath,'$ORIGIN/converter'"
        "-Wl,-unresolved-symbols=ignore-in-shared-libs"
    )
    # Extra Linux dependencies defined in ascdocumentscore_helper.pro
    target_link_libraries(editors_helper PRIVATE 
        graphics kernel kernel_network UnicodeConverter OfficeUtils
    )
endif()