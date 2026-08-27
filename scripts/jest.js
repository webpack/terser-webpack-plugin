// Runs jest with `--experimental-vm-modules` where Node has it. `imagemin` and
// its plugins are ESM-only, so `imageminMinify` loads them through `import()`,
// which jest can only serve with VM modules enabled. Node < 12.16 has no such
// flag — and no `imagemin` either — so it runs plain.

const { spawnSync } = require("child_process");

const FLAG = "--experimental-vm-modules";
const [major, minor] = process.versions.node.split(".").map(Number);
const supportsVmModules = major > 12 || (major === 12 && minor >= 16);
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
