import path from "path";

import MinimizerPlugin from "../src";

import { compile, getCompiler, getErrors, getWarnings } from "./helpers";

/**
 * @param {object=} options plugin options beyond the minimizer
 * @param {(() => never) | (() => { code: string, errors: Error[], warnings: Error[] })} minify what the minimizer does
 * @returns {Promise<import("webpack").Stats>} the stats of the build
 */
async function build(options, minify) {
  const compiler = getCompiler({
    entry: path.resolve(__dirname, "./fixtures/minify/es6.js"),
    output: {
      path: path.resolve(__dirname, "./dist-terser"),
      filename: "[name].js",
      chunkFilename: "[id].[name].js",
    },
  });

  new MinimizerPlugin({ ...options, minify }).apply(compiler);

  return compile(compiler);
}

/**
 * A minimizer that reports one of each rather than throwing.
 * @returns {{ code: string, errors: Error[], warnings: Error[] }} what it reported
 */
function reportsBoth() {
  return {
    code: "0",
    errors: [new Error("reported error")],
    warnings: [new Error("reported warning")],
  };
}

/**
 * A minimizer that throws, which the plugin files as an error of its own.
 * @returns {never} nothing; it always throws
 */
function throws() {
  throw new Error("thrown");
}

describe('"severityError" option', () => {
  it("should file errors as errors by default", async () => {
    const stats = await build(undefined, reportsBoth);

    expect(getErrors(stats).join("\n")).toContain("reported error");
    expect(getWarnings(stats).join("\n")).toContain("reported warning");
  });

  it('should file errors as errors when "error"', async () => {
    const stats = await build({ severityError: "error" }, reportsBoth);

    expect(getErrors(stats).join("\n")).toContain("reported error");
    expect(getWarnings(stats).join("\n")).toContain("reported warning");
  });

  it('should file errors as warnings when "warning"', async () => {
    const stats = await build({ severityError: "warning" }, reportsBoth);

    expect(getErrors(stats)).toEqual([]);

    const warnings = getWarnings(stats).join("\n");

    expect(warnings).toContain("reported error");
    expect(warnings).toContain("reported warning");
  });

  it('should file neither when "off"', async () => {
    const stats = await build({ severityError: "off" }, reportsBoth);

    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);
  });

  it("should file what a minimizer threw as an error by default", async () => {
    const stats = await build(undefined, throws);

    expect(getErrors(stats).join("\n")).toContain("thrown");
    expect(getWarnings(stats)).toEqual([]);
  });

  it('should file what a minimizer threw as a warning when "warning"', async () => {
    const stats = await build({ severityError: "warning" }, throws);

    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats).join("\n")).toContain("thrown");
  });

  it('should file nothing a minimizer threw when "off"', async () => {
    const stats = await build({ severityError: "off" }, throws);

    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);
  });
});
