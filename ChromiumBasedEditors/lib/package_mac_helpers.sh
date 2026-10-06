#!/bin/bash
set -euo pipefail

HELPER_BIN="$1"
PLIST_DIR="$2"
OUT_DIR="$3"
ICU_LIB_DIR="$4"
ASCDOCUMENTSCORE_FRAMEWORK="$5"
OOXMLSIGNATURE_FRAMEWORK="$6"
CEF_FRAMEWORK_DIR="$7"
shift 7
DYLIB_DEPS=("$@")   # kernel, kernel_network, graphics, PdfFile, XpsFile, DjVuFile, doctrenderer, DocxRenderer, UnicodeConverter

make_bundle() {
    local name="$1"
    local primary="$2"   # "1" for the one bundle that gets a real system/, "" for the rest
    local bundle="${OUT_DIR}/${name}.app"
    local macos_dir="${bundle}/Contents/MacOS"
    local sys_dir="${macos_dir}/system"
    local frameworks_dir="${bundle}/Contents/Frameworks"

    mkdir -p "${macos_dir}"
    cp "${HELPER_BIN}" "${macos_dir}/${name}"
    cp "${PLIST_DIR}/${name}-Info.plist" "${bundle}/Contents/Info.plist"

    if [ "${primary}" = "1" ]; then
        mkdir -p "${sys_dir}"
        for dep in "${DYLIB_DEPS[@]}"; do
            cp -f "${dep}" "${sys_dir}/"
        done
        cp -P "${ICU_LIB_DIR}"/*.dylib* "${sys_dir}/" 2>/dev/null || true
        rm -rf "${sys_dir}/$(basename "${ASCDOCUMENTSCORE_FRAMEWORK}")"
        cp -R "${ASCDOCUMENTSCORE_FRAMEWORK}" "${sys_dir}/"
        rm -rf "${sys_dir}/$(basename "${OOXMLSIGNATURE_FRAMEWORK}")"
        cp -R "${OOXMLSIGNATURE_FRAMEWORK}" "${sys_dir}/"
    else
        # Each helper resolves @executable_path/system independently (its own
        # process, own rpath), but there's no reason to triple the ~100MB of
        # ICU/kernel/graphics/etc dylibs on disk when a relative symlink back
        # to the primary helper's copy resolves identically at runtime - this
        # is plain dylib rpath lookup, not a .framework bundle Xcode's
        # embedded-framework validator scrutinizes the way CEF's is.
        ln -sfn "../../../editors_helper.app/Contents/MacOS/system" "${sys_dir}"
    fi

    # CEF's own framework binary hardcodes @executable_path/../Frameworks/... as its
    # install name (not @rpath), so each helper needs its own Contents/Frameworks/
    # entry regardless of the system/ rpath convention used above.
    mkdir -p "${frameworks_dir}"
    ln -sfn "${CEF_FRAMEWORK_DIR}" "${frameworks_dir}/$(basename "${CEF_FRAMEWORK_DIR}")"
}

make_bundle "editors_helper" "1"
make_bundle "editors_helper (GPU)" ""
make_bundle "editors_helper (Renderer)" ""

# ---------------------------------------------------------------------------
# Top-level siblings the Xcode "Rename symbols"/"Copy Library" scripts expect
# directly under the staging root (OUT_DIR), not nested inside any bundle.
# ---------------------------------------------------------------------------
# ascdocumentscore.framework already builds directly into the CMake binary dir
# by default, which OUT_DIR often *is* (e.g. when EO_CORE_OUTPUT_DIR is left at
# its own default, "<build-dir>/package", its parent is the build dir itself).
# Skip the copy when source and destination already coincide, rather than
# rm -rf'ing the framework and then failing to copy the now-deleted source.
ASCDOCUMENTSCORE_PARENT="$(cd "$(dirname "${ASCDOCUMENTSCORE_FRAMEWORK}")" && pwd -P)"
OUT_DIR_REAL="$(cd "${OUT_DIR}" && pwd -P)"
if [ "${ASCDOCUMENTSCORE_PARENT}" != "${OUT_DIR_REAL}" ]; then
    rm -rf "${OUT_DIR}/$(basename "${ASCDOCUMENTSCORE_FRAMEWORK}")"
    cp -R "${ASCDOCUMENTSCORE_FRAMEWORK}" "${OUT_DIR}/"
fi

OOXMLSIGNATURE_PARENT="$(cd "$(dirname "${OOXMLSIGNATURE_FRAMEWORK}")" && pwd -P)"
if [ "${OOXMLSIGNATURE_PARENT}" != "${OUT_DIR_REAL}" ]; then
    rm -rf "${OUT_DIR}/$(basename "${OOXMLSIGNATURE_FRAMEWORK}")"
    cp -R "${OOXMLSIGNATURE_FRAMEWORK}" "${OUT_DIR}/"
fi

# Symlinked, not copied: the real CEF framework is large (100s of MB), and this
# avoids tripling that cost across the 3rd-party install dir, this staging dir,
# and the final .app bundle Xcode's own script copies it into.
ln -sfn "${CEF_FRAMEWORK_DIR}" "${OUT_DIR}/$(basename "${CEF_FRAMEWORK_DIR}")"

# "converter" itself is NOT handled here — it's populated directly by
# EO_CORE_OUTPUT_DIR (set to "<this staging root>/converter" at configure time),
# via each converter library's own copy_artifacts_to_folder() call.
