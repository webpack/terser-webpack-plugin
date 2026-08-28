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
    // `fit` decides what happens when both dimensions are given.
    ["?w=64&h=64&fit=cover", {}, [64, 64]],
    ["?w=64&h=64&fit=contain&bg=%23ff0000", {}, [64, 64]],
    // `inside` keeps the aspect ratio within the box rather than filling it.
    ["?w=64&h=64&fit=inside", {}, [64, 32]],
    ["?w=64&h=64&fit=outside", {}, [128, 64]],
    ["?w=64&h=64&fit=cover&position=right+top", {}, [64, 64]],
    ["?w=64&h=64&fit=cover&pos=entropy", {}, [64, 64]],
    // Enlarging is what sharp does by default, and what this turns off.
    ["?w=400", {}, [400, 200]],
    ["?w=400&without-enlargement", {}, [200, 100]],
    // Spelled as sharp spells it, or with the hyphen a URL invites.
    ["?w=400&withoutEnlargement=1", {}, [200, 100]],
    ["?w=400&without-enlargement=false", {}, [400, 200]],
    // A fragment can follow the query, and is not part of it.
    ["?width=64#deep", {}, [64, 32]],
    // A resize the query alone asks for, with nothing configured.
    ["?w=64&fit=inside", { resize: undefined }, [64, 32]],
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

  it("should not offer `sharpMinify` a raw asset it could only fail on", async () => {
    // Bare pixels carry no header, so sharp cannot read one back — offering
    // it one fails the build rather than minifying anything.
    expect(MinimizerPlugin.sharpMinify.filter("pixels.raw")).toBe(false);

    const pixels = Buffer.alloc(32 * 32 * 3, 7);

    await expect(require("sharp")(pixels).metadata()).rejects.toThrow(
      /unsupported image format/,
    );
  });

  it("should keep an image a plugin turned into SVG", async () => {
    // The other direction of the same guard. SVG carries no signature, so
    // until it was read as the markup it is, a conversion *into* it named
    // nothing, the mismatch went unseen, and SVG was written out under a name
    // claiming a raster format.
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><rect x="1.00000"/></svg>',
    );
    const { code, warnings } = await MinimizerPlugin.imageminMinify(
      { "photo.png": svg },
      undefined,
      { plugins: ["svgo"] },
    );

    expect(code).toEqual(svg);
    expect(warnings.join("\n")).toContain(
      'does not support generating "svg" from "photo.png"',
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

describe("what an asset's name asks sharp for", () => {
  /**
   * A gradient with noise. A flat colour is invariant under flip, blur and
   * grayscale alike, so it would satisfy every assertion below without them.
   * @param {import("sharp")} sharp sharp
   * @param {string=} format the format to encode as
   * @returns {Promise<Buffer>} the encoded image
   */
  function patterned(sharp, format = "png") {
    const width = 120;
    const height = 60;
    const raw = Buffer.alloc(width * height * 3);
    let seed = 12345;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;

        const i = (y * width + x) * 3;

        raw[i] = (x * 2 + (seed % 40)) % 256;
        raw[i + 1] = (y * 3 + ((seed >> 8) % 40)) % 256;
        raw[i + 2] = (x + y + ((seed >> 16) % 40)) % 256;
      }
    }

    return sharp(raw, { raw: { width, height, channels: 3 } })
      .toFormat(
        format,
        format === "png" ? { compressionLevel: 0 } : { quality: 100 },
      )
      .toBuffer();
  }

  /**
   * @param {string} query the query to put on the asset's name
   * @param {object=} options minimizer options
   * @param {string=} format the format to encode as
   * @returns {Promise<Buffer>} what the minimizer returned
   */
  async function minified(query, options, format = "png") {
    const sharp = require("sharp");

    const { code } = await MinimizerPlugin.sharpMinify(
      {
        [`image.${format}${query}`]: await patterned(sharp, undefined, format),
      },
      undefined,
      options,
    );

    return code;
  }

  /**
   * @param {Buffer} image an encoded image
   * @returns {Promise<Buffer>} its pixels
   */
  const pixels = (image) => require("sharp")(image).raw().toBuffer();

  it("should mirror vertically for `flip`", async () => {
    const sharp = require("sharp");

    const mirrored = await sharp(await patterned(sharp))
      .flip()
      .png()
      .toBuffer();

    expect(await pixels(await minified("?flip"))).toEqual(
      await pixels(mirrored),
    );
  });

  it("should mirror horizontally for `flop`", async () => {
    const sharp = require("sharp");

    const mirrored = await sharp(await patterned(sharp))
      .flop()
      .png()
      .toBuffer();

    expect(await pixels(await minified("?flop=true"))).toEqual(
      await pixels(mirrored),
    );
  });

  it.each(["grayscale", "greyscale", "gray", "grey"])(
    "should drop the colour for `%s`",
    async (spelling) => {
      const raw = await pixels(await minified(`?${spelling}`));
      const grey = [];

      for (let i = 0; i < raw.length; i += 3) {
        grey.push(raw[i] === raw[i + 1] && raw[i + 1] === raw[i + 2]);
      }

      expect(grey.every(Boolean)).toBe(true);
      // The fixture is not grey to begin with, so that meant something.
      expect(await pixels(await minified(""))).not.toEqual(raw);
    },
  );

  it("should turn by an angle for `rotate`, and read EXIF for `auto`", async () => {
    await expect(
      require("sharp")(await minified("?rotate=90")).metadata(),
    ).resolves.toMatchObject({ width: 60, height: 120 });
    // Nothing in the fixture says otherwise, so this leaves it alone.
    await expect(
      require("sharp")(await minified("?rot=auto")).metadata(),
    ).resolves.toMatchObject({ width: 120, height: 60 });
  });

  it.each([
    ["blur", "?blur=3"],
    ["blur", "?blur"],
    ["sharpen", "?sharpen"],
  ])("should change the pixels for `%s` given %s", async (_name, query) => {
    const changed = await pixels(await minified(query));

    expect(changed).not.toEqual(await pixels(await minified("")));
    // Only the pixels, not the size.
    expect(changed).toHaveLength(120 * 60 * 3);
  });

  it.each(["?flip", "?flip=", "?flip=true", "?flip=1", "?flip=yes"])(
    "should read %s as asking for it",
    async (query) => {
      const sharp = require("sharp");

      const mirrored = await sharp(await patterned(sharp))
        .flip()
        .png()
        .toBuffer();

      expect(await pixels(await minified(query))).toEqual(
        await pixels(mirrored),
      );
    },
  );

  it.each(["?flip=false", "?flip=0", "?flip=no"])(
    "should read %s as asking against it",
    async (query) => {
      expect(await pixels(await minified(query))).toEqual(
        await pixels(await minified("")),
      );
    },
  );

  it("should let the query turn off what the configuration turned on", async () => {
    expect(await pixels(await minified("?flip=false", { flip: true }))).toEqual(
      await pixels(await minified("")),
    );
  });

  it("should apply a transform set in `minimizerOptions` alone", async () => {
    expect(await pixels(await minified("", { grayscale: true }))).toEqual(
      await pixels(await minified("?grayscale")),
    );
  });

  it("should read `quality` off the name, overriding `encodeOptions`", async () => {
    const cheap = await minified("?quality=20", undefined, "jpeg");
    const dear = await minified("?q=95", undefined, "jpeg");

    expect(cheap.length).toBeLessThan(dear.length);
    // The name is the more specific of the two, so it wins.
    const configured = { encodeOptions: { jpeg: { quality: 95 } } };

    expect(await minified("?q=20", configured, "jpeg")).toHaveLength(
      cheap.length,
    );
    expect(await minified("", configured, "jpeg")).toHaveLength(dear.length);
  });

  it.each([
    ["?lossless", "webp"],
    ["?effort=6", "webp"],
    ["?progressive", "jpeg"],
  ])("should read %s off the name for a %s", async (query, format) => {
    expect(await minified(query, undefined, format)).not.toHaveLength(
      (await minified("", undefined, format)).length,
    );
  });

  it("should ignore an encode option the format has no use for", async () => {
    // sharp reads the keys it knows and leaves the rest, so `lossless` on a
    // jpeg is neither an error nor a change.
    expect(await minified("?lossless", undefined, "jpeg")).toHaveLength(
      (await minified("", undefined, "jpeg")).length,
    );
  });

  it.each([
    // A value of the wrong shape is not a value, whatever it names.
    ["?flip=maybe", "flip"],
    ["?grayscale=perhaps", "grayscale"],
    ["?rotate=sideways", "rotate"],
    ["?blur=lots", "blur"],
    ["?sharpen=vigorously", "sharpen"],
    ["?quality=high", "quality"],
    ["?effort=-1", "effort"],
    ["?lossless=sort-of", "lossless"],
    ["?fit=", "fit"],
    ["?position=", "position"],
    ["?background=", "background"],
    ["?unit=furlongs&width=50", "unit"],
  ])("should ignore %s, which is not a %s", async (query) => {
    const asked = await minified(query);
    const plain = await minified(
      query === "?unit=furlongs&width=50" ? "?width=50" : "",
    );

    expect(await pixels(asked)).toEqual(await pixels(plain));
  });

  it.each([
    ["an unknown fit", "?w=64&fit=nonsense", /valid fit/],
    [
      "a colour it cannot parse",
      "?w=64&h=64&fit=contain&bg=nope",
      /parse color/,
    ],
    ["a quality out of range", "?quality=101", /between 0 and 100/],
    ["an effort past the format's range", "?effort=7", /between 0 and 6/],
  ])("should let sharp report %s", async (_name, query, message) => {
    const format = query.includes("effort") ? "webp" : "png";

    await expect(minified(query, undefined, format)).rejects.toThrow(message);
  });
});

describe("what an asset's name asks @napi-rs/image for", () => {
  const WIDTH = 120;
  const HEIGHT = 60;

  /**
   * A gradient with noise, so flip, blur and grayscale are all detectable.
   * @param {import("sharp")} sharp sharp
   * @param {object=} metadata extra metadata to stamp on it
   * @param {string=} format the format to encode as
   * @returns {Promise<Buffer>} the encoded image
   */
  function patterned(sharp, metadata, format = "png") {
    const raw = Buffer.alloc(WIDTH * HEIGHT * 3);
    let seed = 12345;

    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;

        const i = (y * WIDTH + x) * 3;

        raw[i] = (x * 2 + (seed % 40)) % 256;
        raw[i + 1] = (y * 3 + ((seed >> 8) % 40)) % 256;
        raw[i + 2] = (x + y + ((seed >> 16) % 40)) % 256;
      }
    }

    const pipeline = sharp(raw, {
      raw: { width: WIDTH, height: HEIGHT, channels: 3 },
    });

    return (metadata ? pipeline.withMetadata(metadata) : pipeline)
      .toFormat(
        format,
        format === "png" ? { compressionLevel: 0 } : { quality: 100 },
      )
      .toBuffer();
  }

  /**
   * @param {string} query the query to put on the asset's name
   * @param {object=} options minimizer options
   * @param {string=} format the format to encode as
   * @returns {Promise<import("../src").MinimizedResult>} what the minimizer returned
   */
  async function minified(query, options, format = "png") {
    const sharp = require("sharp");

    return MinimizerPlugin.napiRsImageMinify(
      {
        [`image.${format}${query}`]: await patterned(sharp, undefined, format),
      },
      undefined,
      options,
    );
  }

  /**
   * @param {Buffer} image an encoded image
   * @returns {Promise<Buffer>} its pixels
   */
  const pixels = (image) => require("sharp")(image).raw().toBuffer();

  it.each([
    ["?width=60", [60, 30]],
    ["?w=60", [60, 30]],
    ["?height=20", [40, 20]],
    ["?w=60&h=20", [60, 20]],
    ["?w=60&h=20&fit=cover", [60, 20]],
    ["?w=60&h=20&fit=fill", [60, 20]],
    // `inside` keeps the aspect ratio within the box rather than filling it.
    ["?w=60&h=20&fit=inside", [40, 20]],
    ["?w=60&filter=lanczos3", [60, 30]],
    ["?w=60&filter=nearest", [60, 30]],
    // Neither a size nor a number, so neither is read as one.
    ["?v=2", [WIDTH, HEIGHT]],
    ["?width=nonsense", [WIDTH, HEIGHT]],
    ["?width=-5", [WIDTH, HEIGHT]],
    // An unknown fit has no number to map to, so it is dropped and the width
    // it was asked alongside still applies.
    ["?w=60&fit=nonsense", [60, 30]],
    ["?width=60#deep", [60, 30]],
  ])(
    "should read the size %s off the asset name",
    async (query, [width, height]) => {
      const { code } = await minified(query);

      await expect(require("sharp")(code).metadata()).resolves.toMatchObject({
        width,
        height,
      });
    },
  );

  it("should let the query override a configured resize", async () => {
    const { code } = await minified("?width=60", {
      resize: { width: 10 },
    });

    await expect(require("sharp")(code).metadata()).resolves.toMatchObject({
      width: 60,
    });
  });

  it.each([
    ["?rotate=90", [60, 120]],
    ["?rot=270", [60, 120]],
    ["?rotate=180", [WIDTH, HEIGHT]],
    // Negative turns and whole circles land on the quarter they name.
    ["?rotate=-90", [60, 120]],
    ["?rotate=450", [60, 120]],
    ["?rotate=360", [WIDTH, HEIGHT]],
    // Not a quarter turn, so not a turn.
    ["?rotate=45", [WIDTH, HEIGHT]],
    ["?rotate=90&flip", [60, 120]],
  ])("should turn for %s", async (query, [width, height]) => {
    const { code } = await minified(query);

    await expect(require("sharp")(code).metadata()).resolves.toMatchObject({
      width,
      height,
    });
  });

  it.each([
    ["flip", "?flip"],
    ["flop", "?flop"],
  ])(
    "should mirror for `%s` exactly as sharp does",
    async (operation, query) => {
      const sharp = require("sharp");

      const source = await patterned(sharp);
      const mirrored = await sharp(source)[operation]().png().toBuffer();
      const { code } = await MinimizerPlugin.napiRsImageMinify({
        [`image.png${query}`]: source,
      });

      expect(await pixels(code)).toEqual(await pixels(mirrored));
    },
  );

  it("should read a mirror and a turn as the one orientation they compose to", async () => {
    // Mirroring both ways is a half turn, which is the whole reason the two
    // fit in the single value `rotate` takes.
    expect(await pixels((await minified("?flip&flop")).code)).toEqual(
      await pixels((await minified("?rotate=180")).code),
    );
  });

  it("should say so when EXIF and an explicit turn are both asked for", async () => {
    const { warnings } = await minified("?rotate=auto&flip");

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/applies one orientation/);
  });

  it("should turn by the EXIF orientation for `rotate=auto`", async () => {
    const sharp = require("sharp");

    const turned = await patterned(sharp, { orientation: 6 }, "jpeg");
    const { code, warnings } = await MinimizerPlugin.napiRsImageMinify({
      "image.jpeg?rotate=auto": turned,
    });

    expect(warnings).toBeUndefined();
    await expect(sharp(code).metadata()).resolves.toMatchObject({
      width: HEIGHT,
      height: WIDTH,
    });
  });

  it("should not decode an image whose EXIF asks for nothing", async () => {
    // Reading the header costs a twentieth of decoding and encoding again, so
    // an image with no orientation to apply keeps the bytes the fast path
    // would have produced.
    const sharp = require("sharp");

    const source = await patterned(sharp, undefined, "jpeg");
    const asked = await MinimizerPlugin.napiRsImageMinify({
      "image.jpeg?rotate=auto": source,
    });
    const plain = await MinimizerPlugin.napiRsImageMinify({
      "image.jpeg": source,
    });

    expect(asked.code).toEqual(plain.code);
  });

  it.each(["grayscale", "greyscale", "gray", "grey"])(
    "should drop the colour for `%s`",
    async (spelling) => {
      const raw = await pixels((await minified(`?${spelling}`)).code);
      let grey = true;

      for (let i = 0; i + 2 < raw.length; i += 3) {
        if (raw[i] !== raw[i + 1] || raw[i + 1] !== raw[i + 2]) {
          grey = false;
          break;
        }
      }

      expect(grey).toBe(true);
    },
  );

  it.each(["?invert", "?blur=3"])(
    "should change the pixels for %s",
    async (query) => {
      const changed = await pixels((await minified(query)).code);

      expect(changed).not.toEqual(await pixels((await minified("")).code));
      expect(changed).toHaveLength(WIDTH * HEIGHT * 3);
    },
  );

  it("should keep the repack that makes this minimizer worth using", async () => {
    // Transforming means decoding, and decoding loses oxipng's rewrite unless
    // its output is handed back to it — which is the whole margin here, 99%
    // against 9% on this repository's own fixture.
    const sharp = require("sharp");

    const source = await patterned(sharp);

    const image = require("@napi-rs/image");

    const withoutRepack = await new image.Transformer(source)
      .resize({ width: 60 })
      .png();
    const { code } = await MinimizerPlugin.napiRsImageMinify({
      "image.png?width=60": source,
    });

    expect(code.length).toBeLessThan(withoutRepack.length);
  });

  it.each([
    ["jpeg", "?quality=20", "?quality=95"],
    ["webp", "?q=20", "?q=95"],
    ["avif", "?q=20", "?q=95"],
  ])(
    "should read `quality` off the name for a %s",
    async (format, cheap, dear) => {
      const { code: small } = await minified(cheap, undefined, format);
      const { code: large } = await minified(dear, undefined, format);

      expect(small.length).toBeLessThan(large.length);
    },
  );

  it.each([
    ["webp", "?lossless"],
    ["avif", "?lossless"],
    ["avif", "?speed=8"],
  ])("should read %s's %s off the name", async (format, query) => {
    const { code: asked } = await minified(query, undefined, format);
    const { code: plain } = await minified("", undefined, format);

    expect(asked).not.toHaveLength(plain.length);
  });

  it("should ignore a quality this minimizer would otherwise mangle", async () => {
    // napi does not reject a quality of its own: 150 silently writes a file
    // bigger than the default, which is why the range is checked here.
    const { code: junk } = await minified("?quality=150", undefined, "jpeg");
    const { code: plain } = await minified("", undefined, "jpeg");

    expect(junk).toEqual(plain);
  });
});

describe("what an asset's name asks svgo for", () => {
  const SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><path d="M1.23456 2.34567L50.98765 60.12345Z" fill="#ff0000"/></svg>';

  /**
   * @param {string} query the query to put on the asset's name
   * @param {object=} options minimizer options
   * @returns {Promise<string>} the minified svg
   */
  async function minified(query, options) {
    const { code } = await MinimizerPlugin.svgoMinify(
      { [`icon.svg${query}`]: SVG },
      undefined,
      options,
    );

    return /** @type {string} */ (code);
  }

  it.each([
    ["?precision=0", 'd="m1 2 50 58Z"'],
    ["?precision=1", 'd="M1.2 2.3 51 60.1Z"'],
    ["?floatPrecision=2", 'd="M1.23 2.35 51 60.12Z"'],
    // Written however it reads best; matched in lower case.
    ["?PRECISION=1", 'd="M1.2 2.3 51 60.1Z"'],
    ["?precision=1#deep", 'd="M1.2 2.3 51 60.1Z"'],
  ])("should read %s off the asset name", async (query, expected) => {
    expect(await minified(query)).toContain(expected);
  });

  it.each([
    // `toFixed` stops at 10 and svgo answers anything else with a RangeError
    // naming neither the option nor the value, so the range is checked first.
    "?precision=-1",
    "?precision=99",
    "?precision=abc",
    "?v=2",
    "?multipass=perhaps",
  ])("should ignore %s", async (query) => {
    expect(await minified(query)).toBe(await minified(""));
  });

  it.each([
    ["?pretty", "    <path"],
    ["?pretty&indent=2", "  <path"],
    ["?pretty&indent=0", "<path"],
  ])("should lay the output out for %s", async (query, indented) => {
    // Split on either ending: `.gitattributes` normalizes the checkout per
    // platform, so what a line ends with is not what this is testing.
    expect((await minified(query)).split(/\r?\n/)[1]).toBe(
      `${indented} fill="red" d="m1.235 2.346 49.753 57.777Z"/>`,
    );
  });

  it("should read `pretty=false` as asking against it", async () => {
    expect(await minified("?pretty=false")).toBe(await minified(""));
  });

  it("should let the query override `encodeOptions`", async () => {
    const configured = { encodeOptions: { floatPrecision: 4 } };

    expect(await minified("?precision=1", configured)).toContain(
      'd="M1.2 2.3 51 60.1Z"',
    );
    expect(await minified("", configured)).toContain(
      'd="m1.2346 2.3457 49.753 57.7778Z"',
    );
  });

  it("should be read in a worker, where the function arrives as source", async () => {
    // The minify function crosses the worker boundary as source and carries no
    // module scope with it, which is why svgo reads its query inline rather
    // than through the table the image minimizers share. A build with the pool
    // on is the only thing that catches getting that wrong.
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/queried-svgs.js"),
      output: {
        pathinfo: false,
        path: path.resolve(__dirname, "dist"),
        filename: "[name].js",
        assetModuleFilename: (pathData) => {
          const query =
            (pathData.module &&
              pathData.module.resourceResolveData &&
              pathData.module.resourceResolveData.query) ||
            "";

          return `[name]${query.replace(/^\?/, "-").replace(/[=&]/g, "-")}[ext][query]`;
        },
      },
      module: { rules: [{ test: /\.svg$/i, type: "asset/resource" }] },
    });

    new MinimizerPlugin({
      test: /\.svg$/i,
      parallel: 2,
      minify: MinimizerPlugin.svgoMinify,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);

    const emitted = {};

    for (const asset of stats
      .toJson({ all: false, assets: true })
      .assets.filter((item) => !item.name.endsWith(".js"))) {
      emitted[asset.name] = readBytes(
        compiler,
        stats,
        asset.name.replace(/[?#].*$/, ""),
      ).toString();
    }

    expect(Object.keys(emitted).sort()).toEqual([
      "precise-precision-1.svg?precision=1",
      "precise-pretty.svg?pretty",
      "precise.svg",
    ]);
    expect(emitted["precise-pretty.svg?pretty"]).toContain("\n");
    expect(emitted["precise.svg"]).not.toContain("\n");
    expect(emitted["precise-precision-1.svg?precision=1"]).toContain(
      'd="M1.2 2.3 51 60.1Z"',
    );
  });

  it("should keep an `encodeOptions.js2svg` the query does not speak for", async () => {
    const configured = { encodeOptions: { js2svg: { indent: 3 } } };

    expect((await minified("?pretty", configured)).split(/\r?\n/)[1]).toMatch(
      /^ {3}<path/,
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
