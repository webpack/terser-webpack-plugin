// Which suites this environment can run is decided in `test/helpers/env.js`, so
// the same answer gates a whole file here and a single block inside a file.
const {
  RUN_EMBEDDED_TESTS,
  RUN_IMAGE_TESTS,
} = require("./test/helpers/env.js");

const testPathIgnorePatterns = [];

// Both of these reach for what they need at module scope — a deep webpack path
// that only ships from 5.110, and packages the legacy rows never install — so
// they are skipped whole rather than block by block.
if (!RUN_EMBEDDED_TESTS) {
  testPathIgnorePatterns.push("/test/embedded-source\\.test\\.js$");
}

if (!RUN_IMAGE_TESTS) {
  testPathIgnorePatterns.push("/test/image-minify-option\\.test\\.js$");
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
