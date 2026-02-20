cmake_minimum_required(VERSION 3.16)

project(videoplayer VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)
set(CMAKE_AUTOUIC ON)

# --- 1. Options & Suffix Logic ---
option(USE_LIBVLC "Build with libvlc support" OFF)
option(BUILD_XP "Build for Windows XP compatibility" OFF)

set(PRO_SUFFIX "")
if(USE_LIBVLC)
    set(PRO_SUFFIX "mediaplayer")
endif()

if(BUILD_XP)
    if("${PRO_SUFFIX}" STREQUAL "")
        set(PRO_SUFFIX "xp")
    else()
        set(PRO_SUFFIX "${PRO_SUFFIX}/xp")
    endif()
endif()

# --- 2. Dependencies (Qt) ---
find_package(Qt6 REQUIRED COMPONENTS Core Gui Widgets PrintSupport)
set(QT_LIBS Qt6::Core Qt6::Gui Qt6::Widgets Qt6::PrintSupport)

if(NOT USE_LIBVLC)
    find_package(Qt6 REQUIRED COMPONENTS Multimedia MultimediaWidgets)
    list(APPEND QT_LIBS Qt6::Multimedia Qt6::MultimediaWidgets)
endif()

# --- 3. Define the Library Target ---
# 'plugin' in qmake usually translates to MODULE, but 'shared' is explicitly requested.
add_library(videoplayer SHARED)

# --- 4. Definitions & Include Paths ---
target_compile_definitions(videoplayer PRIVATE 
    QT_DEPRECATED_WARNINGS
    BUILD_VIDEO_LIBRARY
)

if(USE_LIBVLC)
    target_compile_definitions(videoplayer PRIVATE USE_VLC_LIBRARY)
else()
    # Equivalent to !libvlc HEADERS += ...
    target_sources(videoplayer PRIVATE src/qascmediaplayer.h)
endif()

if(UNIX AND NOT APPLE) # core_linux equivalent
    target_compile_definitions(videoplayer PRIVATE QFILEDIALOG_DONTUSENATIVEDIALOG)
endif()

target_include_directories(videoplayer PUBLIC 
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${CMAKE_CURRENT_SOURCE_DIR}/src
    ${CMAKE_CURRENT_SOURCE_DIR}/src/style
)

# --- 5. Source Files ---
target_sources(videoplayer PRIVATE
    # Headers from .pri
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
    qascvideoview.h
    qfooterpanel.h
    qwidgetutils.h

    # Sources from .pri
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

    # Resources
    IconsVideoPlayerLib.qrc
)

# --- 6. Output Directories (The PRO_SUFFIX logic) ---
if(NOT "${PRO_SUFFIX}" STREQUAL "")
    set_target_properties(videoplayer PROPERTIES
        LIBRARY_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/${PRO_SUFFIX}"
        RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/${PRO_SUFFIX}"
        ARCHIVE_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/${PRO_SUFFIX}"
    )
endif()

# --- 7. External Dependencies (libvlc) ---
if(USE_LIBVLC)
    # This assumes you have a FindVLC.cmake or use a standard path.
    # To mimic your specific directory structure:
    set(CORE_ROOT_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../../../core")
    
    target_include_directories(videoplayer PRIVATE "${CORE_ROOT_DIR}/Common/3dParty/libvlc")
    
    if(UNIX)
        target_link_libraries(videoplayer PRIVATE vlc vlccore)
    elseif(WIN32)
        # Add logic here for Windows libvlc library paths
    endif()
endif()

# --- 8. Link Libraries ---
target_link_libraries(videoplayer PRIVATE ${QT_LIBS})

# Note: ADD_DEPENDENCY(kernel) needs to be handled via find_package 
# or add_subdirectory if 'kernel' is another CMake project.