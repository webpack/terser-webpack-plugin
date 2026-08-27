import MinimizerPlugin from "../src";

import { getCompiler } from "./helpers";

/**
 * @param {EXPECTED_ANY} options plugin options
 * @returns {import("webpack").Compiler} compiler
 */
const createCompiler = (options) =>
  getCompiler({ plugins: [new MinimizerPlugin(options)] });

describe("validation", () => {
  it("validate", () => {
    expect(() => {
      createCompiler({ test: /foo/ });
    }).not.toThrow();

    expect(() => {
      createCompiler({ test: "foo" });
    }).not.toThrow();

    expect(() => {
      createCompiler({ test: [/foo/] });
    }).not.toThrow();

    expect(() => {
      createCompiler({ test: [/foo/, /bar/] });
    }).not.toThrow();

    expect(() => {
      createCompiler({ test: ["foo", "bar"] });
    }).not.toThrow();

    expect(() => {
      createCompiler({ test: [/foo/, "bar"] });
    }).not.toThrow();

    expect(() => {
      createCompiler({ test: true });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      createCompiler({ test: [true] });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      createCompiler({ include: /foo/ });
    }).not.toThrow();

    expect(() => {
      createCompiler({ include: "foo" });
    }).not.toThrow();

    expect(() => {
      createCompiler({ include: [/foo/] });
    }).not.toThrow();

    expect(() => {
      createCompiler({ include: [/foo/, /bar/] });
    }).not.toThrow();

    expect(() => {
      createCompiler({ include: ["foo", "bar"] });
    }).not.toThrow();

    expect(() => {
      createCompiler({ include: [/foo/, "bar"] });
    }).not.toThrow();

    expect(() => {
      createCompiler({ include: true });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      createCompiler({ include: [true] });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      createCompiler({ exclude: /foo/ });
    }).not.toThrow();

    expect(() => {
      createCompiler({ exclude: "foo" });
    }).not.toThrow();

    expect(() => {
      createCompiler({ exclude: [/foo/] });
    }).not.toThrow();

    expect(() => {
      createCompiler({ exclude: [/foo/, /bar/] });
    }).not.toThrow();

    expect(() => {
      createCompiler({ exclude: ["foo", "bar"] });
    }).not.toThrow();

    expect(() => {
      createCompiler({ exclude: [/foo/, "bar"] });
    }).not.toThrow();

    expect(() => {
      createCompiler({ exclude: true });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      createCompiler({ exclude: [true] });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      createCompiler({ parallel: true });
    }).not.toThrow();

    expect(() => {
      createCompiler({ parallel: false });
    }).not.toThrow();

    expect(() => {
      createCompiler({ parallel: 2 });
    }).not.toThrow();

    expect(() => {
      createCompiler({ parallel: "2" });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      createCompiler({ parallel: {} });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      createCompiler({ minify() {} });
    }).not.toThrow();

    expect(() => {
      createCompiler({ minify: [() => ({ code: "" })] });
    }).not.toThrow();

    expect(() => {
      createCompiler({
        minify: [() => ({ code: "" }), () => ({ code: "" })],
      });
    }).not.toThrow();

    expect(() => {
      createCompiler({ minify: [] });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      createCompiler({ minify: true });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      createCompiler({ terserOptions: {} });
    }).not.toThrow();

    expect(() => {
      createCompiler({ terserOptions: [{}] });
    }).not.toThrow();

    expect(() => {
      createCompiler({ terserOptions: [{}, {}] });
    }).not.toThrow();

    expect(() => {
      createCompiler({ terserOptions: [] });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      createCompiler({ terserOptions: null });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      createCompiler({
        terserOptions: {
          ecma: undefined,
          parse: {},
          compress: {},
          mangle: true,
          module: false,
          output: null,
          toplevel: false,
          nameCache: null,
          ie8: false,
          keep_classnames: false,
          keep_fnames: false,
          safari10: false,
        },
      });
    }).not.toThrow();

    expect(() => {
      createCompiler({ terserOptions: { emca: 5 } });
    }).not.toThrow();

    expect(() => {
      createCompiler({ extractComments: true });
    }).not.toThrow();

    expect(() => {
      createCompiler({ extractComments: false });
    }).not.toThrow();

    expect(() => {
      createCompiler({ extractComments: "comment" });
    }).not.toThrow();

    expect(() => {
      createCompiler({ extractComments: /comment/ });
    }).not.toThrow();

    expect(() => {
      createCompiler({ extractComments() {} });
    }).not.toThrow();

    expect(() => {
      createCompiler({
        extractComments: {
          condition: true,
        },
      });
    }).not.toThrow();

    expect(() => {
      createCompiler({
        extractComments: {
          condition: "comment",
        },
      });
    }).not.toThrow();

    expect(() => {
      createCompiler({
        extractComments: {
          condition: /comment/,
        },
      });
    }).not.toThrow();

    expect(() => {
      createCompiler({
        extractComments: {
          condition() {},
        },
      });
    }).not.toThrow();

    expect(() => {
      createCompiler({
        extractComments: {
          condition: {},
        },
      });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      createCompiler({
        extractComments: {
          filename: "test.js",
        },
      });
    }).not.toThrow();

    expect(() => {
      createCompiler({
        extractComments: {
          filename() {},
        },
      });
    }).not.toThrow();

    expect(() => {
      createCompiler({
        extractComments: {
          filename: true,
        },
      });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      createCompiler({
        extractComments: {
          banner: true,
        },
      });
    }).not.toThrow();

    expect(() => {
      createCompiler({
        extractComments: {
          banner: "banner",
        },
      });
    }).not.toThrow();

    expect(() => {
      createCompiler({
        extractComments: {
          banner() {},
        },
      });
    }).not.toThrow();

    expect(() => {
      createCompiler({
        extractComments: {
          banner: /test/,
        },
      });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      createCompiler({ extractComments: { unknown: true } });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      createCompiler({ unknown: true });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      createCompiler({ minimizerOptions: {} });
    }).not.toThrow();

    expect(() => {
      createCompiler({ minimizerOptions: [{}] });
    }).not.toThrow();

    expect(() => {
      createCompiler({ minimizerOptions: [{}, {}] });
    }).not.toThrow();

    expect(() => {
      createCompiler({ minimizerOptions: [] });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      createCompiler({ minimizerOptions: null });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      createCompiler({
        minimizerOptions: { ecma: 5 },
        terserOptions: { ecma: 5 },
      });
    }).not.toThrow();
  });

  it("should validate a minimizer added through `optimization.minimizer`", () => {
    expect(() => {
      getCompiler({
        optimization: {
          minimize: true,
          minimizer: [new MinimizerPlugin({ unknown: true })],
        },
      });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      getCompiler({
        optimization: {
          minimize: true,
          minimizer: [new MinimizerPlugin({ parallel: 2 })],
        },
      });
    }).not.toThrow();
  });
});
