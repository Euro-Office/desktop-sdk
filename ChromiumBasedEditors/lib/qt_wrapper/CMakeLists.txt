cmake_minimum_required(VERSION 3.16)

project(qtascdocumentscore VERSION 1.0.0 LANGUAGES CXX)

# Global Qt Setup
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTOUIC ON)
set(CMAKE_AUTORCC ON)

add_compile_options(-march=native)

# Find Qt
if(NOT QT_ROOT)
    if(DEFINED ENV{QT6_ROOT})
        set(QT_ROOT "$ENV{QT6_ROOT}/6.11.1/gcc_64")
    else()
        set(QT_ROOT "/qt6/6.11.1/gcc_64")
    endif()
endif()
set(QT_DIR "${QT_ROOT}/lib/cmake/Qt6")
set(Qt6_DIR "${QT_ROOT}/lib/cmake/Qt6")

find_package(QT NAMES Qt6 REQUIRED COMPONENTS Core Gui GuiPrivate PrintSupport Widgets Multimedia MultimediaWidgets)
find_package(Qt${QT_VERSION_MAJOR} REQUIRED COMPONENTS Core Gui GuiPrivate PrintSupport Widgets Multimedia MultimediaWidgets)

# Paths
set(CORE_ROOT_DIR "${CMAKE_CURRENT_LIST_DIR}/../../../../core")
set(PWD_ROOT_DIR "${CMAKE_CURRENT_LIST_DIR}")

# --- Subdirectories ---
# Checks if targets exist to allow this to be included in larger builds
if(NOT TARGET kernel)
    add_subdirectory(${CORE_ROOT_DIR}/Common kernel)
endif()
if(NOT TARGET UnicodeConverter)
    add_subdirectory(${CORE_ROOT_DIR}/UnicodeConverter UnicodeConverter)
endif()
if(NOT TARGET graphics)
    add_subdirectory(${CORE_ROOT_DIR}/DesktopEditor/graphics/cmake graphics)
endif()
if(NOT TARGET ascdocumentscore)
    add_subdirectory(${PWD_ROOT_DIR}/../ ascdocumentscore)
endif()

# Add VideoPlayerLib (Now a static library)
if(NOT TARGET videoplayerlib)
    add_subdirectory(${PWD_ROOT_DIR}/../../videoplayerlib videoplayerlib)
endif()

# --- Main Target ---
add_library(qtascdocumentscore SHARED)

target_compile_definitions(qtascdocumentscore PRIVATE DESKTOP_USE_DYNAMIC_LIBRARY_BUILDING QT_VERSION_6)

target_include_directories(qtascdocumentscore PRIVATE
    "${CMAKE_CURRENT_LIST_DIR}/include"
    "${CMAKE_CURRENT_LIST_DIR}/qrenderer/include"
)

target_sources(qtascdocumentscore PRIVATE
    include/qcefview.h
    include/qcefview_media.h
    include/qascprinter.h
    qrenderer/include/qrenderer.h
    include/qexternalmessageloop.h
    include/qascapplicationmanager.h
    include/qdpichecker.h
    src/qcefview.cpp
    src/qcefview_media.cpp
    src/qascprinter.cpp
    qrenderer/src/qrenderer.cpp
    src/qexternalmessageloop.cpp
    src/qascapplicationmanager.cpp
    src/qdpichecker.cpp
)

target_link_libraries(qtascdocumentscore PRIVATE
    Qt${QT_VERSION_MAJOR}::Core
    Qt${QT_VERSION_MAJOR}::Gui
    Qt${QT_VERSION_MAJOR}::PrintSupport
    Qt${QT_VERSION_MAJOR}::Widgets
    Qt${QT_VERSION_MAJOR}::Multimedia
    Qt${QT_VERSION_MAJOR}::MultimediaWidgets
    # Internal Dependencies
    kernel 
    graphics 
    ascdocumentscore 
    videoplayerlib # CMake will automatically pull includes and link the static code here
)

# --- OS Specifics ---
if(WIN32)
    target_link_libraries(qtascdocumentscore PRIVATE user32)
endif()

if(UNIX AND NOT APPLE)
    target_compile_definitions(qtascdocumentscore PRIVATE _LINUX LINUX OS_LINUX _X11)
    
    # Qt6 Linux handling
    target_link_libraries(qtascdocumentscore PRIVATE Qt${QT_VERSION_MAJOR}::GuiPrivate)

    #target_link_options(qtascdocumentscore PRIVATE "-Wl,-unresolved-symbols=ignore-in-shared-libs")

    target_link_libraries(qtascdocumentscore PRIVATE 
        UnicodeConverter
        X11 
    )
endif()