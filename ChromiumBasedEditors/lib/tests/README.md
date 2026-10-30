# desktop-sdk unit tests

GoogleTest suites registered with CTest, following the same setup as core
(see `core/TESTING.md`). They are off by default and enabled with
`-DEO_BUILD_TESTS=ON` plus the vcpkg `tests` manifest feature.

The SDK is normally built as part of desktop-apps
(`desktop-apps/win-linux/CMakeLists.txt`), which sets `EO_BUILD_TESTS` for
both projects. See `desktop-apps/win-linux/tests/README.md` for how to run
them. The Linux docker build runs them on every build.

## Adding a suite

1. Add `<name>_test.cpp` here.
2. Register it in `CMakeLists.txt` with `add_core_gtest()`, passing
   `GTEST_MAIN` unless the suite has its own `main()`.
3. List what it links in `LIBS`. Suites should link core libraries or code
   that doesn't need CEF, not `ascdocumentscore` itself, so they run without a
   browser engine.

`setup_test.cpp` only checks the test setup itself (GoogleTest, core kernel
loading at run time) and is the minimal example.
