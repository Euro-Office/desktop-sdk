cmake_minimum_required(VERSION 3.16)

project(videoplayerlib LANGUAGES CXX)

# --- Options ---
option(USE_LIBVLC "Build with libvlc support" OFF)
option(BUILD_XP "Build for XP compatibility" OFF)

# Define core build paths
set(CORE_ROOT_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../../../core")

# --- Qt Dependency (Dual Qt6 / Qt5 Support) ---
# This attempts to find Qt6 first; if not found, it looks for Qt5.
find_package(QT NAMES Qt6 Qt5 REQUIRED COMPONENTS Core Gui Widgets PrintSupport)
find_package(Qt${QT_VERSION_MAJOR} REQUIRED COMPONENTS Core Gui Widgets PrintSupport)

if(NOT USE_LIBVLC)
    # Qt Multimedia components
    find_package(Qt${QT_VERSION_MAJOR} REQUIRED COMPONENTS Multimedia MultimediaWidgets)
endif()

# --- Source Files ---
set(HEADERS
    src/lib_base.h
    src/style/style_options.h
    src/videoplayerlib_export.h
    src/qiconpushbutton.h
    src/qtimelabel.h
    src/qfooterpanel_private.h
    src/qvideoslider.h
    src/qvideoplaylist.h
    src/qascvideowidget.h
    src/qmultimedia.h
    src/style/skins_footer.h
    # Public headers
    qascvideoview.h
    qfooterpanel.h
    qwidgetutils.h
)

set(SOURCES
    src/lib_base.cpp
    src/qiconpushbutton.cpp
    src/qtimelabel.cpp
    src/qfooterpanel.cpp
    src/qascvideoview.cpp
    src/qvideoslider.cpp
    src/qvideoplaylist.cpp
    src/qascvideowidget.cpp
    src/qwidgetutils.cpp
    src/style/skins_footer.cpp
)

set(RESOURCES IconsVideoPlayerLib.qrc)

# Conditional Headers
if(NOT USE_LIBVLC)
    list(APPEND HEADERS src/qascmediaplayer.h)
endif()

# --- Target Definition ---
add_library(videoplayerlib SHARED ${SOURCES} ${HEADERS} ${RESOURCES})

# Modern CMake handles MOC/UIC/RCC automatically for Qt targets
set_target_properties(videoplayerlib PROPERTIES
    AUTOMOC ON
    AUTOUIC ON
    AUTORCC ON
    CXX_STANDARD 17
    CXX_STANDARD_REQUIRED ON
)

# --- Definitions ---
target_compile_definitions(videoplayerlib PRIVATE
    QT_DEPRECATED_WARNINGS
    BUILD_VIDEO_LIBRARY
    videoplayer_EXPORTS
)

if(USE_LIBVLC)
    target_compile_definitions(videoplayerlib PRIVATE USE_VLC_LIBRARY)
endif()

if(UNIX AND NOT APPLE)
    target_compile_definitions(videoplayerlib PRIVATE QFILEDIALOG_DONTUSENATIVEDIALOG)
endif()

# --- Output Directory Logic (Replicating build_xp) ---
set(PRO_SUFFIX "")
if(USE_LIBVLC)
    set(PRO_SUFFIX "mediaplayer")
endif()

if(BUILD_XP)
    if(PRO_SUFFIX STREQUAL "")
        set(PRO_SUFFIX "xp")
    else()
        set(PRO_SUFFIX "${PRO_SUFFIX}/xp")
    endif()
endif()

if(NOT PRO_SUFFIX STREQUAL "")
    set_target_properties(videoplayerlib PROPERTIES
        LIBRARY_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/${PRO_SUFFIX}"
        RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/${PRO_SUFFIX}"
        ARCHIVE_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/${PRO_SUFFIX}"
    )
endif()

# --- Includes ---
target_include_directories(videoplayerlib PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${CMAKE_CURRENT_SOURCE_DIR}/src
    ${CMAKE_CURRENT_SOURCE_DIR}/src/style
)

# --- Linking (Version Agnostic) ---
# We use Qt${QT_VERSION_MAJOR} to automatically link against the found version (5 or 6)

target_link_libraries(videoplayerlib PRIVATE
    Qt${QT_VERSION_MAJOR}::Core
    Qt${QT_VERSION_MAJOR}::Gui
    Qt${QT_VERSION_MAJOR}::Widgets
    Qt${QT_VERSION_MAJOR}::PrintSupport
)

if(NOT USE_LIBVLC)
    target_link_libraries(videoplayerlib PRIVATE
        Qt${QT_VERSION_MAJOR}::Multimedia
        Qt${QT_VERSION_MAJOR}::MultimediaWidgets
    )
else()
    # LibVLC Logic
    set(LIBVLC_PATH "${CORE_ROOT_DIR}/Common/3dParty/libvlc")
    # include("${LIBVLC_PATH}/libvlc.cmake") # Recommended: Create a cmake file for vlc logic
    
    # Simple manual fallback if you don't have a cmake module for VLC yet:
    # target_include_directories(videoplayerlib PRIVATE "${LIBVLC_PATH}/include")
    # target_link_libraries(videoplayerlib PRIVATE vlc vlccore)
endif()

# Handle 'kernel' dependency
# target_link_libraries(videoplayerlib PRIVATE kernel)