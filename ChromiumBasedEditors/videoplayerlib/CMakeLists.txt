cmake_minimum_required(VERSION 3.16)
project(videoplayerlib LANGUAGES CXX)

option(USE_LIBVLC "Build with libvlc support" OFF)

# 1. CHANGE: STATIC library. No separate DLL/SO will be generated.
add_library(videoplayerlib STATIC)

# 2. REQUIRED: Since this static lib is linked into a SHARED lib (qtascdocumentscore),
# we must generate Position Independent Code (PIC).
set_target_properties(videoplayerlib PROPERTIES
    POSITION_INDEPENDENT_CODE ON
    AUTOMOC ON
    AUTOUIC ON
    AUTORCC ON
    CXX_STANDARD 17
    CXX_STANDARD_REQUIRED ON
)

# --- Dependencies ---
set(CORE_ROOT_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../../../core")

include(${CORE_ROOT_DIR}/common.cmake)


set_default_options(videoplayerlib)

if(NOT USE_LIBVLC)
    find_package(Qt${QT_VERSION_MAJOR} REQUIRED COMPONENTS Multimedia MultimediaWidgets)
endif()

# --- Sources & Headers ---
set(HEADERS
    src/lib_base.h
    src/style/style_options.h
    src/qiconpushbutton.h
    src/qtimelabel.h
    src/qfooterpanel_private.h
    src/qvideoslider.h
    src/qvideoplaylist.h
    src/qascvideowidget.h
    src/qmultimedia.h
    src/style/skins_footer.h
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

if(NOT USE_LIBVLC)
    list(APPEND HEADERS src/qascmediaplayer.h)
endif()

target_sources(videoplayerlib PRIVATE ${SOURCES} ${HEADERS} IconsVideoPlayerLib.qrc)

# --- Definitions ---
target_compile_definitions(videoplayerlib PRIVATE QT_DEPRECATED_WARNINGS BUILD_VIDEO_LIBRARY)

if(USE_LIBVLC)
    target_compile_definitions(videoplayerlib PRIVATE USE_VLC_LIBRARY)
endif()

if(UNIX AND NOT APPLE)
    target_compile_definitions(videoplayerlib PRIVATE QFILEDIALOG_DONTUSENATIVEDIALOG)
endif()

# --- Includes ---
# 3. CHANGE: PUBLIC allows qtascdocumentscore to automatically inherit these paths
target_include_directories(videoplayerlib PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${CMAKE_CURRENT_SOURCE_DIR}/src
    ${CMAKE_CURRENT_SOURCE_DIR}/src/style
)

# --- Linking ---
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
    # target_link_libraries(videoplayerlib PRIVATE vlc vlccore)
endif()