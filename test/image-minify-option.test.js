import path from "path";

import MinimizerPlugin from "../src";
import { fileTypeFromBuffer } from "../src/fileType";

import { compile, getCompiler, getErrors, getWarnings } from "./helpers";

// Image bytes are not snapshotted: what an encoder writes varies with the
// installed `sharp`/`libvips`, so the assertions are on what has to hold —
// the format is unchanged and the file got smaller.

const IMAGE_RULES = [
  {
    test: /\.(png|jpe?g|svg)$/i,
    type: "asset/resource",
    generator: { filename: "[name][ext]" },
  },
];

/**
 * @param {import("webpack").Compiler} compiler compiler
 * @param {import("webpack").Stats} stats stats
 * @param {string} name asset name
 * @returns {Buffer} the emitted bytes
 */
function readBytes(compiler, stats, name) {
  return compiler.outputFileSystem.readFileSync(
    path.join(stats.compilation.outputOptions.path, name),
  );
}

/**
 * @param {string} name fixture name
 * @returns {number} its size on disk
 */
function fixtureSize(name) {
  return require("fs").statSync(path.resolve(__dirname, "fixtures", name)).size;
}

describe("image minify option", () => {
  it("should work when the `minify` option is `sharpMinify`", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/images.js"),
      module: { rules: IMAGE_RULES },
    });

    new MinimizerPlugin({
      test: /\.(png|jpe?g)$/i,
      minify: MinimizerPlugin.sharpMinify,
      minimizerOptions: {
        encodeOptions: { png: { compressionLevel: 9 }, jpeg: { quality: 60 } },
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);

    for (const [name, ext] of [
      ["image.png", "png"],
      ["image.jpg", "jpg"],
    ]) {
      const bytes = readBytes(compiler, stats, name);

      expect(fileTypeFromBuffer(bytes).ext).toBe(ext);
      expect(bytes.length).toBeLessThan(fixtureSize(name));
    }

    // Untouched: `sharpMinify` was not asked for it and `filter` would decline.
    expect(readBytes(compiler, stats, "image.svg")).toHaveLength(
      fixtureSize("image.svg"),
    );
  });

  it("should keep an animated image animated", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/images.js"),
      module: { rules: IMAGE_RULES },
    });

    new MinimizerPlugin({
      test: /\.png$/i,
      minify: MinimizerPlugin.sharpMinify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toEqual([]);
    expect(
      fileTypeFromBuffer(readBytes(compiler, stats, "image.png")).ext,
    ).toBe("png");
  });

  it("should work when the `minify` option is `svgoMinify`", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/images.js"),
      module: { rules: IMAGE_RULES },
    });

    new MinimizerPlugin({
      test: /\.svg$/i,
      minify: MinimizerPlugin.svgoMinify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);

    const svg = readBytes(compiler, stats, "image.svg").toString();

    expect(svg).not.toContain("a comment svgo removes");
    expect(svg.length).toBeLessThan(fixtureSize("image.svg"));
    expect(svg).toMatchSnapshot("svg");
  });

  it("should allow to set `svgo` options", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/images.js"),
      module: { rules: IMAGE_RULES },
    });

    new MinimizerPlugin({
      test: /\.svg$/i,
      minify: MinimizerPlugin.svgoMinify,
      minimizerOptions: {
        encodeOptions: {
          plugins: [{ name: "preset-default", params: { overrides: {} } }],
        },
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);
    expect(readBytes(compiler, stats, "image.svg").toString()).toMatchSnapshot(
      "svg",
    );
  });

  it("should work when the `minify` option is `imageminMinify`", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/images.js"),
      module: { rules: IMAGE_RULES },
    });

    new MinimizerPlugin({
      test: /\.svg$/i,
      minify: MinimizerPlugin.imageminMinify,
      minimizerOptions: { plugins: ["svgo"] },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);
    expect(readBytes(compiler, stats, "image.svg").toString()).not.toContain(
      "a comment svgo removes",
    );
  });

  it("should accept an `imagemin` plugin as a `[name, options]` pair", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/images.js"),
      module: { rules: IMAGE_RULES },
    });

    new MinimizerPlugin({
      test: /\.svg$/i,
      minify: MinimizerPlugin.imageminMinify,
      minimizerOptions: {
        plugins: [["svgo", { plugins: [{ name: "preset-default" }] }]],
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);
    expect(readBytes(compiler, stats, "image.svg").toString()).not.toContain(
      "a comment svgo removes",
    );
  });

  it("should keep the original when an `imagemin` plugin changes the format", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/images.js"),
      module: { rules: IMAGE_RULES },
    });

    /** @type {Buffer | undefined} */
    let handed;
    // Stands in for a converting plugin: the PNG's bytes are offered under a
    // name claiming another format, which is the mismatch `imageminMinify`
    // refuses. Kept out of the worker pool so it can reach this closure.
    const asMismatchedName = async (input) => {
      const [[, code]] = Object.entries(input);

      handed = code;

      return MinimizerPlugin.imageminMinify({ "image.jpg": code }, undefined, {
        plugins: ["svgo"],
      });
    };

    asMismatchedName.supportsBinary = () => true;
    asMismatchedName.supportsWorker = () => false;

    new MinimizerPlugin({
      test: /\.png$/i,
      minify: asMismatchedName,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toEqual([]);
    // The bytes reached it as bytes, not as text.
    expect(Buffer.isBuffer(handed)).toBe(true);
    expect(getWarnings(stats).join("\n")).toContain(
      'does not support generating "png" from "image.jpg"',
    );
    expect(readBytes(compiler, stats, "image.png")).toHaveLength(
      fixtureSize("image.png"),
    );
  });

  it("should throw when `imageminMinify` has no plugins", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/images.js"),
      module: { rules: IMAGE_RULES },
      bail: false,
    });

    new MinimizerPlugin({
      test: /\.svg$/i,
      minify: MinimizerPlugin.imageminMinify,
      minimizerOptions: {},
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats).join("\n")).toContain("No plugins found");
  });

  it("should throw on an unknown `imagemin` plugin", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/images.js"),
      module: { rules: IMAGE_RULES },
      bail: false,
    });

    new MinimizerPlugin({
      test: /\.svg$/i,
      minify: MinimizerPlugin.imageminMinify,
      minimizerOptions: { plugins: ["no-such-plugin"] },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats).join("\n")).toContain(
      "Unknown plugin: imagemin-no-such-plugin",
    );
  });

  it("should dispatch each image to the minimizer whose `filter` takes it", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/images.js"),
      module: { rules: IMAGE_RULES },
    });

    new MinimizerPlugin({
      test: /\.(png|jpe?g|svg)$/i,
      minify: [MinimizerPlugin.sharpMinify, MinimizerPlugin.svgoMinify],
      minimizerOptions: [
        { encodeOptions: { png: { compressionLevel: 9 } } },
        {},
      ],
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);

    expect(
      fileTypeFromBuffer(readBytes(compiler, stats, "image.png")).ext,
    ).toBe("png");
    expect(readBytes(compiler, stats, "image.png").length).toBeLessThan(
      fixtureSize("image.png"),
    );
    expect(readBytes(compiler, stats, "image.svg").toString()).not.toContain(
      "a comment svgo removes",
    );
  });

  it("should keep the worker pool for the minimizers that can use it", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/images.js"),
      module: { rules: IMAGE_RULES },
    });

    // `sharpMinify` cannot run in a worker; terser beside it still must.
    new MinimizerPlugin({
      test: /\.(js|png)$/i,
      minify: [MinimizerPlugin.terserMinify, MinimizerPlugin.sharpMinify],
      minimizerOptions: [{}, {}],
      parallel: 2,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);
    expect(
      fileTypeFromBuffer(readBytes(compiler, stats, "image.png")).ext,
    ).toBe("png");
    // Mangled and without the module wrapper: terser ran on it.
    expect(readBytes(compiler, stats, "main.js").toString()).toContain(
      "console.log(e,r,o)",
    );
  });
});
