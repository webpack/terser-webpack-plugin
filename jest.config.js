// Which suites this environment can run is decided in `test/helpers/env.js`, so
// the same answer gates a whole file here and a single block inside a file.
const { RUN_EMBEDDED_TESTS } = require("./test/helpers/env.js");

const testPathIgnorePatterns = [];

// The one file that reaches for what it needs at module scope — a deep webpack
// path that only ships from 5.110 — so it is skipped whole rather than block by
// block. Everywhere else the gate is on the block.
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
