cmake_minimum_required(VERSION 3.16)

# Define the project
project(qtascdocumentscore VERSION 1.0.0 LANGUAGES CXX)

# Enable standard Qt build features
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTOUIC ON)
set(CMAKE_AUTORCC ON)

# Find Qt (Supports both Qt5 and Qt6 dynamically)
find_package(QT NAMES Qt6 Qt5 REQUIRED COMPONENTS Core Gui PrintSupport Widgets)
find_package(Qt${QT_VERSION_MAJOR} REQUIRED COMPONENTS Core Gui PrintSupport Widgets)

# Define path variables
set(CORE_ROOT_DIR "${CMAKE_CURRENT_LIST_DIR}/../../../../core")
set(PWD_ROOT_DIR "${CMAKE_CURRENT_LIST_DIR}")


if(NOT TARGET kernel)
    add_subdirectory(${CORE_ROOT_DIR}/Common kernel)
endif()

if(NOT TARGET graphics)
    add_subdirectory(${CORE_ROOT_DIR}/DesktopEditor/graphics/cmake graphics)
endif()

if(NOT TARGET ascdocumentscore)
    add_subdirectory(${PWD_ROOT_DIR}/../ ascdocumentscore)
endif()

# ---------------------------------------------------------------------------
# NOTE: qmake .pri files cannot be directly included in CMake. 
# You will need to convert base.pri and videoplayerlib_deps.pri into .cmake 
# files or add their contents directly into this file.
# 
# include("${CORE_ROOT_DIR}/Common/base.cmake")
# include("${CORE_ROOT_DIR}/../desktop-sdk/ChromiumBasedEditors/videoplayerlib/videoplayerlib_deps.cmake")
# ---------------------------------------------------------------------------

# Create a shared library (plugin)
# Note: If this is loaded at runtime via QPluginLoader, change SHARED to MODULE.
add_library(qtascdocumentscore SHARED)

# Add compilation definitions
target_compile_definitions(qtascdocumentscore PRIVATE DESKTOP_USE_DYNAMIC_LIBRARY_BUILDING)

# Add include directories
target_include_directories(qtascdocumentscore PRIVATE
    "${CMAKE_CURRENT_LIST_DIR}/include"
    "${CMAKE_CURRENT_LIST_DIR}/qrenderer/include"
)

# Add sources and headers
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

# Link standard Qt libraries
target_link_libraries(qtascdocumentscore PRIVATE
    Qt${QT_VERSION_MAJOR}::Core
    Qt${QT_VERSION_MAJOR}::Gui
    Qt${QT_VERSION_MAJOR}::PrintSupport
    Qt${QT_VERSION_MAJOR}::Widgets
)

# ADD_DEPENDENCY(kernel, graphics, ascdocumentscore)
# Assuming these are other CMake targets created elsewhere in your project:
target_link_libraries(qtascdocumentscore PRIVATE kernel graphics ascdocumentscore)

# ---------------------------------------------------------------------------
# OS-Specific Configurations
# ---------------------------------------------------------------------------

# core_windows
if(WIN32)
    target_link_libraries(qtascdocumentscore PRIVATE user32)
    
    # Handle the 'build_xp' custom condition. 
    # If you pass -DBUILD_XP=ON via the CMake command line:
    if(BUILD_XP)
        set_target_properties(qtascdocumentscore PROPERTIES
            LIBRARY_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/xp"
            RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/xp"
        )
    endif()
endif()

# core_linux
if(UNIX AND NOT APPLE)
    # Check Qt version for specific modules
    if(QT_VERSION_MAJOR LESS_EQUAL 5)
        find_package(Qt5 REQUIRED COMPONENTS X11Extras)
        target_link_libraries(qtascdocumentscore PRIVATE Qt5::X11Extras)
    else()
        # In Qt6, X11Extras was removed/merged. Linking GuiPrivate as requested:
        target_link_libraries(qtascdocumentscore PRIVATE Qt6::GuiPrivate)
    endif()

    # Linker flags
    target_link_options(qtascdocumentscore PRIVATE "-Wl,-unresolved-symbols=ignore-in-shared-libs")

    # Additional dependencies
    target_link_libraries(qtascdocumentscore PRIVATE 
        graphics 
        kernel 
        UnicodeConverter
        X11 # Requires libx11-dev to be installed on the system
    )
endif()