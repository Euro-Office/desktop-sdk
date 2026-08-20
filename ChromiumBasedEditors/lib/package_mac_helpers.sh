#!/bin/bash
set -euo pipefail

HELPER_BIN="$1"
PLIST_DIR="$2"
OUT_DIR="$3"
ICU_LIB_DIR="$4"
ASCDOCUMENTSCORE_FRAMEWORK="$5"
CEF_FRAMEWORK_DIR="$6"
shift 6
DYLIB_DEPS=("$@")   # kernel, kernel_network, graphics, PdfFile, XpsFile, DjVuFile, doctrenderer, DocxRenderer, UnicodeConverter, ooxmlsignature

make_bundle() {
    local name="$1"
    local bundle="${OUT_DIR}/${name}.app"
    local macos_dir="${bundle}/Contents/MacOS"
    local sys_dir="${macos_dir}/system"
    local frameworks_dir="${bundle}/Contents/Frameworks"

    mkdir -p "${macos_dir}"
    cp "${HELPER_BIN}" "${macos_dir}/${name}"
    cp "${PLIST_DIR}/${name}-Info.plist" "${bundle}/Contents/Info.plist"

    mkdir -p "${sys_dir}"
    for dep in "${DYLIB_DEPS[@]}"; do
        cp -f "${dep}" "${sys_dir}/"
    done
    cp -P "${ICU_LIB_DIR}"/*.dylib* "${sys_dir}/" 2>/dev/null || true
    rm -rf "${sys_dir}/$(basename "${ASCDOCUMENTSCORE_FRAMEWORK}")"
    cp -R "${ASCDOCUMENTSCORE_FRAMEWORK}" "${sys_dir}/"

    # CEF's own framework binary hardcodes @executable_path/../Frameworks/... as its
    # install name (not @rpath), so each helper needs its own Contents/Frameworks/
    # entry regardless of the system/ rpath convention used above.
    mkdir -p "${frameworks_dir}"
    ln -sfn "${CEF_FRAMEWORK_DIR}" "${frameworks_dir}/$(basename "${CEF_FRAMEWORK_DIR}")"
}

make_bundle "editors_helper"
make_bundle "editors_helper (GPU)"
make_bundle "editors_helper (Renderer)"
