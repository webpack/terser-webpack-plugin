// Which suites this environment can run is decided in `test/helpers/env.js`, so
// the same answer gates a whole file here and a single block inside a file.
const {
  RUN_CSS_TESTS,
  RUN_EMBEDDED_TESTS,
  RUN_IMAGE_TESTS,
  RUN_SWC_HTML_TESTS,
} = require("./test/helpers/env.js");

const testPathIgnorePatterns = [];

// Skipped whole rather than block by block, because each one carries snapshots:
// a snapshot belonging to a block skipped inside a file that still runs is
// reported obsolete, and the rows that pass `--ci` without `-u` fail on that.
// A block-level gate is only safe where the block takes no snapshot.
if (!RUN_CSS_TESTS) {
  testPathIgnorePatterns.push("/test/css-minify-option\\.test\\.js$");
}

if (!RUN_SWC_HTML_TESTS) {
  testPathIgnorePatterns.push("/test/swc-html-minify-option\\.test\\.js$");
}

if (!RUN_IMAGE_TESTS) {
  testPathIgnorePatterns.push("/test/image-minify-option\\.test\\.js$");
}

// This one also reaches for a deep webpack path at module scope that ships
// from 5.110, so it would throw before any `describe` ran.
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
