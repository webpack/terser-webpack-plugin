import path from "path";

import MinimizerPlugin from "../src";

import {
  compile,
  getCompiler,
  getErrors,
  getWarnings,
  readsAssets,
} from "./helpers";

// `@swc/html` requires Node >= 14, so this file is excluded from
// `testPathIgnorePatterns` in `jest.config.js` on older Node versions.

describe("swc html minify option", () => {
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
