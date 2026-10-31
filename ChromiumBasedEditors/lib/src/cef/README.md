# Vendored CEF sample code

CEF headers and the `libcef_dll_wrapper` come from the CEF binary
distribution that core downloads (`core/Common/3dParty/cef/nc-build.py`,
exposed to CMake as `CEF_ROOT`). They are not vendored.

What is vendored here is the part of CEF's sample application that
ascdocumentscore builds on (`ClientApp*`, `ClientHandler`, `MainContextImpl`,
the main message loops and what they pull in):

- `tests/shared`, `tests/cefclient/{browser,common,renderer}`: sources only
- `tests/cefsimple/mac/helper-Info.plist`: template for the macOS helper bundles

Upstream: https://github.com/chromiumembedded/cef at
`cf671c072925b27823a61181152f4f288e8e4306`
(CEF `156.0.15+gcf671c0+chromium-156.0.8078.80`). This must match the
`cef_version` pinned in core.

## Local changes

`local-changes.patch` records every change made to the upstream files:

- `private` -> `protected` in `ClientAppBrowser`, `ClientAppRenderer`,
  `BaseClientHandler` and `ClientHandler`, so our subclasses can reach them
- no GTK print handler in `ClientHandler` (printing is done by us)
- the offscreen (OSR) root windows are stubbed out, so the OSR sources are
  not built
- `ASC_HIDE_WINDOW` support and window titles in the root windows

## Updating to a new CEF version

1. Bump `cef_version` (and the dep `version`) in core's `nc-build.py`.
2. Replace `tests/` here with the same directories from the matching
   upstream commit (sources only), then re-apply the patch:
   `git apply --directory=ChromiumBasedEditors/lib/src/cef ChromiumBasedEditors/lib/src/cef/local-changes.patch`
   from the desktop-sdk root.
3. Regenerate `local-changes.patch` if anything had to be adjusted, and
   update the commit above.
4. Adjust the sample file lists in `../../CMakeLists.txt` for added or
   removed upstream files.
