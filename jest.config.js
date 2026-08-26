// The bundled CSS minimizers (`cssnano@8`, `@swc/css`, `lightningcss`,
// `esbuild@0.28`) require modern Node and don't reliably install on the
// Windows agents. Skip the dedicated CSS test file outright on rows that
// can't run them so we don't end up with stale or missing snapshots.
// `cssnano@8` declares `engines.node` as `^22.11.0 || ^24.11.0 || >=26.0`
// and reaches for `Array.prototype.difference`, which only lands in V8 13.x,
// so anything older throws `trustedFunctions.difference is not a function`
// at minify time rather than failing to install. The `@swc/html` minimizers
// require Node >= 14, so the dedicated swc-html file is skipped on older
// Node for the same reason.
const NODE_MAJOR = Number(process.versions.node.split(".")[0]);
const IS_WINDOWS = process.platform === "win32";
const RUN_CSS_TESTS = NODE_MAJOR >= 22 && !IS_WINDOWS;
const RUN_SWC_HTML_TESTS = NODE_MAJOR >= 14;
// `renderEmbeddedSource` and the `collectEmbeddedSource` / `embeddedSources`
// passes landed in webpack 5.110; the plugin degrades to doing nothing without
// them, so the file covering them is skipped on an older one. Asked of the
// minify function that reads the passes rather than of the version string.
// Deep paths, resolved at call time: they ship from webpack 5.110, and an older
// one has no such file for a static import to resolve.
const WEBPACK_CSS_MINIFY = "webpack/lib/css/cssMinify";
const RUN_EMBEDDED_TESTS = (() => {
  try {
    return typeof require(WEBPACK_CSS_MINIFY).getEmbeddedTypes === "function";
  } catch (_err) {
    return false;
  }
})();

const testPathIgnorePatterns = [];

if (!RUN_CSS_TESTS) {
  testPathIgnorePatterns.push("/test/css-minify-option\\.test\\.js$");
}

if (!RUN_SWC_HTML_TESTS) {
  testPathIgnorePatterns.push("/test/swc-html-minify-option\\.test\\.js$");
}

if (!RUN_EMBEDDED_TESTS) {
  testPathIgnorePatterns.push("/test/embedded-source\\.test\\.js$");
}

module.exports = {
  testEnvironment: "node",
  // The default 5s timeout is too tight for slower CI runners (especially
  // older Node on macOS), where webpack + multiple minimizers per asset
  // routinely take longer than that.
  testTimeout: 60000,
  coveragePathIgnorePatterns: ["src/serialize-javascript.js"],
  snapshotSerializers: ["<rootDir>/test/helpers/snapshotHashSerializer.js"],
  testPathIgnorePatterns,
};
