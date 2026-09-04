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
