import path from "path";

import MinimizerPlugin from "../src";

import { compile, getCompiler, getErrors, getWarnings } from "./helpers";

/**
 * @param {object=} options plugin options beyond the minimizer
 * @param {(() => never) | (() => { code: string, errors: string[], warnings: string[] })} minify what the minimizer does
 * @param {boolean} parallel whether the minimizer runs in the worker pool
 * @returns {Promise<import("webpack").Stats>} the stats of the build
 */
async function build(options, minify, parallel) {
  const compiler = getCompiler({
    entry: path.resolve(__dirname, "./fixtures/minify/es6.js"),
    output: {
      path: path.resolve(__dirname, "./dist-terser"),
      filename: "[name].js",
      chunkFilename: "[id].[name].js",
    },
  });

  new MinimizerPlugin({ parallel, ...options, minify }).apply(compiler);

  return compile(compiler);
}

/**
 * A minimizer that reports one of each rather than throwing. It reports them as
 * strings, the other form the contract takes: an `Error` does not survive the
 * worker boundary, so one would arrive with its message lost.
 * @returns {{ code: string, errors: string[], warnings: string[] }} what it reported
 */
function reportsBoth() {
  return {
    code: "0",
    errors: ["reported error"],
    warnings: ["reported warning"],
  };
}

/**
 * A minimizer that throws, which the plugin files as an error of its own.
 * @returns {never} nothing; it always throws
 */
function throws() {
  throw new Error("thrown");
}

// Both paths, because a minimizer's diagnostics cross the worker boundary on
// one of them and not the other.
describe.each([false, true])(
  '"severityError" option (parallel: %s)',
  (parallel) => {
    it("should file errors as errors by default", async () => {
      const stats = await build(undefined, reportsBoth, parallel);

      expect(getErrors(stats).join("\n")).toContain("reported error");
      expect(getWarnings(stats).join("\n")).toContain("reported warning");
    });

    it('should file errors as errors when "error"', async () => {
      const stats = await build(
        { severityError: "error" },
        reportsBoth,
        parallel,
      );

      expect(getErrors(stats).join("\n")).toContain("reported error");
      expect(getWarnings(stats).join("\n")).toContain("reported warning");
    });

    it('should file errors as warnings when "warning"', async () => {
      const stats = await build(
        { severityError: "warning" },
        reportsBoth,
        parallel,
      );

      expect(getErrors(stats)).toEqual([]);

      const warnings = getWarnings(stats).join("\n");

      expect(warnings).toContain("reported error");
      expect(warnings).toContain("reported warning");
    });

    it('should file neither when "off"', async () => {
      const stats = await build(
        { severityError: "off" },
        reportsBoth,
        parallel,
      );

      expect(getErrors(stats)).toEqual([]);
      expect(getWarnings(stats)).toEqual([]);
    });

    it("should file what a minimizer threw as an error by default", async () => {
      const stats = await build(undefined, throws, parallel);

      expect(getErrors(stats).join("\n")).toContain("thrown");
      expect(getWarnings(stats)).toEqual([]);
    });

    it('should file what a minimizer threw as a warning when "warning"', async () => {
      const stats = await build({ severityError: "warning" }, throws, parallel);

      expect(getErrors(stats)).toEqual([]);
      expect(getWarnings(stats).join("\n")).toContain("thrown");
    });

    it('should file nothing a minimizer threw when "off"', async () => {
      const stats = await build({ severityError: "off" }, throws, parallel);

      expect(getErrors(stats)).toEqual([]);
      expect(getWarnings(stats)).toEqual([]);
    });
  },
);

/**
 * Stands an awaitable hook in for `NormalModule`'s `processResult`, which is
 * synchronous in every webpack released so far. The plugin taps it to reach
 * `generate`, so without this the whole path is unreachable; the promises it
 * starts are handed back for the test to await.
 */
class AwaitableProcessResult {
  constructor() {
    this.pending = [];
  }

  /**
   * @param {import("webpack").Compiler} compiler compiler
   * @returns {void}
   */
  apply(compiler) {
    compiler.hooks.compilation.tap("AwaitableProcessResult", (compilation) => {
      const hooks =
        compiler.webpack.NormalModule.getCompilationHooks(compilation);
      const taps = [];

      hooks.processResult = {
        tapPromise: (name, fn) => {
          taps.push(fn);
        },
        call: (result, module) => {
          for (const fn of taps) {
            this.pending.push(fn(result, module));
          }

          return result;
        },
      };
    });
  }
}

/**
 * @param {{ [file: string]: string }} input what the module built to
 * @returns {{ code: string }} the same bytes
 */
function passthrough(input) {
  const [[, code]] = Object.entries(input);

  return { code };
}

/**
 * @param {object=} options plugin options beyond the generator
 * @param {(() => never) | (() => { code: string, errors: string[], warnings: string[] })} generate what the generator does
 * @returns {Promise<import("webpack").Stats>} the stats of the build
 */
async function buildGenerated(options, generate) {
  const awaitable = new AwaitableProcessResult();
  const compiler = getCompiler({
    entry: path.resolve(__dirname, "./fixtures/minify/es6.js"),
    output: {
      path: path.resolve(__dirname, "./dist-terser"),
      filename: "[name].js",
      chunkFilename: "[id].[name].js",
    },
  });

  awaitable.apply(compiler);

  new MinimizerPlugin({ ...options, minify: passthrough, generate }).apply(
    compiler,
  );

  const stats = await compile(compiler);

  await Promise.all(awaitable.pending);

  return stats;
}

describe('"severityError" option (generate)', () => {
  it("should file what a generator reported as errors by default", async () => {
    const stats = await buildGenerated(undefined, reportsBoth);

    expect(getErrors(stats).join("\n")).toContain("reported error");
    expect(getWarnings(stats).join("\n")).toContain("reported warning");
  });

  it('should file what a generator reported as warnings when "warning"', async () => {
    const stats = await buildGenerated(
      { severityError: "warning" },
      reportsBoth,
    );

    expect(getErrors(stats)).toEqual([]);

    const warnings = getWarnings(stats).join("\n");

    expect(warnings).toContain("reported error");
    expect(warnings).toContain("reported warning");
  });

  it('should file neither when "off"', async () => {
    const stats = await buildGenerated({ severityError: "off" }, reportsBoth);

    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);
  });

  it("should file what a generator threw as an error by default", async () => {
    const stats = await buildGenerated(undefined, throws);

    expect(getErrors(stats).join("\n")).toContain("thrown");
  });

  it('should file what a generator threw as a warning when "warning"', async () => {
    const stats = await buildGenerated({ severityError: "warning" }, throws);

    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats).join("\n")).toContain("thrown");
  });
});
