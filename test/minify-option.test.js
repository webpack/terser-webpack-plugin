import path from "path";

import MinimizerPlugin from "../src";

import {
  BrokenCodePlugin,
  compile,
  getCompiler,
  getErrors,
  getWarnings,
  readsAssets,
} from "./helpers";
import { RUN_CSS_TESTS, RUN_SWC_HTML_TESTS } from "./helpers/env";

/**
 * `describe` where this environment can run the block, `describe.skip` where it
 * cannot, so one file can carry blocks with different requirements.
 * @param {boolean} condition whether this environment can run it
 * @returns {jest.Describe} describe, or describe.skip
 */
const describeIf = (condition) => (condition ? describe : describe.skip);

describe("minify option", () => {
  it("should work", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/minify/es6.js"),
      output: {
        path: path.resolve(__dirname, "./dist-terser"),
        filename: "[name].js",
        chunkFilename: "[id].[name].js",
      },
    });

    new MinimizerPlugin({
      terserOptions: {
        keep_fnames: true,
        mangle: {
          reserved: ["baz"],
        },
      },
      minify(file, inputSourceMap, minimizerOptions) {
        return require("terser").minify(file, minimizerOptions);
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should work when the "parallel" option is "true"', async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/minify/es6.js"),
      output: {
        path: path.resolve(__dirname, "./dist-terser"),
        filename: "[name].js",
        chunkFilename: "[id].[name].js",
      },
    });

    new MinimizerPlugin({
      parallel: true,
      minify(file, inputSourceMap, minimizerOptions) {
        return require("terser").minify(file, minimizerOptions);
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should work when the "parallel" option is "false"', async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/minify/es6.js"),
      output: {
        path: path.resolve(__dirname, "./dist-terser"),
        filename: "[name].js",
        chunkFilename: "[id].[name].js",
      },
    });

    new MinimizerPlugin({
      parallel: false,
      minify(file, inputSourceMap, minimizerOptions) {
        return require("terser").minify(file, minimizerOptions);
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should throw an error when an error", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/minify/es6.js"),
      output: {
        path: path.resolve(__dirname, "./dist-terser"),
        filename: "[name].js",
        chunkFilename: "[id].[name].js",
      },
    });

    new MinimizerPlugin({
      minify() {
        throw new Error("Error");
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should throw an error when an error when the "parallel" option is "true"', async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/minify/es6.js"),
      output: {
        path: path.resolve(__dirname, "./dist-terser"),
        filename: "[name].js",
        chunkFilename: "[id].[name].js",
      },
    });

    new MinimizerPlugin({
      parallel: true,
      minify: () => {
        throw new Error("Error");
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should throw an error when an error when the "parallel" option is "false"', async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/minify/es6.js"),
      output: {
        path: path.resolve(__dirname, "./dist-terser"),
        filename: "[name].js",
        chunkFilename: "[id].[name].js",
      },
    });

    new MinimizerPlugin({
      parallel: false,
      minify: () => {
        throw new Error("Error");
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should output errors and warning", async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      minify: () => ({
        code: "1",
        errors: ["error"],
        warnings: ["warning"],
      }),
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should snapshot with extracting comments", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/minify/es5.js"),
      output: {
        path: path.resolve(__dirname, "./dist-uglify-js"),
        filename: "[name].js",
        chunkFilename: "[id].[name].js",
      },
    });

    new MinimizerPlugin({
      extractComments: true,
      async minify(file) {
        const result = await require("terser").minify(file, {
          mangle: {
            reserved: ["baz"],
          },
        });

        return { ...result, extractedComments: ["/* Foo */"] };
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work with source maps", async () => {
    const compiler = getCompiler({
      devtool: "source-map",
      entry: path.resolve(__dirname, "./fixtures/minify/es6.js"),
      output: {
        path: path.resolve(__dirname, "./dist-terser"),
        filename: "[name].js",
        chunkFilename: "[id].[name].js",
      },
    });

    new MinimizerPlugin({
      minify(file, sourceMap) {
        const terserOption = {
          mangle: {
            reserved: ["baz"],
          },
        };

        if (sourceMap) {
          terserOption.sourceMap = {
            content: sourceMap,
          };
        }

        return require("terser").minify(file, terserOption);
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should work with "uglify-js" minimizer', async () => {
    const compiler = getCompiler({
      target: ["es5", "web"],
      entry: path.resolve(__dirname, "./fixtures/minify/es5.js"),
      output: {
        path: path.resolve(__dirname, "./dist-uglify-js"),
        filename: "[name].js",
        chunkFilename: "[id].[name].js",
      },
    });

    new MinimizerPlugin({
      minify(file) {
        return require("uglify-js").minify(file, {
          mangle: {
            reserved: ["baz"],
          },
        });
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should work with "terser" minimizer', async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/minify/es6.js"),
      output: {
        path: path.resolve(__dirname, "./dist-terser"),
        filename: "[name].js",
        chunkFilename: "[id].[name].js",
      },
    });

    new MinimizerPlugin({
      minify(file) {
        return require("terser").minify(file, {
          mangle: {
            reserved: ["baz"],
          },
        });
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work with custom minimize function and support warnings and errors", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/minify/es6.js"),
      output: {
        path: path.resolve(__dirname, "./dist-terser"),
        filename: "[name].js",
        chunkFilename: "[id].[name].js",
      },
    });

    new MinimizerPlugin({
      minify(file) {
        const isOldNodeJs = process.version.match(/^v(\d+)/)[1] === "10";
        const [[, code]] = Object.entries(file);

        return {
          code,
          warnings: [
            isOldNodeJs
              ? new Error("Warning 1").toString()
              : new Error("Warning 1"),
            "Warnings 2",
          ],
          errors: [
            isOldNodeJs ? "Error 1" : new Error("Error 1"),
            "Error 2",
            { message: "Error 3" },
            { message: "Error 4", filename: "foo.js" },
            { message: "Error 5", filename: "foo.js", line: 0, col: 0 },
            { message: "Error 6", filename: "foo.js", line: 1, col: 1 },
          ],
        };
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `terserMinify`", async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      minify: MinimizerPlugin.terserMinify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `terserMinify` and generate source maps", async () => {
    const compiler = getCompiler({ devtool: "source-map" });

    new MinimizerPlugin({
      minify: MinimizerPlugin.terserMinify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `terserMinify` and allows to set `terser` options", async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      minify: MinimizerPlugin.terserMinify,
      terserOptions: {
        mangle: false,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `terserMinify` and ECMA modules output", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/entry.mjs"),
      output: {
        library: {
          type: "module",
        },
        pathinfo: false,
        filename: "[name].js",
        chunkFilename: "[id].[name].js",
      },
      experiments: {
        outputModule: true,
      },
    });

    new MinimizerPlugin({
      minify: MinimizerPlugin.terserMinify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `terserMinify` and output errors", async () => {
    const compiler = getCompiler();

    new BrokenCodePlugin().apply(compiler);

    new MinimizerPlugin({
      minify: MinimizerPlugin.terserMinify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `terserMinify` and extract comments by default", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/comments.js"),
    });

    new MinimizerPlugin({
      minify: MinimizerPlugin.terserMinify,
      extractComments: true,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `terserMinify` and keep legal comments when extract comments is disabled", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/comments.js"),
    });

    new MinimizerPlugin({
      minify: MinimizerPlugin.terserMinify,
      extractComments: false,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `terserMinify` and allows to disable `compress` options", async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      minify: MinimizerPlugin.terserMinify,
      terserOptions: {
        compress: false,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `uglifyJsMinify`", async () => {
    const compiler = getCompiler({
      target: ["web", "es5"],
    });

    new MinimizerPlugin({
      minify: MinimizerPlugin.uglifyJsMinify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `uglifyJsMinify` and generate source maps", async () => {
    const compiler = getCompiler({
      devtool: "source-map",
      target: ["web", "es5"],
    });

    new MinimizerPlugin({
      minify: MinimizerPlugin.uglifyJsMinify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `uglifyJsMinify` and allows to set `uglify-js` options", async () => {
    const compiler = getCompiler({
      target: ["web", "es5"],
    });

    new MinimizerPlugin({
      minify: MinimizerPlugin.uglifyJsMinify,
      terserOptions: {
        mangle: false,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  // `uglify-js` doesn't support ECMA modules

  it("should work using when the `minify` option is `uglifyJsMinify` and output errors", async () => {
    const compiler = getCompiler({
      target: ["web", "es5"],
      bail: false,
    });

    new BrokenCodePlugin().apply(compiler);

    new MinimizerPlugin({
      minify: MinimizerPlugin.uglifyJsMinify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `uglifyJsMinify` and output warnings", async () => {
    const compiler = getCompiler({
      target: ["web", "es6"],
    });

    new MinimizerPlugin({
      minify: MinimizerPlugin.uglifyJsMinify,
      terserOptions: {
        warnings: true,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `uglifyJsMinify` and extract comments by default", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/comments.js"),
      target: ["web", "es5"],
    });

    new MinimizerPlugin({
      minify: MinimizerPlugin.uglifyJsMinify,
      extractComments: true,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `uglifyJsMinify` and keep legal comments when extract comments is disabled", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/comments.js"),
      target: ["web", "es5"],
    });

    new MinimizerPlugin({
      minify: MinimizerPlugin.uglifyJsMinify,
      extractComments: false,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `swcMinify`", async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      minify: MinimizerPlugin.swcMinify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `swcMinify` and generate source maps", async () => {
    const compiler = getCompiler({ devtool: "source-map" });

    new MinimizerPlugin({
      minify: MinimizerPlugin.swcMinify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `swcMinify` and allows to set `swc` options", async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      minify: MinimizerPlugin.swcMinify,
      terserOptions: {
        mangle: false,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `swcMinify` and ECMA modules output", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/entry.mjs"),
      output: {
        library: {
          type: "module",
        },
        pathinfo: false,
        filename: "[name].js",
        chunkFilename: "[id].[name].js",
      },
      experiments: {
        outputModule: true,
      },
    });

    new MinimizerPlugin({
      minify: MinimizerPlugin.swcMinify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `swcMinify` and output errors", async () => {
    const compiler = getCompiler({
      target: ["web", "es5"],
      bail: false,
    });

    new BrokenCodePlugin().apply(compiler);

    new MinimizerPlugin({
      minify: MinimizerPlugin.swcMinify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(
      getErrors(stats).map((item) => item.replace(" [GenericFailure]", "")),
    ).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `swcMinify` and extract comments by default", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/comments.js"),
    });

    new MinimizerPlugin({
      minify: MinimizerPlugin.swcMinify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(stats.compilation.errors).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `swcMinify` and extract comments using object options", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/comments.js"),
    });

    new MinimizerPlugin({
      minify: MinimizerPlugin.swcMinify,
      extractComments: {
        condition: "all",
        filename: "licenses.txt",
        banner: "For license information please see licenses.txt",
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `swcMinify` and keep legal comments when extract comments is disabled", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/comments.js"),
    });

    new MinimizerPlugin({
      minify: MinimizerPlugin.swcMinify,
      extractComments: /moon/,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should report an error when the `extractComments` option for `swcMinify` uses a function condition", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/comments.js"),
      bail: false,
    });

    new MinimizerPlugin({
      minify: MinimizerPlugin.swcMinify,
      parallel: false,
      extractComments: {
        condition: () => true,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `esbuildMinify`", async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      minify: MinimizerPlugin.esbuildMinify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `esbuildMinify` and generate source maps", async () => {
    const compiler = getCompiler({ devtool: "source-map" });

    new MinimizerPlugin({
      minify: MinimizerPlugin.esbuildMinify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(stats.compilation.errors).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `esbuildMinify` and allows to set `esbuild` options", async () => {
    const compiler = getCompiler();

    new MinimizerPlugin({
      minify: MinimizerPlugin.esbuildMinify,
      terserOptions: {
        minify: false,
        minifyWhitespace: true,
        minifyIdentifiers: false,
        minifySyntax: true,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `esbuildMinify` and ECMA modules output", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/entry.mjs"),
      output: {
        library: {
          type: "module",
        },
        pathinfo: false,
        filename: "[name].js",
        chunkFilename: "[id].[name].js",
      },
      experiments: {
        outputModule: true,
      },
    });

    new MinimizerPlugin({
      minify: MinimizerPlugin.esbuildMinify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `esbuildMinify` and output errors", async () => {
    const compiler = getCompiler();

    new BrokenCodePlugin().apply(compiler);

    new MinimizerPlugin({
      minify: MinimizerPlugin.esbuildMinify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `jsonMinify`", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/json.js"),
    });

    new MinimizerPlugin().apply(compiler);
    new MinimizerPlugin({
      test: /\.json$/i,
      minify: MinimizerPlugin.jsonMinify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `jsonMinify` and allows to set `JSON.stringify` options", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/json.js"),
    });

    new MinimizerPlugin().apply(compiler);
    new MinimizerPlugin({
      test: /\.json$/i,
      minify: MinimizerPlugin.jsonMinify,
      terserOptions: { space: 4, replacer: null },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `jsonMinify` and output errors", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/json-error.js"),
    });

    new MinimizerPlugin().apply(compiler);
    new MinimizerPlugin({
      test: /\.json$/i,
      minify: MinimizerPlugin.jsonMinify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(stats.compilation.errors[0].message).toContain("Unexpected token");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  // Due `esbuild` doesn't support extract comments we keep legal comments by default
  it("should work using when the `minify` option is `esbuildMinify` and keep legal comments when extract comments is disabled", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/comments.js"),
    });

    new MinimizerPlugin({
      minify: MinimizerPlugin.esbuildMinify,
      terserOptions: {
        legalComments: "inline",
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `esbuildMinify` and output well formatted warnings", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/warning.js"),
    });

    new MinimizerPlugin({
      minify: MinimizerPlugin.esbuildMinify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work when `minify` is an array of functions", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/minify/es6.js"),
      output: {
        path: path.resolve(__dirname, "./dist-terser"),
        filename: "[name].js",
        chunkFilename: "[id].[name].js",
      },
    });

    new MinimizerPlugin({
      minify: [
        (file, sourceMap, minimizerOptions) =>
          require("terser").minify(file, minimizerOptions),
        async (file) => {
          const [code] = Object.values(file);

          return { code: `${code}\n/* Appended by second minimizer */` };
        },
      ],
      terserOptions: {
        mangle: false,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work when `minify` and `terserOptions` are both arrays", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/minify/es6.js"),
      output: {
        path: path.resolve(__dirname, "./dist-terser"),
        filename: "[name].js",
        chunkFilename: "[id].[name].js",
      },
    });

    new MinimizerPlugin({
      minify: [
        (file, sourceMap, minimizerOptions) =>
          require("terser").minify(file, minimizerOptions),
        (file, sourceMap, minimizerOptions) =>
          require("terser").minify(file, minimizerOptions),
      ],
      terserOptions: [
        { mangle: false },
        { mangle: true, compress: { passes: 2 } },
      ],
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should merge warnings and errors from all minimizers in an array", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/minify/es6.js"),
    });

    new MinimizerPlugin({
      parallel: false,
      minify: [
        async (file) => ({
          code: Object.values(file)[0],
          warnings: ["warning from first"],
          errors: ["error from first"],
        }),
        async (file) => ({
          code: Object.values(file)[0],
          warnings: ["warning from second"],
          errors: ["error from second"],
        }),
      ],
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should error when the minimizer returns only warnings (no code)", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/minify/es6.js"),
    });

    new MinimizerPlugin({
      parallel: false,
      minify: async () => ({ warnings: ["just a warning, no code"] }),
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should error when the minimizer returns only extracted comments (no code)", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/minify/es6.js"),
    });

    new MinimizerPlugin({
      parallel: false,
      minify: async () => ({
        extractedComments: ["/*! @license from no-code minimizer */"],
      }),
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should carry the last good code forward when a step in the array returns no code", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/minify/es6.js"),
    });

    new MinimizerPlugin({
      parallel: false,
      minify: [
        (file, sourceMap, minimizerOptions) =>
          require("terser").minify(file, minimizerOptions),
        // Middle step returns only a warning - next step must get the previous code
        async () => ({ warnings: ["middle step did nothing"] }),
        async (file) => {
          const [code] = Object.values(file);

          return { code: `${code}\n/* Appended after skipped middle step */` };
        },
      ],
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `htmlMinifierTerser`", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/html.js"),
    });

    new MinimizerPlugin().apply(compiler);
    new MinimizerPlugin({
      test: /\.html(\?.*)?$/i,
      minify: MinimizerPlugin.htmlMinifierTerser,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `htmlMinifierTerser` and allows to set `html-minifier-terser` options", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/html.js"),
    });

    new MinimizerPlugin().apply(compiler);
    new MinimizerPlugin({
      test: /\.html(\?.*)?$/i,
      minify: MinimizerPlugin.htmlMinifierTerser,
      minimizerOptions: {
        collapseWhitespace: false,
        removeComments: false,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should work using when the `minify` option is `htmlMinifierTerser` and the "parallel" option is "true"', async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/html.js"),
    });

    new MinimizerPlugin().apply(compiler);
    new MinimizerPlugin({
      test: /\.html(\?.*)?$/i,
      minify: MinimizerPlugin.htmlMinifierTerser,
      parallel: true,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should work using when the `minify` option is `htmlMinifierTerser` and the "parallel" option is "false"', async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/html.js"),
    });

    new MinimizerPlugin().apply(compiler);
    new MinimizerPlugin({
      test: /\.html(\?.*)?$/i,
      minify: MinimizerPlugin.htmlMinifierTerser,
      parallel: false,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `minifyHtmlNode`", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/html.js"),
    });

    new MinimizerPlugin().apply(compiler);
    new MinimizerPlugin({
      test: /\.html(\?.*)?$/i,
      minify: MinimizerPlugin.minifyHtmlNode,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work using when the `minify` option is `minifyHtmlNode` and allows to set `@minify-html/node` options", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/html.js"),
    });

    new MinimizerPlugin().apply(compiler);
    new MinimizerPlugin({
      test: /\.html(\?.*)?$/i,
      minify: MinimizerPlugin.minifyHtmlNode,
      minimizerOptions: {
        keep_comments: true,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work when `minify` is an array of functions using `htmlMinifierTerser`", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/html.js"),
    });

    new MinimizerPlugin().apply(compiler);
    new MinimizerPlugin({
      test: /\.html(\?.*)?$/i,
      minify: [
        MinimizerPlugin.htmlMinifierTerser,
        // Second pass: pass-through that asserts the previous minimizer
        // produced a string we can keep working with.
        (data) => {
          const [[, code]] = Object.entries(data);

          return { code };
        },
      ],
      minimizerOptions: [
        { collapseWhitespace: true, removeComments: true },
        {},
      ],
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work when `minify` is an array of functions and dispatches by `filter`", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/html.js"),
    });

    new MinimizerPlugin({
      test: /\.(?:[cm]?js|html?)(\?.*)?$/i,
      minify: [
        MinimizerPlugin.terserMinify,
        MinimizerPlugin.htmlMinifierTerser,
      ],
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should skip assets when the only minimizer's `filter` returns `false`", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/minify/es6.js"),
      output: {
        path: path.resolve(__dirname, "./dist-terser"),
        filename: "[name].js",
        chunkFilename: "[id].[name].js",
      },
    });

    const minify = (file) => {
      const [[, code]] = Object.entries(file);

      return { code: `/* minified */${code}` };
    };

    minify.filter = () => false;

    new MinimizerPlugin({
      parallel: false,
      minify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should treat a `filter` returning `undefined` as accept", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/minify/es6.js"),
      output: {
        path: path.resolve(__dirname, "./dist-terser"),
        filename: "[name].js",
        chunkFilename: "[id].[name].js",
      },
    });

    const minify = (file) => {
      const [[, code]] = Object.entries(file);

      return { code: `/* undef-filter */${code}` };
    };

    minify.filter = () => undefined;

    new MinimizerPlugin({
      parallel: false,
      minify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should skip assets when every minimizer in the `minify` array rejects them via `filter`", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/minify/es6.js"),
      output: {
        path: path.resolve(__dirname, "./dist-terser"),
        filename: "[name].js",
        chunkFilename: "[id].[name].js",
      },
    });

    const cssOnly = (file) => {
      const [[, code]] = Object.entries(file);

      return { code: `/* css */${code}` };
    };

    cssOnly.filter = (name) => /\.css(\?.*)?$/i.test(name);

    const htmlOnly = (file) => {
      const [[, code]] = Object.entries(file);

      return { code: `/* html */${code}` };
    };

    htmlOnly.filter = (name) => /\.html?(\?.*)?$/i.test(name);

    new MinimizerPlugin({
      parallel: false,
      minify: [cssOnly, htmlOnly],
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should pass an empty source content on to the next minimizer", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/entry.js"),
      devtool: "source-map",
    });

    let received;

    new MinimizerPlugin({
      parallel: false,
      minify: [
        (file) => ({
          code: Object.values(file)[0],
          map: {
            version: 3,
            sources: ["inlined-empty.js"],
            sourcesContent: [""],
            names: [],
            mappings: "AAAA",
          },
        }),
        (file, sourceMap) => {
          received = sourceMap;

          return { code: Object.values(file)[0] };
        },
      ],
    }).apply(compiler);

    const stats = await compile(compiler);

    // An empty file has content — `""` — and that is a different answer from
    // the absent one that sends a consumer off to fetch the file itself.
    expect(received.sources).toEqual(["inlined-empty.js"]);
    expect(received.sourcesContent).toEqual([""]);
    expect(getErrors(stats)).toEqual([]);
  });
});

describe("css minify option", () => {
  // The bundled minimizers this block drives need more of the
  // environment than the rest of this file does.
  describeIf(RUN_CSS_TESTS)("with its minimizers installed", () => {
    it("should work using when the `minify` option is `cssnanoMinify`", async () => {
      const compiler = getCompiler({
        entry: path.resolve(__dirname, "./fixtures/css.js"),
      });

      new MinimizerPlugin().apply(compiler);
      new MinimizerPlugin({
        test: /\.css(\?.*)?$/i,
        minify: MinimizerPlugin.cssnanoMinify,
      }).apply(compiler);

      const stats = await compile(compiler);

      expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
      expect(getErrors(stats)).toMatchSnapshot("errors");
      expect(getWarnings(stats)).toMatchSnapshot("warnings");
    });

    it("should work using when the `minify` option is `cssnanoMinify` and allows to set `cssnano` options", async () => {
      const compiler = getCompiler({
        entry: path.resolve(__dirname, "./fixtures/css.js"),
      });

      new MinimizerPlugin().apply(compiler);
      new MinimizerPlugin({
        test: /\.css(\?.*)?$/i,
        minify: MinimizerPlugin.cssnanoMinify,
        minimizerOptions: { preset: ["default", { discardComments: false }] },
      }).apply(compiler);

      const stats = await compile(compiler);

      expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
      expect(getErrors(stats)).toMatchSnapshot("errors");
      expect(getWarnings(stats)).toMatchSnapshot("warnings");
    });

    it("should work using when the `minify` option is `cssoMinify`", async () => {
      const compiler = getCompiler({
        entry: path.resolve(__dirname, "./fixtures/css.js"),
      });

      new MinimizerPlugin().apply(compiler);
      new MinimizerPlugin({
        test: /\.css(\?.*)?$/i,
        minify: MinimizerPlugin.cssoMinify,
      }).apply(compiler);

      const stats = await compile(compiler);

      expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
      expect(getErrors(stats)).toMatchSnapshot("errors");
      expect(getWarnings(stats)).toMatchSnapshot("warnings");
    });

    it("should work using when the `minify` option is `cssoMinify` and allows to set `csso` options", async () => {
      const compiler = getCompiler({
        entry: path.resolve(__dirname, "./fixtures/css.js"),
      });

      new MinimizerPlugin().apply(compiler);
      new MinimizerPlugin({
        test: /\.css(\?.*)?$/i,
        minify: MinimizerPlugin.cssoMinify,
        minimizerOptions: { comments: false },
      }).apply(compiler);

      const stats = await compile(compiler);

      expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
      expect(getErrors(stats)).toMatchSnapshot("errors");
      expect(getWarnings(stats)).toMatchSnapshot("warnings");
    });

    it("should work using when the `minify` option is `cleanCssMinify`", async () => {
      const compiler = getCompiler({
        entry: path.resolve(__dirname, "./fixtures/css.js"),
      });

      new MinimizerPlugin().apply(compiler);
      new MinimizerPlugin({
        test: /\.css(\?.*)?$/i,
        minify: MinimizerPlugin.cleanCssMinify,
      }).apply(compiler);

      const stats = await compile(compiler);

      expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
      expect(getErrors(stats)).toMatchSnapshot("errors");
      expect(getWarnings(stats)).toMatchSnapshot("warnings");
    });

    it("should work using when the `minify` option is `cleanCssMinify` and allows to set `clean-css` options", async () => {
      const compiler = getCompiler({
        entry: path.resolve(__dirname, "./fixtures/css.js"),
      });

      new MinimizerPlugin().apply(compiler);
      new MinimizerPlugin({
        test: /\.css(\?.*)?$/i,
        minify: MinimizerPlugin.cleanCssMinify,
        minimizerOptions: { format: "beautify" },
      }).apply(compiler);

      const stats = await compile(compiler);

      expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
      expect(getErrors(stats)).toMatchSnapshot("errors");
      expect(getWarnings(stats)).toMatchSnapshot("warnings");
    });

    it("should work using when the `minify` option is `esbuildMinifyCss`", async () => {
      const compiler = getCompiler({
        entry: path.resolve(__dirname, "./fixtures/css.js"),
      });

      new MinimizerPlugin().apply(compiler);
      new MinimizerPlugin({
        test: /\.css(\?.*)?$/i,
        minify: MinimizerPlugin.esbuildMinifyCss,
      }).apply(compiler);

      const stats = await compile(compiler);

      expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
      expect(getErrors(stats)).toMatchSnapshot("errors");
      expect(getWarnings(stats)).toMatchSnapshot("warnings");
    });

    it("should work using when the `minify` option is `lightningCssMinify`", async () => {
      const compiler = getCompiler({
        entry: path.resolve(__dirname, "./fixtures/css.js"),
      });

      new MinimizerPlugin().apply(compiler);
      new MinimizerPlugin({
        test: /\.css(\?.*)?$/i,
        minify: MinimizerPlugin.lightningCssMinify,
      }).apply(compiler);

      const stats = await compile(compiler);

      expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
      expect(getErrors(stats)).toMatchSnapshot("errors");
      expect(getWarnings(stats)).toMatchSnapshot("warnings");
    });

    it("should work using when the `minify` option is `swcMinifyCss`", async () => {
      const compiler = getCompiler({
        entry: path.resolve(__dirname, "./fixtures/css.js"),
      });

      new MinimizerPlugin().apply(compiler);
      new MinimizerPlugin({
        test: /\.css(\?.*)?$/i,
        minify: MinimizerPlugin.swcMinifyCss,
      }).apply(compiler);

      const stats = await compile(compiler);

      expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
      expect(getErrors(stats)).toMatchSnapshot("errors");
      expect(getWarnings(stats)).toMatchSnapshot("warnings");
    });

    it("should work when `minify` is an array of functions using `cssnanoMinify`", async () => {
      const compiler = getCompiler({
        entry: path.resolve(__dirname, "./fixtures/css.js"),
      });

      new MinimizerPlugin().apply(compiler);
      new MinimizerPlugin({
        test: /\.css(\?.*)?$/i,
        minify: [
          MinimizerPlugin.cssnanoMinify,
          // Second pass: pass-through that asserts the previous minimizer
          // produced a string we can keep working with.
          (data) => {
            const [[, code]] = Object.entries(data);

            return { code };
          },
        ],
        minimizerOptions: [{ preset: "default" }, {}],
      }).apply(compiler);

      const stats = await compile(compiler);

      expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
      expect(getErrors(stats)).toMatchSnapshot("errors");
      expect(getWarnings(stats)).toMatchSnapshot("warnings");
    });

    it("should work and merge source maps when `minify` is an array of `terserMinify` minimizers", async () => {
      const compiler = getCompiler({
        devtool: "source-map",
        entry: path.resolve(__dirname, "./fixtures/minify/es6.js"),
        output: {
          path: path.resolve(__dirname, "./dist-terser"),
          filename: "[name].js",
          chunkFilename: "[id].[name].js",
        },
      });

      new MinimizerPlugin({
        minify: [MinimizerPlugin.terserMinify, MinimizerPlugin.terserMinify],
        minimizerOptions: [{ mangle: false }, { mangle: true }],
      }).apply(compiler);

      const stats = await compile(compiler);

      expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
      expect(getErrors(stats)).toMatchSnapshot("errors");
      expect(getWarnings(stats)).toMatchSnapshot("warnings");
    });

    it("should work and merge source maps when `minify` mixes `terserMinify` with `uglifyJsMinify`", async () => {
      const compiler = getCompiler({
        devtool: "source-map",
        entry: path.resolve(__dirname, "./fixtures/minify/es6.js"),
        output: {
          path: path.resolve(__dirname, "./dist-terser"),
          filename: "[name].js",
          chunkFilename: "[id].[name].js",
        },
      });

      new MinimizerPlugin({
        minify: [MinimizerPlugin.terserMinify, MinimizerPlugin.uglifyJsMinify],
        minimizerOptions: [{ mangle: false }, { mangle: true }],
      }).apply(compiler);

      const stats = await compile(compiler);

      expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
      expect(getErrors(stats)).toMatchSnapshot("errors");
      expect(getWarnings(stats)).toMatchSnapshot("warnings");
    });

    it("should work and merge source maps when `minify` is an array of CSS minimizers", async () => {
      const compiler = getCompiler({
        devtool: "source-map",
        entry: path.resolve(__dirname, "./fixtures/css.js"),
      });

      new MinimizerPlugin().apply(compiler);
      new MinimizerPlugin({
        test: /\.css(\?.*)?$/i,
        minify: [MinimizerPlugin.cssnanoMinify, MinimizerPlugin.cssnanoMinify],
        minimizerOptions: [{ preset: "default" }, { preset: "default" }],
      }).apply(compiler);

      const stats = await compile(compiler);

      expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
      expect(getErrors(stats)).toMatchSnapshot("errors");
      expect(getWarnings(stats)).toMatchSnapshot("warnings");
    });

    it("should work and merge source maps when `minify` mixes `terserMinify` with `swcMinify`", async () => {
      const compiler = getCompiler({
        devtool: "source-map",
        entry: path.resolve(__dirname, "./fixtures/minify/es6.js"),
        output: {
          path: path.resolve(__dirname, "./dist-terser"),
          filename: "[name].js",
          chunkFilename: "[id].[name].js",
        },
      });

      new MinimizerPlugin({
        minify: [MinimizerPlugin.terserMinify, MinimizerPlugin.swcMinify],
        minimizerOptions: [{ mangle: false }, {}],
      }).apply(compiler);

      const stats = await compile(compiler);

      expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
      expect(getErrors(stats)).toMatchSnapshot("errors");
      expect(getWarnings(stats)).toMatchSnapshot("warnings");
    });

    it("should work and merge source maps when `minify` mixes `terserMinify` with `esbuildMinify`", async () => {
      const compiler = getCompiler({
        devtool: "source-map",
        entry: path.resolve(__dirname, "./fixtures/minify/es6.js"),
        output: {
          path: path.resolve(__dirname, "./dist-terser"),
          filename: "[name].js",
          chunkFilename: "[id].[name].js",
        },
      });

      new MinimizerPlugin({
        minify: [MinimizerPlugin.terserMinify, MinimizerPlugin.esbuildMinify],
        minimizerOptions: [{ mangle: false }, {}],
      }).apply(compiler);

      const stats = await compile(compiler);

      expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
      expect(getErrors(stats)).toMatchSnapshot("errors");
      expect(getWarnings(stats)).toMatchSnapshot("warnings");
    });

    it("should minify js, json, css, and html assets emitted in the same compilation using a single plugin instance", async () => {
      const compiler = getCompiler({
        entry: path.resolve(__dirname, "./fixtures/multi-asset.js"),
      });

      new MinimizerPlugin({
        test: /\.([cm]?js|json|css|html?)(\?.*)?$/i,
        parallel: false,
        minify: [
          MinimizerPlugin.terserMinify,
          MinimizerPlugin.jsonMinify,
          MinimizerPlugin.cleanCssMinify,
          MinimizerPlugin.htmlMinifierTerser,
        ],
      }).apply(compiler);

      const stats = await compile(compiler);

      expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
      expect(getErrors(stats)).toMatchSnapshot("errors");
      expect(getWarnings(stats)).toMatchSnapshot("warnings");
    });

    // The chain runs through every CSS minimizer; `esbuild` is the
    // tightest constraint at Node >=18.
    it("should work and merge source maps when `minify` mixes CSS minimizers using `cssnano`, `csso`, `cleanCss`, `lightningCss`, `swcCss`, and `esbuild`", async () => {
      const compiler = getCompiler({
        devtool: "source-map",
        entry: path.resolve(__dirname, "./fixtures/css.js"),
      });

      new MinimizerPlugin().apply(compiler);
      new MinimizerPlugin({
        test: /\.css(\?.*)?$/i,
        minify: [
          MinimizerPlugin.cssnanoMinify,
          MinimizerPlugin.cssoMinify,
          MinimizerPlugin.cleanCssMinify,
          MinimizerPlugin.lightningCssMinify,
          MinimizerPlugin.swcMinifyCss,
          MinimizerPlugin.esbuildMinifyCss,
        ],
        minimizerOptions: [{ preset: "default" }, {}, {}, {}, {}, {}],
      }).apply(compiler);

      const stats = await compile(compiler);

      expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
      expect(getErrors(stats)).toMatchSnapshot("errors");
      expect(getWarnings(stats)).toMatchSnapshot("warnings");
    });
  });
});

describe("swc html minify option", () => {
  // The bundled minimizers this block drives need more of the
  // environment than the rest of this file does.
  describeIf(RUN_SWC_HTML_TESTS)("with its minimizers installed", () => {
    it("should work using when the `minify` option is `swcMinifyHtml`", async () => {
      const compiler = getCompiler({
        entry: path.resolve(__dirname, "./fixtures/html.js"),
      });

      new MinimizerPlugin().apply(compiler);
      new MinimizerPlugin({
        test: /\.html(\?.*)?$/i,
        minify: MinimizerPlugin.swcMinifyHtml,
      }).apply(compiler);

      const stats = await compile(compiler);

      expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
      expect(getErrors(stats)).toMatchSnapshot("errors");
      expect(getWarnings(stats)).toMatchSnapshot("warnings");
    });

    it("should work using when the `minify` option is `swcMinifyHtml` and allows to set `@swc/html` options", async () => {
      const compiler = getCompiler({
        entry: path.resolve(__dirname, "./fixtures/html.js"),
      });

      new MinimizerPlugin().apply(compiler);
      new MinimizerPlugin({
        test: /\.html(\?.*)?$/i,
        minify: MinimizerPlugin.swcMinifyHtml,
        minimizerOptions: {
          removeComments: false,
        },
      }).apply(compiler);

      const stats = await compile(compiler);

      expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
      expect(getErrors(stats)).toMatchSnapshot("errors");
      expect(getWarnings(stats)).toMatchSnapshot("warnings");
    });

    it("should work using when the `minify` option is `swcMinifyHtmlFragment`", async () => {
      const compiler = getCompiler({
        entry: path.resolve(__dirname, "./fixtures/html-fragment.js"),
      });

      new MinimizerPlugin().apply(compiler);
      new MinimizerPlugin({
        test: /\.html(\?.*)?$/i,
        minify: MinimizerPlugin.swcMinifyHtmlFragment,
      }).apply(compiler);

      const stats = await compile(compiler);

      expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
      expect(getErrors(stats)).toMatchSnapshot("errors");
      expect(getWarnings(stats)).toMatchSnapshot("warnings");
    });
  });
});
