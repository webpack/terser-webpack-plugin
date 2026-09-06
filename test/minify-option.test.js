import fs from "fs";
import path from "path";

import MinimizerPlugin from "../src";
import {
  cleanCssMinify,
  cssnanoMinify,
  cssoMinify,
  esbuildMinify,
  esbuildMinifyCss,
  htmlMinifierTerser,
  imageminMinify,
  jsonMinify,
  lightningCssMinify,
  minifyHtmlNode,
  napiRsImageMinify,
  packageVersion,
  sharpMinify,
  svgoMinify,
  swcMinify,
  swcMinifyCss,
  swcMinifyHtml,
  swcMinifyHtmlFragment,
  terserMinify,
  uglifyJsMinify,
} from "../src/utils";

import {
  BrokenCodePlugin,
  compile,
  getCompiler,
  getErrors,
  getWarnings,
  readsAssets,
} from "./helpers";

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

/**
 * Stands in for a real minimizer: what is under test is which assets are
 * offered, not what any minimizer makes of them. Self-contained, so it survives
 * being serialized into the worker, and free of any dependency the legacy Node
 * rows cannot load.
 * @returns {Promise<{ code: string }>} a fixed, shorter result
 */
const shorten = async () => ({ code: "min" });

const MINIFIED = 3;

// `output.assetModuleFilename` is `[hash][ext][query][fragment]` by default, so
// an asset imported with a query carries it in its emitted name. A rule naming
// the file has to accept it anyway.

/**
 * @param {object} options plugin options
 * @param {string=} assetModuleFilename asset name template
 * @returns {Promise<{ names: string[], sizes: { [name: string]: number } }>} what was emitted
 */
async function build(options, assetModuleFilename = "[name][ext][query]") {
  const compiler = getCompiler({
    entry: path.resolve(__dirname, "./fixtures/query-asset.js"),
    output: {
      pathinfo: false,
      path: path.resolve(__dirname, "dist"),
      filename: "[name].js",
      assetModuleFilename,
    },
    module: {
      rules: [{ test: /\.svg$/i, type: "asset/resource" }],
    },
  });

  new MinimizerPlugin(options).apply(compiler);

  const stats = await compile(compiler);

  expect(getErrors(stats)).toEqual([]);
  expect(getWarnings(stats)).toEqual([]);

  const assets = stats
    .toJson({ all: false, assets: true })
    .assets.filter((asset) => !asset.name.endsWith(".js"));

  /** @type {{ [name: string]: number }} */
  const sizes = {};

  for (const asset of assets) {
    sizes[asset.name] = asset.size;
  }

  return { names: assets.map((asset) => asset.name), sizes };
}

const ORIGINAL = 302;

describe("a query in the asset name", () => {
  it("should be carried by the emitted name", async () => {
    const { names } = await build({
      test: /\.nothing$/,
      minify: shorten,
    });

    expect(names).toEqual(["image.svg?v=2"]);
  });

  it("should not stop a `test` that names only the file", async () => {
    const { sizes } = await build({
      // Without the fix this matches nothing: the name ends in `?v=2`.
      test: /\.svg$/i,
      minify: shorten,
    });

    expect(sizes["image.svg?v=2"]).toBe(MINIFIED);
  });

  it("should still accept a `test` written for the query form", async () => {
    const { sizes } = await build({
      test: /\.svg(\?.*)?$/i,
      minify: shorten,
    });

    expect(sizes["image.svg?v=2"]).toBe(MINIFIED);
  });

  it("should let a `test` name the query itself", async () => {
    const { sizes } = await build({
      test: /\?v=2$/,
      minify: shorten,
    });

    expect(sizes["image.svg?v=2"]).toBe(MINIFIED);
  });

  it.each([
    ["names only the file", /\.svg$/i],
    ["names the query form", /\.svg(\?.*)?$/i],
    ["names the query itself", /\?v=2$/],
  ])("should honour an `exclude` that %s", async (_name, exclude) => {
    const { sizes } = await build({
      test: /\.svg(\?.*)?$/i,
      exclude,
      minify: shorten,
    });

    expect(sizes["image.svg?v=2"]).toBe(ORIGINAL);
  });

  it("should honour an `include` that names only the file", async () => {
    const { sizes } = await build({
      test: /\.svg(\?.*)?$/i,
      include: /image\.svg$/i,
      minify: shorten,
    });

    expect(sizes["image.svg?v=2"]).toBe(MINIFIED);
  });

  it("should not minify an asset no `include` accepts", async () => {
    const { sizes } = await build({
      test: /\.svg(\?.*)?$/i,
      include: /somewhere-else/,
      minify: shorten,
    });

    expect(sizes["image.svg?v=2"]).toBe(ORIGINAL);
  });

  it("should read the extension past a fragment as well", async () => {
    const { names, sizes } = await build(
      { test: /\.svg$/i, minify: shorten },
      "[name][ext][query][fragment]",
    );

    expect(names).toEqual(["image.svg?v=2"]);
    expect(sizes["image.svg?v=2"]).toBe(MINIFIED);
  });
});

const MINIMIZERS = {
  cleanCssMinify,
  cssnanoMinify,
  cssoMinify,
  esbuildMinify,
  esbuildMinifyCss,
  htmlMinifierTerser,
  imageminMinify,
  jsonMinify,
  lightningCssMinify,
  minifyHtmlNode,
  napiRsImageMinify,
  sharpMinify,
  svgoMinify,
  swcMinify,
  swcMinifyCss,
  swcMinifyHtml,
  swcMinifyHtmlFragment,
  terserMinify,
  uglifyJsMinify,
};

describe("packageVersion", () => {
  it("should report what a package's own `package.json` says", () => {
    const installed = JSON.parse(
      fs.readFileSync(
        path.resolve(__dirname, "../node_modules/terser/package.json"),
        "utf8",
      ),
    );

    expect(packageVersion("terser")).toBe(installed.version);
  });

  it("should report nothing for a package that is not installed", () => {
    expect(packageVersion("no-such-package-anywhere")).toBeUndefined();
  });

  it("should report nothing when no `package.json` above the entry names it", () => {
    // A core module resolves to its own name, so the walk runs out at the root.
    expect(packageVersion("path")).toBeUndefined();
  });
});

describe("getMinimizerVersion", () => {
  it.each(Object.keys(MINIMIZERS))(
    "should report a version or nothing for %s, never throwing",
    (name) => {
      const version = MINIMIZERS[name].getMinimizerVersion();

      if (typeof version !== "undefined") {
        expect(version).toMatch(/^\d+\.\d+\.\d+/);
      }
    },
  );
});

describe("minify option written as an object", () => {
  /**
   * @returns {EXPECTED_ANY} a minimizer that records the options it was handed
   */
  function recorder() {
    /**
     * @param {{ [file: string]: string }} input input
     * @param {undefined} sourceMap source map
     * @param {{ tag?: string }} minimizerOptions the options it was handed
     * @returns {{ code: string }} the minified result
     */
    function minimize(input, sourceMap, minimizerOptions) {
      const [[, code]] = Object.entries(input);

      minimize.saw = minimizerOptions;

      return { code };
    }

    minimize.supportsWorker = () => false;
    minimize.saw = undefined;

    return minimize;
  }

  it("should take a minimizer's options from `minify` itself", async () => {
    const first = recorder();
    const compiler = getCompiler();

    new MinimizerPlugin({
      minify: { implementation: first, options: { tag: "from-minify" } },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toEqual([]);
    expect(first.saw.tag).toBe("from-minify");
  });

  it("should give each minimizer in an array its own options", async () => {
    const first = recorder();
    const second = recorder();
    const compiler = getCompiler();

    new MinimizerPlugin({
      minify: [
        { implementation: first, options: { tag: "first" } },
        { implementation: second, options: { tag: "second" } },
      ],
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toEqual([]);
    expect(first.saw.tag).toBe("first");
    expect(second.saw.tag).toBe("second");
  });

  it("should mix minimizers written both ways in one array", async () => {
    const plain = recorder();
    const described = recorder();
    const compiler = getCompiler();

    new MinimizerPlugin({
      minify: [plain, { implementation: described }],
      // Positional, and a descriptor that names no options of its own still
      // reads the entry at its index.
      minimizerOptions: [{ tag: "first" }, { tag: "second" }],
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toEqual([]);
    expect(plain.saw.tag).toBe("first");
    expect(described.saw.tag).toBe("second");
  });

  it("should still take them from the deprecated `minimizerOptions`", async () => {
    const first = recorder();
    const compiler = getCompiler();

    new MinimizerPlugin({
      minify: { implementation: first },
      minimizerOptions: { tag: "from-minimizer-options" },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toEqual([]);
    expect(first.saw.tag).toBe("from-minimizer-options");
  });

  it("should reject a minimizer written as an object holding several", () => {
    const first = recorder();
    const second = recorder();

    expect(() =>
      getCompiler({
        plugins: [
          new MinimizerPlugin({
            // Several minimizers are an array of objects, not one object
            // holding two lists that have to line up.
            minify: { implementation: [first, second] },
          }),
        ],
      }),
    ).toThrow(/should be an instance of function/);
  });

  it("should reject options given in both places for one minimizer", () => {
    const first = recorder();

    expect(() =>
      getCompiler({
        plugins: [
          new MinimizerPlugin({
            minify: { implementation: first, options: { tag: "a" } },
            minimizerOptions: { tag: "b" },
          }),
        ],
      }),
    ).toThrow(/`minify` sets its own `options`/);
  });
});
