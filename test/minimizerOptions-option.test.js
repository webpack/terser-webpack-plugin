import path from "path";

import MinimizerPlugin from "../src/index";

import {
  compile,
  getCompiler,
  getErrors,
  getWarnings,
  readAsset,
  readsAssets,
} from "./helpers";

// An ES module output is not wrapped, so its top-level names are terser's to
// mangle — which is what the `module` option decides.
function getEsmCompiler() {
  return getCompiler({
    entry: path.resolve(__dirname, "./fixtures/entry.mjs"),
    output: {
      filename: "[name].mjs",
      module: true,
      library: { type: "module" },
    },
    experiments: { outputModule: true },
  });
}

/**
 * Builds the same ES module output through a minimizer that only reports the
 * `module` option it was handed.
 * @param {object=} minimizerOptions options given to the plugin
 * @returns {Promise<boolean[]>} the value each asset's minimizer received
 */
async function recordModuleOption(minimizerOptions = {}) {
  const received = [];
  const compiler = getEsmCompiler();

  new MinimizerPlugin({
    minimizerOptions,
    // In a worker the minimizer runs in another process, where it could not
    // report back to this one.
    parallel: false,
    minify: (input, sourceMap, options) => {
      received.push(options.module);

      return { code: Object.values(input)[0] };
    },
  }).apply(compiler);

  await compile(compiler);

  return received;
}

describe("minimizerOptions option", () => {
  it("should accept `minimizerOptions` and apply them like `terserOptions`", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/ecma-5/entry.js"),
      target: ["web", "es5"],
    });

    new MinimizerPlugin({
      minimizerOptions: {
        mangle: false,
        output: {
          beautify: true,
        },
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should treat `terserOptions` as a deprecated alias of `minimizerOptions`", () => {
    const pluginA = new MinimizerPlugin({
      minimizerOptions: { mangle: false },
    });
    const pluginB = new MinimizerPlugin({
      terserOptions: { mangle: false },
    });

    expect(pluginA.options.minimizer.options).toEqual(
      pluginB.options.minimizer.options,
    );
  });

  it("should prefer `minimizerOptions` when both `minimizerOptions` and `terserOptions` are provided", () => {
    const plugin = new MinimizerPlugin({
      minimizerOptions: { mangle: false },
      terserOptions: { mangle: true, compress: false },
    });

    expect(plugin.options.minimizer.options).toEqual({ mangle: false });
  });

  it("should default to an empty object when neither option is provided", () => {
    const plugin = new MinimizerPlugin();

    expect(plugin.options.minimizer.options).toEqual({});
  });

  it("should hand the minimizer the `module` value webpack inferred", async () => {
    expect(await recordModuleOption()).toEqual([true]);
  });

  it("should keep an explicit `module: false` over the value webpack inferred", async () => {
    expect(await recordModuleOption({ module: false })).toEqual([false]);
  });

  it("should keep an explicit `module: false` when terser is the minimizer", async () => {
    const compiler = getEsmCompiler();

    new MinimizerPlugin({ minimizerOptions: { module: false } }).apply(
      compiler,
    );

    const stats = await compile(compiler);
    const code = readAsset("main.mjs", compiler, stats);

    // `module` lets terser mangle top-level names, so an explicit `false` has
    // to reach it: they survive instead.
    expect(code).toContain("function test()");
    expect(getErrors(stats)).toEqual([]);
  });

  it("should still mangle the top level when `module` is left to webpack", async () => {
    const compiler = getEsmCompiler();

    new MinimizerPlugin().apply(compiler);

    const stats = await compile(compiler);

    expect(readAsset("main.mjs", compiler, stats)).not.toContain(
      "function test()",
    );
    expect(getErrors(stats)).toEqual([]);
  });
});
