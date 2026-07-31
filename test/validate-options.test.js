import MinimizerPlugin from "../src";

describe("validation", () => {
  it("validate", () => {
    /* eslint-disable no-new */
    expect(() => {
      new MinimizerPlugin({ test: /foo/ });
    }).not.toThrow();

    expect(() => {
      new MinimizerPlugin({ test: "foo" });
    }).not.toThrow();

    expect(() => {
      new MinimizerPlugin({ test: [/foo/] });
    }).not.toThrow();

    expect(() => {
      new MinimizerPlugin({ test: [/foo/, /bar/] });
    }).not.toThrow();

    expect(() => {
      new MinimizerPlugin({ test: ["foo", "bar"] });
    }).not.toThrow();

    expect(() => {
      new MinimizerPlugin({ test: [/foo/, "bar"] });
    }).not.toThrow();

    expect(() => {
      new MinimizerPlugin({ test: true });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      new MinimizerPlugin({ test: [true] });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      new MinimizerPlugin({ include: /foo/ });
    }).not.toThrow();

    expect(() => {
      new MinimizerPlugin({ include: "foo" });
    }).not.toThrow();

    expect(() => {
      new MinimizerPlugin({ include: [/foo/] });
    }).not.toThrow();

    expect(() => {
      new MinimizerPlugin({ include: [/foo/, /bar/] });
    }).not.toThrow();

    expect(() => {
      new MinimizerPlugin({ include: ["foo", "bar"] });
    }).not.toThrow();

    expect(() => {
      new MinimizerPlugin({ include: [/foo/, "bar"] });
    }).not.toThrow();

    expect(() => {
      new MinimizerPlugin({ include: true });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      new MinimizerPlugin({ include: [true] });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      new MinimizerPlugin({ exclude: /foo/ });
    }).not.toThrow();

    expect(() => {
      new MinimizerPlugin({ exclude: "foo" });
    }).not.toThrow();

    expect(() => {
      new MinimizerPlugin({ exclude: [/foo/] });
    }).not.toThrow();

    expect(() => {
      new MinimizerPlugin({ exclude: [/foo/, /bar/] });
    }).not.toThrow();

    expect(() => {
      new MinimizerPlugin({ exclude: ["foo", "bar"] });
    }).not.toThrow();

    expect(() => {
      new MinimizerPlugin({ exclude: [/foo/, "bar"] });
    }).not.toThrow();

    expect(() => {
      new MinimizerPlugin({ exclude: true });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      new MinimizerPlugin({ exclude: [true] });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      new MinimizerPlugin({ parallel: true });
    }).not.toThrow();

    expect(() => {
      new MinimizerPlugin({ parallel: false });
    }).not.toThrow();

    expect(() => {
      new MinimizerPlugin({ parallel: 2 });
    }).not.toThrow();

    expect(() => {
      new MinimizerPlugin({ parallel: "2" });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      new MinimizerPlugin({ parallel: {} });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      new MinimizerPlugin({ minify() {} });
    }).not.toThrow();

    expect(() => {
      new MinimizerPlugin({ minify: [() => ({ code: "" })] });
    }).not.toThrow();

    expect(() => {
      new MinimizerPlugin({
        minify: [() => ({ code: "" }), () => ({ code: "" })],
      });
    }).not.toThrow();

    expect(() => {
      new MinimizerPlugin({ minify: [] });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      new MinimizerPlugin({ minify: true });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      new MinimizerPlugin({ terserOptions: {} });
    }).not.toThrow();

    expect(() => {
      new MinimizerPlugin({ terserOptions: [{}] });
    }).not.toThrow();

    expect(() => {
      new MinimizerPlugin({ terserOptions: [{}, {}] });
    }).not.toThrow();

    expect(() => {
      new MinimizerPlugin({ terserOptions: [] });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      new MinimizerPlugin({ terserOptions: null });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      new MinimizerPlugin({
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
      new MinimizerPlugin({ terserOptions: { emca: 5 } });
    }).not.toThrow();

    expect(() => {
      new MinimizerPlugin({ extractComments: true });
    }).not.toThrow();

    expect(() => {
      new MinimizerPlugin({ extractComments: false });
    }).not.toThrow();

    expect(() => {
      new MinimizerPlugin({ extractComments: "comment" });
    }).not.toThrow();

    expect(() => {
      new MinimizerPlugin({ extractComments: /comment/ });
    }).not.toThrow();

    expect(() => {
      new MinimizerPlugin({ extractComments() {} });
    }).not.toThrow();

    expect(() => {
      new MinimizerPlugin({
        extractComments: {
          condition: true,
        },
      });
    }).not.toThrow();

    expect(() => {
      new MinimizerPlugin({
        extractComments: {
          condition: "comment",
        },
      });
    }).not.toThrow();

    expect(() => {
      new MinimizerPlugin({
        extractComments: {
          condition: /comment/,
        },
      });
    }).not.toThrow();

    expect(() => {
      new MinimizerPlugin({
        extractComments: {
          condition() {},
        },
      });
    }).not.toThrow();

    expect(() => {
      new MinimizerPlugin({
        extractComments: {
          condition: {},
        },
      });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      new MinimizerPlugin({
        extractComments: {
          filename: "test.js",
        },
      });
    }).not.toThrow();

    expect(() => {
      new MinimizerPlugin({
        extractComments: {
          filename() {},
        },
      });
    }).not.toThrow();

    expect(() => {
      new MinimizerPlugin({
        extractComments: {
          filename: true,
        },
      });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      new MinimizerPlugin({
        extractComments: {
          banner: true,
        },
      });
    }).not.toThrow();

    expect(() => {
      new MinimizerPlugin({
        extractComments: {
          banner: "banner",
        },
      });
    }).not.toThrow();

    expect(() => {
      new MinimizerPlugin({
        extractComments: {
          banner() {},
        },
      });
    }).not.toThrow();

    expect(() => {
      new MinimizerPlugin({
        extractComments: {
          banner: /test/,
        },
      });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      new MinimizerPlugin({ extractComments: { unknown: true } });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      new MinimizerPlugin({ stage: 100 });
    }).not.toThrow();

    expect(() => {
      new MinimizerPlugin({ stage: "100" });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      new MinimizerPlugin({ unknown: true });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      new MinimizerPlugin({ minimizerOptions: {} });
    }).not.toThrow();

    expect(() => {
      new MinimizerPlugin({ minimizerOptions: [{}] });
    }).not.toThrow();

    expect(() => {
      new MinimizerPlugin({ minimizerOptions: [{}, {}] });
    }).not.toThrow();

    expect(() => {
      new MinimizerPlugin({ minimizerOptions: [] });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      new MinimizerPlugin({ minimizerOptions: null });
    }).toThrowErrorMatchingSnapshot();

    expect(() => {
      new MinimizerPlugin({
        minimizerOptions: { ecma: 5 },
        terserOptions: { ecma: 5 },
      });
    }).not.toThrow();
  });
});
/* eslint-enable no-new */
