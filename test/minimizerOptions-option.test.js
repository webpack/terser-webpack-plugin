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

describe("terserOptions option", () => {
  it('should match snapshot for the "ecma" and set the option depending on the "output.environment" option ("es3")', async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/ecma-5/entry.js"),
      target: ["web", "es3"],
    });

    new MinimizerPlugin({
      terserOptions: {
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

  it('should match snapshot for the "ecma" and set the option depending on the "output.environment" option ("es5")', async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/ecma-5/entry.js"),
      target: ["web", "es5"],
    });

    new MinimizerPlugin({
      terserOptions: {
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

  it('should match snapshot for the "ecma" and set the option depending on the "output.environment" option ("es2020")', async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/ecma-5/entry.js"),
      target: ["web", "es2020"],
    });

    new MinimizerPlugin({
      terserOptions: {
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

  it('should match snapshot for the "ecma" option with the "5" value', async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/ecma-5/entry.js"),
    });

    new MinimizerPlugin({
      terserOptions: {
        ecma: 5,
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

  it('should match snapshot for the "ecma" option with the "5" value ("swc")', async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/ecma-5/entry.js"),
    });

    new MinimizerPlugin({
      minify: MinimizerPlugin.swcMinify,
      terserOptions: {
        ecma: 5,
        mangle: false,
        format: {
          beautify: true,
        },
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "ecma" option with the "6" value', async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/ecma-6/entry.js"),
    });

    new MinimizerPlugin({
      terserOptions: {
        ecma: 6,
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

  it('should match snapshot for the "ecma" option with the "6" value ("swc")', async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/ecma-6/entry.js"),
    });

    new MinimizerPlugin({
      minify: MinimizerPlugin.swcMinify,
      terserOptions: {
        ecma: 6,
        mangle: false,
        format: {
          beautify: true,
        },
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "ecma" option with the "7" value', async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/ecma-7/entry.js"),
    });

    new MinimizerPlugin({
      terserOptions: {
        ecma: 7,
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

  it('should match snapshot for the "ecma" option with the "8" value', async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/ecma-8/entry.js"),
    });

    new MinimizerPlugin({
      terserOptions: {
        ecma: 8,
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

  it('should match snapshot for the "parse.ecma" option with the "8" value', async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      terserOptions: {
        parse: {
          ecma: 8,
        },
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "compress" option with the "false" value', async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      terserOptions: {
        compress: false,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "compress" option with the "true" value', async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      terserOptions: {
        compress: true,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "compress" option with an object value', async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      terserOptions: {
        compress: {
          join_vars: false,
        },
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "mangle" option with the "false" value', async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      terserOptions: {
        mangle: false,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "mangle" option with the "true" value', async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      terserOptions: {
        mangle: true,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "mangle" option with object values', async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      terserOptions: {
        mangle: {
          reserved: ["baz"],
        },
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "module" option with the "false" value', async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      terserOptions: {
        module: false,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "module" option with the "true" value', async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      terserOptions: {
        module: true,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "output.beautify" option with "true" value', async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      terserOptions: {
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

  it('should match snapshot for the "output.comments" option with the "true"', async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      terserOptions: {
        output: {
          comments: true,
        },
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "format.beautify" option with "true" value', async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      terserOptions: {
        format: {
          beautify: true,
        },
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "format.comments" option with the "true"', async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      terserOptions: {
        format: {
          comments: true,
        },
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "toplevel" option with the "false" value', async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      terserOptions: {
        toplevel: false,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "toplevel" option with the "true" value', async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      terserOptions: {
        toplevel: true,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "nameCache" option with a empty object value', async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      terserOptions: {
        nameCache: {},
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "ie8" option with the "false" value', async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      terserOptions: {
        ie8: false,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "ie8" option with the "true" value', async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      terserOptions: {
        ie8: true,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "keep_classnames" option with the "false" value', async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      terserOptions: {
        keep_classnames: false,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "keep_classnames" option with the "true" value', async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      terserOptions: {
        keep_classnames: true,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "keep_fnames" option with the "false" value', async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      terserOptions: {
        keep_fnames: false,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "keep_fnames" option with the "true" value', async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      terserOptions: {
        keep_fnames: true,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "safari10" option with the "false" value', async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      terserOptions: {
        safari10: false,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "safari10" option with the "true" value', async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      terserOptions: {
        safari10: true,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "unknown" option', async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      parallel: false,
      terserOptions: {
        output: {
          unknown: true,
        },
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });
});

describe("the `ecma` handed to a minimizer", () => {
  // Every flag `getEcmaVersion` reads, all off, so a case turns exactly one on
  // and webpack's own defaults cannot raise the answer behind it.
  const NOTHING_SUPPORTED = {
    arrowFunction: false,
    asyncFunction: false,
    bigIntLiteral: false,
    const: false,
    destructuring: false,
    dynamicImport: false,
    dynamicImportInWorker: false,
    forOf: false,
    globalThis: false,
    methodShorthand: false,
    module: false,
    optionalChaining: false,
    templateLiteral: false,
    // Not an ES feature, so it must not move the answer.
    document: false,
    nodePrefixForCoreModules: false,
  };

  /**
   * Records the `ecma` it was handed and rewrites nothing.
   * @param {{ [file: string]: string }} input input
   * @param {undefined} sourceMap source map
   * @param {{ ecma?: number }} minimizerOptions the options as they arrived
   * @returns {{ code: string }} the input, unchanged
   */
  function records(input, sourceMap, minimizerOptions) {
    const [[, code]] = Object.entries(input);

    records.ecma = minimizerOptions.ecma;

    return { code };
  }

  /**
   * @param {object} environment what the target is said to support
   * @returns {Promise<number | undefined>} the `ecma` the minimizer received
   */
  async function ecmaFor(environment) {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/minify/es6.js"),
      output: { environment: { ...NOTHING_SUPPORTED, ...environment } },
    });

    // In process, or the recording happens in a worker and never comes back.
    new MinimizerPlugin({ parallel: false, minify: records }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toEqual([]);

    return records.ecma;
  }

  it.each([
    [5, {}],
    [5, { document: true }],
    [5, { nodePrefixForCoreModules: true }],
    [2015, { arrowFunction: true }],
    [2015, { const: true }],
    [2015, { destructuring: true }],
    [2015, { forOf: true }],
    [2015, { methodShorthand: true }],
    [2015, { module: true }],
    [2015, { templateLiteral: true }],
    [2017, { asyncFunction: true }],
    [2020, { bigIntLiteral: true }],
    [2020, { dynamicImport: true }],
    [2020, { dynamicImportInWorker: true }],
    [2020, { globalThis: true }],
    [2020, { optionalChaining: true }],
    // The highest version any flag implies is the one that reaches it.
    [2020, { arrowFunction: true, asyncFunction: true, bigIntLiteral: true }],
    [2017, { arrowFunction: true, asyncFunction: true }],
    [2015, { arrowFunction: true, const: true, document: true }],
  ])("should be %i for %o", async (expected, environment) => {
    await expect(ecmaFor(environment)).resolves.toBe(expected);
  });
});
