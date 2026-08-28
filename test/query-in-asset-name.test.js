import path from "path";

import MinimizerPlugin from "../src";

import { compile, getCompiler, getErrors, getWarnings } from "./helpers";

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
