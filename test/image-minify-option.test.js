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

  it("should work when the `minify` option is `napiRsImageMinify`", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/images.js"),
      module: { rules: IMAGE_RULES },
    });

    new MinimizerPlugin({
      test: /\.(png|jpe?g)$/i,
      minify: MinimizerPlugin.napiRsImageMinify,
      minimizerOptions: { encodeOptions: { jpeg: { quality: 75 } } },
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

    // Untouched: `filter` declines the formats it cannot read back.
    expect(readBytes(compiler, stats, "image.svg")).toHaveLength(
      fixtureSize("image.svg"),
    );
  });

  it("should recompress PNG losslessly with `napiRsImageMinify`", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/images.js"),
      module: { rules: IMAGE_RULES },
    });

    new MinimizerPlugin({
      test: /\.png$/i,
      minify: MinimizerPlugin.napiRsImageMinify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toEqual([]);

    const sharp = require("sharp");

    const before = await sharp(path.resolve(__dirname, "fixtures/image.png"))
      .raw()
      .toBuffer();
    const after = await sharp(readBytes(compiler, stats, "image.png"))
      .raw()
      .toBuffer();

    // oxipng rewrites the container, never the pixels.
    expect(after.equals(before)).toBe(true);
  });

  it.each([["avif"], ["jpeg"], ["png"], ["webp"]])(
    "should re-encode %s with its own `napiRsImageMinify` codec",
    async (format) => {
      // Every entry of the encoder table needs an input: a binding wired to the
      // wrong codec declines silently rather than failing.
      const sharp = require("sharp");

      const input = await sharp({
        create: {
          width: 64,
          height: 64,
          channels: 3,
          background: { r: 200, g: 20, b: 60 },
        },
      })
        .toFormat(format)
        .toBuffer();

      const { code } = await MinimizerPlugin.napiRsImageMinify({
        [`image.${format}`]: input,
      });

      expect(Buffer.isBuffer(code)).toBe(true);
      expect(fileTypeFromBuffer(code).ext).toBe(
        format === "jpeg" ? "jpg" : format,
      );
    },
  );

  it("should decline a format `napiRsImageMinify` cannot re-encode", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/images.js"),
      module: { rules: IMAGE_RULES },
    });

    // `tiff` reaches the minimizer only past `filter`, so ask it directly.
    const result = await MinimizerPlugin.napiRsImageMinify({
      "image.tiff": Buffer.from("not really a tiff"),
    });

    expect(result.code.toString()).toBe("not really a tiff");
    expect(MinimizerPlugin.napiRsImageMinify.filter("image.tiff")).toBe(false);

    compiler.close(() => {});
  });

  it.each([
    ["?width=64", {}, [64, 32]],
    ["?w=64", {}, [64, 32]],
    ["?height=25", {}, [50, 25]],
    // Both given: sharp's default `fit` honours each exactly.
    ["?width=64&height=25", {}, [64, 25]],
    ["?width=50&unit=percent", {}, [100, 50]],
    ["?w=50&u=percent", {}, [100, 50]],
    // Neither a size nor a number, so neither is read as one.
    ["?v=2", {}, [200, 100]],
    ["?width=nonsense", {}, [200, 100]],
    ["?width=-5", {}, [200, 100]],
    // The query is the more specific of the two, so it wins.
    ["?width=64", { resize: { width: 10 } }, [64, 32]],
    // `auto` drops a configured dimension and leaves the other.
    ["?width=auto", { resize: { width: 10, height: 30 } }, [60, 30]],
    // Turning resizing off is the configuration's to decide, not the query's.
    ["?width=64", { resize: { enabled: false } }, [200, 100]],
  ])(
    "should read the size %s off the asset name",
    async (query, options, [width, height]) => {
      const sharp = require("sharp");

      const input = await sharp({
        create: {
          width: 200,
          height: 100,
          channels: 3,
          background: { r: 9, g: 9, b: 9 },
        },
      })
        .png()
        .toBuffer();

      const { code } = await MinimizerPlugin.sharpMinify(
        { [`wide.png${query}`]: input },
        undefined,
        options,
      );

      await expect(sharp(code).metadata()).resolves.toMatchObject({
        width,
        height,
      });
    },
  );

  it("should resize through a real build, and keep each size its own file", async () => {
    const sharp = require("sharp");

    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/sized-images.js"),
      output: {
        pathinfo: false,
        path: path.resolve(__dirname, "dist"),
        filename: "[name].js",
        // The file name has to distinguish the sizes, and the asset name has to
        // keep the query for it to be read at all.
        assetModuleFilename: (pathData) => {
          const query =
            (pathData.module &&
              pathData.module.resourceResolveData &&
              pathData.module.resourceResolveData.query) ||
            "";

          return `[name]${query.replace(/^\?/, "-").replace(/[=&]/g, "-")}[ext][query]`;
        },
      },
      module: {
        rules: [
          { test: /\.png$/i, type: "asset/resource" },
          { test: /\.svg$/i, type: "asset/resource" },
        ],
      },
    });

    new MinimizerPlugin({
      test: /\.png$/i,
      minify: MinimizerPlugin.sharpMinify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);

    const sizes = {};

    for (const asset of stats
      .toJson({ all: false, assets: true })
      .assets.filter((item) => !item.name.endsWith(".js"))) {
      const onDisk = asset.name.replace(/[?#].*$/, "");
      const { width, height } = await sharp(
        readBytes(compiler, stats, onDisk),
      ).metadata();

      sizes[asset.name] = `${width}x${height}`;
    }

    expect(sizes).toEqual({
      "image-width-64.png?width=64": "64x64",
      "image-height-20.png?height=20": "20x20",
      "image.png": "120x120",
    });
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

describe("the image minimizers' versions", () => {
  // `sharp`, `svgo` and `imagemin` do not list `./package.json` in their
  // `exports`, so requiring it throws and the version used to read as
  // undefined: every build then hashed the same "0.0.0" whichever version was
  // installed, and upgrading one did not invalidate what it had minified.
  it.each([
    ["sharpMinify", MinimizerPlugin.sharpMinify],
    ["svgoMinify", MinimizerPlugin.svgoMinify],
    ["imageminMinify", MinimizerPlugin.imageminMinify],
    ["napiRsImageMinify", MinimizerPlugin.napiRsImageMinify],
  ])("should be what %s reports", (_name, minimizer) => {
    expect(minimizer.getMinimizerVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });
});
