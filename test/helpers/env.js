// What this environment can actually run, as one source of truth: `jest.config.js`
// reads it to skip whole files, and a merged file reads it to skip the describe
// blocks that need more than the rest of the file does.
//
// Asked of the packages and of what they export rather than of a version string,
// so a row that has them runs the tests whatever it calls itself.

const NODE_MAJOR = Number(process.versions.node.split(".")[0]);
const IS_WINDOWS = process.platform === "win32";

// `cssnano@8` declares `engines.node` as `^22.11.0 || ^24.11.0 || >=26` and
// reaches for `Array.prototype.difference`, which only lands in V8 13.x, so
// anything older throws at minify time rather than failing to install. The
// bundled CSS minimizers also do not reliably install on the Windows agents.
const RUN_CSS_TESTS = NODE_MAJOR >= 22 && !IS_WINDOWS;

// The `@swc/html` minimizers require Node >= 14.
const RUN_SWC_HTML_TESTS = NODE_MAJOR >= 14;

// `renderEmbeddedSource` and the `collectEmbeddedSource` / `embeddedSources`
// passes landed in webpack 5.110; the plugin degrades to doing nothing without
// them. Deep path, resolved at call time: it ships from 5.110, and an older
// webpack has no such file for a static import to resolve.
const WEBPACK_CSS_MINIFY = "webpack/lib/css/cssMinify";
const RUN_EMBEDDED_TESTS = (() => {
  try {
    return typeof require(WEBPACK_CSS_MINIFY).getEmbeddedTypes === "function";
  } catch (_err) {
    return false;
  }
})();

// `imagemin` is ESM-only, so anything reaching it goes through an `import()`
// inside a jest VM context. On Node 14 that takes the worker process down with
// a SIGSEGV instead of throwing — with the flag or without it — so the suites
// that reach it run only where `scripts/jest.js` turns VM modules on, which is
// also the first Node `imagemin` itself supports.
const RUN_ESM_IMPORT_TESTS = process.execArgv.includes(
  "--experimental-vm-modules",
);

// The image minimizers reach for packages the legacy rows never get: `sharp`
// ships a native binary that the `--ignore-scripts` installs skip, and
// `imagemin` is ESM-only.
const IMAGE_MINIMIZER_PACKAGES = ["@napi-rs/image", "sharp", "svgo"];
const HAS_IMAGE_MINIMIZER_PACKAGES = IMAGE_MINIMIZER_PACKAGES.every((name) => {
  try {
    require(name);

    return true;
  } catch (_err) {
    return false;
  }
});
const RUN_IMAGE_TESTS = HAS_IMAGE_MINIMIZER_PACKAGES && RUN_ESM_IMPORT_TESTS;

module.exports = {
  RUN_CSS_TESTS,
  RUN_EMBEDDED_TESTS,
  RUN_ESM_IMPORT_TESTS,
  RUN_IMAGE_TESTS,
  RUN_SWC_HTML_TESTS,
};
