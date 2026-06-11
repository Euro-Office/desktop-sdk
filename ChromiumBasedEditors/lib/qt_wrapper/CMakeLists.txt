cmake_minimum_required(VERSION 3.16)

project(qtascdocumentscore VERSION 1.0.0 LANGUAGES CXX)

# Global Qt Setup
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTOUIC ON)
set(CMAKE_AUTORCC ON)

add_compile_options(-march=native)

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

target_compile_definitions(qtascdocumentscore PRIVATE DESKTOP_USE_DYNAMIC_LIBRARY_BUILDING)

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
    target_compile_definitions(qtascdocumentscore PRIVATE _LINUX LINUX OS_LINUX _X11 QT_VERSION_LESS_5_15)
    
    # Qt5/6 Linux handling
    if(QT_VERSION_MAJOR LESS_EQUAL 5)
        find_package(Qt5 REQUIRED COMPONENTS X11Extras)
        target_link_libraries(qtascdocumentscore PRIVATE Qt5::X11Extras)
    else()
        target_link_libraries(qtascdocumentscore PRIVATE Qt6::GuiPrivate)
    endif()

    #target_link_options(qtascdocumentscore PRIVATE "-Wl,-unresolved-symbols=ignore-in-shared-libs")

    target_link_libraries(qtascdocumentscore PRIVATE 
        UnicodeConverter
        X11 
    )
endif()