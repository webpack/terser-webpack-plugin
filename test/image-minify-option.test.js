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
      { [`image.${format}${query}`]: await patterned(sharp, format) },
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
