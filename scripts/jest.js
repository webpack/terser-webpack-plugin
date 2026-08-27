// Runs jest with `--experimental-vm-modules` where that is dependable.
// `imagemin` and its plugins are ESM-only, so `imageminMinify` loads them
// through `import()`, which jest can only serve with VM modules enabled.
//
// Only from Node 20: on Node 14 an `import()` inside a jest VM context takes
// the worker process down with a SIGSEGV rather than throwing, and Node 20 is
// also where the image minimizers install and run at all. Below it the flag is
// left off and the tests that need it skip themselves — see `jest.config.js`.

const { spawnSync } = require("child_process");

const FLAG = "--experimental-vm-modules";
const MIN_VM_MODULES_NODE = 20;
const supportsVmModules =
  Number(process.versions.node.split(".")[0]) >= MIN_VM_MODULES_NODE;
const args = process.argv.slice(2);

// The flag has to be on the process, so this re-runs itself carrying it and
// only then hands over to jest.
if (supportsVmModules && !process.execArgv.includes(FLAG)) {
  const { status } = spawnSync(process.execPath, [FLAG, __filename, ...args], {
    stdio: "inherit",
  });

  // A test runner's job is to hand back the status.
  // eslint-disable-next-line n/no-process-exit
  process.exit(status === null ? 1 : status);
} else {
  require("jest").run(args);
}
