import fs from "fs";
import os from "os";
import path from "path";

import MinimizerPlugin from "../src";
import { replaceExtension } from "../src/utils";

import {
  compile,
  getCompiler,
  getErrors,
  getWarnings,
  readAsset,
} from "./helpers";
import { RUN_IMAGE_TESTS } from "./helpers/env";

/**
 * `describe` where this environment can run the block, `describe.skip` where it
 * cannot, so one file can carry blocks with different requirements.
 * @param {boolean} condition whether this environment can run it
 * @returns {jest.Describe} describe, or describe.skip
 */
const describeIf = (condition) => (condition ? describe : describe.skip);
// Renaming an asset needs `NormalModule`'s `processResult` hook to be able to
// await. Read off what the build did rather than off a version number: the
// release carrying it is not out yet, so a version test would claim the
// capability on every webpack released before it.
/**
 * @param {import("webpack").Stats} stats stats
 * @returns {boolean} true when the plugin reported that it cannot await
 */
function reportedNoAwait(stats) {
  return getErrors(stats).join("\n").includes("hook can await");
}

const IMAGE_RULES = [
  {
    test: /\.(png|jpe?g|svg)$/i,
    type: "asset/resource",
    generator: { filename: "[name][ext]" },
  },
];

/**
 * A stand-in for an encoder: it rewrites the bytes and says what the result is
 * now called, which is all the plugin needs to rename the asset.
 * @param {{ [file: string]: string | Buffer }} input input
 * @returns {{ code: Buffer, filename: string }} the re-encoded result
 */
function toWebp(input) {
  const [[name, code]] = Object.entries(input);

  toWebp.calls += 1;

  return {
    code: Buffer.concat([Buffer.from("WEBP:"), Buffer.from(code)]),
    filename: replaceExtension(name, "webp"),
  };
}

toWebp.supportsBinary = () => true;
toWebp.supportsWorker = () => false;
toWebp.calls = 0;

/**
 * A second encoder. Its source differs from `toWebp`'s deliberately: source is
 * what tells two generators apart when neither reports a version.
 * @param {{ [file: string]: string | Buffer }} input input
 * @returns {{ code: Buffer, filename: string }} the re-encoded result
 */
function toAvif(input) {
  const [[name, code]] = Object.entries(input);
  const marker = Buffer.from("AVIF:");

  toAvif.calls += 1;

  return {
    code: Buffer.concat([marker, Buffer.from(code)]),
    filename: replaceExtension(name, "avif"),
  };
}

toAvif.supportsBinary = () => true;
toAvif.supportsWorker = () => false;
toAvif.calls = 0;

/**
 * @param {import("webpack").Compiler} compiler compiler
 * @param {import("webpack").Stats} stats stats
 * @param {string} name emitted name
 * @returns {Buffer} the emitted bytes
 */
function readBytes(compiler, stats, name) {
  return compiler.outputFileSystem.readFileSync(
    path.join(stats.compilation.outputOptions.path, name),
  );
}

/**
 * @param {string} directory directory to remove, with everything under it
 * @returns {void}
 */
function removeRecursive(directory) {
  for (const entry of fs.readdirSync(directory)) {
    const full = path.join(directory, entry);

    if (fs.statSync(full).isDirectory()) {
      removeRecursive(full);
    } else {
      fs.unlinkSync(full);
    }
  }

  fs.rmdirSync(directory);
}

/**
 * @param {import("webpack").Stats} stats stats
 * @param {string} name the module's short name
 * @returns {{ cached: boolean, built: boolean }} how it came to be in the build
 */
function moduleState(stats, name) {
  const { modules } = stats.toJson({
    all: false,
    modules: true,
    cachedModules: true,
  });
  const found = modules.find((item) => item.name === name);

  return { cached: Boolean(found.cached), built: Boolean(found.built) };
}

/**
 * Drives a watching compiler one build at a time: each call resolves with the
 * stats of the next build the watcher completes.
 */
class Watcher {
  /**
   * @param {import("webpack").Compiler} compiler compiler
   */
  constructor(compiler) {
    this.pending = [];
    this.waiting = [];
    // Polling, because the CI runners disagree about native file watching.
    this.watching = compiler.watch(
      { aggregateTimeout: 50, poll: 100 },
      (error, stats) => {
        const settle = this.waiting.shift();

        if (settle) {
          settle(error, stats);
        } else {
          this.pending.push([error, stats]);
        }
      },
    );
  }

  /**
   * @returns {Promise<import("webpack").Stats>} the stats of the next build
   */
  next() {
    return new Promise((resolve, reject) => {
      /**
       * @param {(Error | null)=} error build error
       * @param {import("webpack").Stats=} stats build stats
       * @returns {void}
       */
      const settle = (error, stats) => {
        if (error) {
          reject(error);
        } else {
          resolve(/** @type {import("webpack").Stats} */ (stats));
        }
      };

      const ready = this.pending.shift();

      if (ready) {
        settle(ready[0], ready[1]);
      } else {
        this.waiting.push(settle);
      }
    });
  }

  /**
   * @returns {Promise<void>} resolves once the watcher has let go of the files
   */
  close() {
    return new Promise((resolve) => {
      this.watching.close(() => resolve());
    });
  }
}

describe("generate option", () => {
  it("should emit the renamed asset and point the bundle at it", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/images.js"),
      module: { rules: IMAGE_RULES },
    });

    new MinimizerPlugin({ test: /\.jpe?g$/i, generate: toWebp }).apply(
      compiler,
    );

    const stats = await compile(compiler);

    if (reportedNoAwait(stats)) {
      return;
    }

    const names = Object.keys(stats.compilation.assets);

    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);
    expect(names).toContain("image.webp");
    expect(names).not.toContain("image.jpg");
    expect(
      readBytes(compiler, stats, "image.webp").subarray(0, 5).toString(),
    ).toBe("WEBP:");

    // The reference baked into the bundle has to follow the rename, or the
    // asset is emitted under a name nothing asks for. Quoted, because the
    // module's own path stays in the emitted comment and should.
    const bundle = readBytes(compiler, stats, "main.js").toString();

    expect(bundle).toContain('"image.webp"');
    expect(bundle).not.toContain('"image.jpg"');
  });

  it("should keep the query and fragment the request carried", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/query-image.js"),
      module: {
        rules: [
          {
            test: /\.(png|jpe?g|svg|webp)/i,
            type: "asset/resource",
            generator: { filename: "[name][ext][query][fragment]" },
          },
        ],
      },
    });

    new MinimizerPlugin({ test: /\.jpe?g/i, generate: toWebp }).apply(compiler);

    const stats = await compile(compiler);

    if (reportedNoAwait(stats)) {
      return;
    }

    const names = Object.keys(stats.compilation.assets);

    expect(getErrors(stats)).toEqual([]);
    expect(names).toContain("image.webp?w=100#frag");
    expect(names).not.toContain("image.jpg?w=100#frag");
  });

  it("should leave assets the filters reject alone", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/images.js"),
      module: { rules: IMAGE_RULES },
    });

    new MinimizerPlugin({
      test: /\.jpe?g$/i,
      exclude: /image\.jpe?g$/i,
      generate: toWebp,
    }).apply(compiler);

    const stats = await compile(compiler);

    if (reportedNoAwait(stats)) {
      return;
    }

    const names = Object.keys(stats.compilation.assets);

    expect(getErrors(stats)).toEqual([]);
    expect(names).toContain("image.jpg");
    expect(names).not.toContain("image.webp");
  });
});

describe("generatorOptions", () => {
  /**
   * Records the options it was handed and rewrites nothing, so a test can read
   * back what reached it.
   * @param {{ [file: string]: string | Buffer }} input input
   * @param {undefined} sourceMap source map
   * @param {Record<string, EXPECTED_ANY>} generatorOptions the options under test
   * @returns {{ code: string | Buffer }} the input, unchanged
   */
  function records(input, sourceMap, generatorOptions) {
    const [[, code]] = Object.entries(input);

    records.seen.push(generatorOptions);

    return { code };
  }

  records.supportsBinary = () => true;
  records.supportsWorker = () => false;

  beforeEach(() => {
    records.seen = [];
  });

  /**
   * @param {object} options plugin options beyond `test` and `generate`
   * @param {EXPECTED_ANY} generate the generator, or an array of them
   * @returns {Promise<import("webpack").Stats>} the stats of the build
   */
  async function build(options, generate) {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/images.js"),
      module: { rules: IMAGE_RULES },
    });

    new MinimizerPlugin({ test: /\.jpe?g$/i, generate, ...options }).apply(
      compiler,
    );

    return compile(compiler);
  }

  it("should hand one object to the generator", async () => {
    const stats = await build(
      { generatorOptions: { encodeOptions: { webp: { quality: 90 } } } },
      records,
    );

    if (reportedNoAwait(stats)) {
      return;
    }

    expect(records.seen).toHaveLength(1);
    expect(records.seen[0]).toMatchObject({
      encodeOptions: { webp: { quality: 90 } },
    });
  });

  it("should default to an empty object", async () => {
    const stats = await build({}, records);

    if (reportedNoAwait(stats)) {
      return;
    }

    expect(records.seen).toHaveLength(1);
    // `module` and `ecma` are overlaid onto a generator's options the same way
    // they are onto a minimizer's, so an absent `generatorOptions` is not bare.
    expect(Object.keys(records.seen[0]).sort()).toEqual(["ecma", "module"]);
  });

  it("should match an array of options to an array of generators", async () => {
    const stats = await build(
      { generatorOptions: [{ first: true }, { second: true }] },
      [records, records],
    );

    if (reportedNoAwait(stats)) {
      return;
    }

    expect(records.seen).toHaveLength(2);
    expect(records.seen[0]).toMatchObject({ first: true });
    expect(records.seen[1]).toMatchObject({ second: true });
    expect(records.seen[0]).not.toHaveProperty("second");
  });

  it("should share one object across an array of generators", async () => {
    const stats = await build({ generatorOptions: { shared: true } }, [
      records,
      records,
    ]);

    if (reportedNoAwait(stats)) {
      return;
    }

    expect(records.seen).toHaveLength(2);
    expect(records.seen[0]).toMatchObject({ shared: true });
    expect(records.seen[1]).toMatchObject({ shared: true });
  });
});

describe("sharpGenerate target format", () => {
  it("should report when no target format was asked for", async () => {
    const result = await MinimizerPlugin.sharpGenerate(
      { "image.jpg": Buffer.from("x") },
      undefined,
      {},
    );

    expect(result.errors).toHaveLength(1);
    expect(String(result.errors[0])).toMatch(/no target format/);
  });

  it("should report when `encodeOptions` names more than one format", async () => {
    const result = await MinimizerPlugin.sharpGenerate(
      { "image.jpg": Buffer.from("x") },
      undefined,
      { encodeOptions: { webp: {}, avif: {} } },
    );

    expect(result.errors).toHaveLength(1);
    expect(String(result.errors[0])).toMatch(/ambiguous/);
  });

  it("should report a format sharp cannot write", async () => {
    const result = await MinimizerPlugin.sharpGenerate(
      { "image.jpg": Buffer.from("x") },
      undefined,
      { encodeOptions: { bmp: {} } },
    );

    expect(result.errors).toHaveLength(1);
    expect(String(result.errors[0])).toMatch(/does not write 'bmp'/);
  });
});

describe("imageminGenerate", () => {
  // The only block here needing the image packages, so it is gated on its own
  // rather than the whole file being skipped where they are absent.
  describeIf(RUN_IMAGE_TESTS)("with `imagemin` installed", () => {
    // SVG markup under a name claiming a raster format: the same mismatch
    // `imageminMinify` refuses, which is the one a generator exists to take.
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><rect x="1.00000"/></svg>',
    );

    it("should rename an image a plugin turned into SVG", async () => {
      const { code, filename, warnings } =
        await MinimizerPlugin.imageminGenerate(
          { "photo.png": svg },
          undefined,
          { plugins: ["svgo"] },
        );

      expect(warnings).toBeUndefined();
      expect(filename).toBe("photo.svg");
      // svgo ran: the padded coordinate is what it trims.
      expect(code.toString()).not.toContain("1.00000");
      expect(code.toString()).toContain("<svg");
    });

    it("should keep the name when the format did not change", async () => {
      const { code, filename } = await MinimizerPlugin.imageminGenerate(
        { "photo.svg": svg },
        undefined,
        { plugins: ["svgo"] },
      );

      expect(filename).toBeUndefined();
      expect(code.toString()).not.toContain("1.00000");
    });

    it("should keep the query and fragment the name carried", async () => {
      const { filename } = await MinimizerPlugin.imageminGenerate(
        { "photo.png?w=100#frag": svg },
        undefined,
        { plugins: ["svgo"] },
      );

      expect(filename).toBe("photo.svg?w=100#frag");
    });

    it("should declare what it needs from the plugin", () => {
      expect(MinimizerPlugin.imageminGenerate.supportsBinary()).toBe(true);
      // Its plugins shell out to native binaries, so it cannot leave the process.
      expect(MinimizerPlugin.imageminGenerate.supportsWorker()).toBe(false);
      expect(MinimizerPlugin.imageminGenerate.supportsWorkerThreads()).toBe(
        false,
      );
      expect(MinimizerPlugin.imageminGenerate.filter("photo.png")).toBe(true);
      expect(MinimizerPlugin.imageminGenerate.filter("main.js")).toBe(false);
    });
  });
});

describe("generate presets", () => {
  /**
   * @param {string} tag what it writes in front of the bytes
   * @param {string} extension what the result is called
   * @returns {EXPECTED_ANY} a generator that renames to `extension`
   */
  function encoderNamed(tag, extension) {
    /**
     * @param {{ [file: string]: string | Buffer }} input input
     * @returns {{ code: Buffer, filename: string }} the re-encoded result
     */
    function encode(input) {
      const [[name, code]] = Object.entries(input);

      encode.calls += 1;

      return {
        code: Buffer.concat([Buffer.from(`${tag}:`), Buffer.from(code)]),
        filename: replaceExtension(name, extension),
      };
    }

    encode.supportsBinary = () => true;
    encode.supportsWorker = () => false;
    encode.calls = 0;

    return encode;
  }

  /**
   * @param {string} entry fixture that imports the image
   * @param {object} options plugin options
   * @returns {Promise<{ stats: import("webpack").Stats, assets: string[] }>} what the build produced
   */
  async function build(entry, options) {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, entry),
      module: {
        rules: [
          {
            test: /\.(png|jpe?g|svg|webp|avif)/i,
            type: "asset/resource",
            generator: { filename: "[name][ext][query][fragment]" },
          },
        ],
      },
    });

    new MinimizerPlugin({ test: /\.jpe?g/i, ...options }).apply(compiler);

    const stats = await compile(compiler);

    return { stats, assets: Object.keys(stats.compilation.assets) };
  }

  it("should run the preset the asset asks for by name", async () => {
    const webp = encoderNamed("WEBP", "webp");
    const avif = encoderNamed("AVIF", "avif");
    const { stats, assets } = await build("./fixtures/query-image.js", {
      generate: { webp, avif },
    });

    if (reportedNoAwait(stats)) {
      return;
    }

    expect(getErrors(stats)).toEqual([]);
    // `query-image.js` imports `./image.jpg?w=100#frag`, which names no preset.
    expect(webp.calls).toBe(0);
    expect(avif.calls).toBe(0);
    expect(assets).toContain("image.jpg?w=100#frag");
  });

  it("should pick between presets and leave the others alone", async () => {
    const webp = encoderNamed("WEBP", "webp");
    const avif = encoderNamed("AVIF", "avif");
    const { stats, assets } = await build("./fixtures/preset-image.js", {
      generate: { webp, avif },
    });

    if (reportedNoAwait(stats)) {
      return;
    }

    expect(getErrors(stats)).toEqual([]);
    expect(webp.calls).toBe(1);
    expect(avif.calls).toBe(0);
    expect(assets).toContain("image.webp?as=webp");
    expect(assets).not.toContain("image.jpg?as=webp");
  });

  it("should hand each preset its own options", async () => {
    /**
     * @param {{ [file: string]: string | Buffer }} input input
     * @param {undefined} sourceMap source map
     * @param {{ tag?: string }} generatorOptions the preset's options
     * @returns {{ code: Buffer, filename: string }} the re-encoded result
     */
    function records(input, sourceMap, generatorOptions) {
      const [[name, code]] = Object.entries(input);

      records.seen.push(generatorOptions.tag);

      return {
        code: Buffer.from(code),
        filename: replaceExtension(name, "webp"),
      };
    }

    records.supportsBinary = () => true;
    records.supportsWorker = () => false;
    records.seen = [];

    const { stats } = await build("./fixtures/preset-image.js", {
      generate: { webp: records, avif: records },
      generatorOptions: {
        webp: { tag: "for-webp" },
        avif: { tag: "for-avif" },
      },
    });

    if (reportedNoAwait(stats)) {
      return;
    }

    expect(records.seen).toEqual(["for-webp"]);
  });

  it("should report a preset nothing defines", async () => {
    const webp = encoderNamed("WEBP", "webp");
    const { stats, assets } = await build("./fixtures/unknown-preset.js", {
      generate: { webp },
    });

    if (reportedNoAwait(stats)) {
      return;
    }

    expect(getErrors(stats).join("\n")).toContain(
      "no 'jxl' preset in `generate`, which defines 'webp'",
    );
    // Reported rather than guessed at: the asset is left as it was.
    expect(assets).toContain("image.jpg?as=jxl");
    expect(webp.calls).toBe(0);
  });
});

describe("generate assets", () => {
  /**
   * An encoder that reports how often it ran, so a test can tell "declined" from
   * "ran and produced the same name".
   * @param {string} tag bytes it prefixes its output with
   * @param {string} extension extension it re-encodes to
   * @returns {EXPECTED_ANY} the encoder
   */
  function encoderNamed(tag, extension) {
    /**
     * @param {{ [file: string]: string | Buffer }} input input
     * @returns {{ code: Buffer, filename: string }} the re-encoded result
     */
    function encode(input) {
      const [[name, code]] = Object.entries(input);

      encode.calls += 1;

      return {
        ...encode.reports,
        code: Buffer.concat([Buffer.from(`${tag}:`), Buffer.from(code)]),
        filename: replaceExtension(name, extension),
      };
    }

    encode.supportsBinary = () => true;
    encode.supportsWorker = () => false;
    encode.calls = 0;
    encode.reports = {};

    return encode;
  }

  /**
   * @param {object} options plugin options
   * @returns {Promise<{ stats: import("webpack").Stats, assets: string[] }>} what the build produced
   */
  async function build(options) {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/images.js"),
      module: { rules: IMAGE_RULES },
    });

    new MinimizerPlugin({ test: /\.jpe?g$/i, ...options }).apply(compiler);

    const stats = await compile(compiler);

    return { compiler, stats, assets: Object.keys(stats.compilation.assets) };
  }

  it("should generate a new asset beside the one it read", async () => {
    const webp = encoderNamed("WEBP", "webp");
    const { compiler, stats, assets } = await build({
      generate: { webp: { implementation: webp, type: "asset" } },
    });

    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toEqual([]);
    expect(webp.calls).toBe(1);
    expect(assets).toContain("image.webp");
    expect(assets).toContain("image.jpg");
    expect(readAsset("image.webp", compiler, stats).toString()).toMatch(
      /^WEBP:/,
    );
  });

  it("should name the generated asset with `filename` when given one", async () => {
    const webp = encoderNamed("WEBP", "webp");
    const { stats, assets } = await build({
      generate: {
        webp: {
          implementation: webp,
          type: "asset",
          filename: "generated/[name].webp",
        },
      },
    });

    expect(getErrors(stats)).toEqual([]);
    expect(assets).toContain("generated/image.webp");
    expect(assets).not.toContain("image.webp");
  });

  it("should fill `[width]` and `[height]` from what the generator reports", async () => {
    const webp = encoderNamed("WEBP", "webp");

    webp.reports = { width: 320, height: 200 };

    const { stats, assets } = await build({
      generate: {
        webp: {
          implementation: webp,
          type: "asset",
          filename: "[name]-[width]x[height].webp",
        },
      },
    });

    expect(getErrors(stats)).toEqual([]);
    expect(assets).toContain("image-320x200.webp");
  });

  it("should error when `filename` asks for a size the generator does not report", async () => {
    const webp = encoderNamed("WEBP", "webp");
    const { stats, assets } = await build({
      generate: {
        webp: {
          implementation: webp,
          type: "asset",
          filename: "[name]-[width].webp",
        },
      },
    });

    expect(getErrors(stats)).toHaveLength(1);
    expect(getErrors(stats)[0]).toMatch(
      /asks for a size this generator does not report/,
    );
    expect(assets).not.toContain("image-[width].webp");
  });

  it("should remove the original with `deleteOriginalAssets`", async () => {
    const webp = encoderNamed("WEBP", "webp");
    const { stats, assets } = await build({
      generate: {
        webp: {
          implementation: webp,
          type: "asset",
          deleteOriginalAssets: true,
        },
      },
    });

    expect(getErrors(stats)).toEqual([]);
    expect(assets).toContain("image.webp");
    expect(assets).not.toContain("image.jpg");
  });

  it("should skip an asset its `filter` declines", async () => {
    const webp = encoderNamed("WEBP", "webp");
    const { stats, assets } = await build({
      generate: {
        webp: {
          implementation: webp,
          type: "asset",
          filter: (name) => !name.endsWith(".jpg"),
        },
      },
    });

    expect(getErrors(stats)).toEqual([]);
    expect(webp.calls).toBe(0);
    expect(assets).not.toContain("image.webp");
    expect(assets).toContain("image.jpg");
  });

  it("should generate every asset generator asked for, from one asset", async () => {
    const webp = encoderNamed("WEBP", "webp");
    const avif = encoderNamed("AVIF", "avif");
    const { stats, assets } = await build({
      generate: {
        webp: { implementation: webp, type: "asset" },
        avif: { implementation: avif, type: "asset" },
      },
    });

    expect(getErrors(stats)).toEqual([]);
    expect(webp.calls).toBe(1);
    expect(avif.calls).toBe(1);
    expect(assets).toContain("image.webp");
    expect(assets).toContain("image.avif");
    expect(assets).toContain("image.jpg");
  });

  it("should not let `?as=` reach an asset generator", async () => {
    const webp = encoderNamed("WEBP", "webp");
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/preset-image.js"),
      module: {
        rules: [
          {
            test: /\.(png|jpe?g|svg|webp|avif)/i,
            type: "asset/resource",
            generator: { filename: "[name][ext][query][fragment]" },
          },
        ],
      },
    });

    new MinimizerPlugin({
      test: /\.jpe?g/i,
      generate: { webp: { implementation: webp, type: "asset" } },
    }).apply(compiler);

    const stats = await compile(compiler);
    const assets = Object.keys(stats.compilation.assets);

    expect(getErrors(stats)).toEqual([]);
    // The import named the preset, but an `asset` generator reads what was
    // emitted, so the module keeps its own name and the new file sits beside it.
    expect(assets).toContain("image.jpg?as=webp");
    expect(assets).toContain("image.webp?as=webp");
  });
});

describe("generate option in watch mode", () => {
  let context;
  let watcher;

  beforeEach(() => {
    toWebp.calls = 0;
    context = fs.mkdtempSync(path.join(os.tmpdir(), "minimizer-watch-"));

    fs.writeFileSync(
      path.join(context, "index.js"),
      'import jpg from "./image.jpg";\n\n// eslint-disable-next-line no-console\nconsole.log(jpg);\n',
    );
    fs.writeFileSync(path.join(context, "image.jpg"), Buffer.from("first"));
  });

  afterEach(async () => {
    if (watcher) {
      await watcher.close();
      watcher = undefined;
    }

    removeRecursive(context);
  });

  /**
   * @returns {import("webpack").Compiler} a compiler over the temporary project
   */
  function makeCompiler() {
    const compiler = getCompiler({
      context,
      entry: path.join(context, "index.js"),
      // `production` leaves caching off, and then every watch build rebuilds
      // every module — which is not what a rename has to survive.
      cache: { type: "memory" },
      module: {
        rules: [
          {
            test: /\.jpe?g$/i,
            type: "asset/resource",
            generator: { filename: "[name][ext]" },
          },
        ],
      },
    });

    new MinimizerPlugin({ test: /\.jpe?g$/i, generate: toWebp }).apply(
      compiler,
    );

    return compiler;
  }

  /**
   * @param {import("webpack").Compiler} compiler compiler
   * @param {import("webpack").Stats} stats stats
   * @param {string} name emitted name
   * @returns {Buffer} the emitted bytes
   */
  function readBytes(compiler, stats, name) {
    return compiler.outputFileSystem.readFileSync(
      path.join(stats.compilation.outputOptions.path, name),
    );
  }

  it("should re-emit the renamed asset when the image changes", async () => {
    const compiler = makeCompiler();

    watcher = new Watcher(compiler);

    const first = await watcher.next();

    if (reportedNoAwait(first)) {
      return;
    }

    expect(getErrors(first)).toEqual([]);
    expect(Object.keys(first.compilation.assets)).toContain("image.webp");
    expect(readBytes(compiler, first, "image.webp").toString()).toBe(
      "WEBP:first",
    );

    fs.writeFileSync(path.join(context, "image.jpg"), Buffer.from("second"));

    const second = await watcher.next();

    expect(getErrors(second)).toEqual([]);

    const names = Object.keys(second.compilation.assets);

    expect(names).toContain("image.webp");
    expect(names).not.toContain("image.jpg");
    // The generator's answer is cached on the bytes, so new bytes have to
    // reach it rather than the first build's result being served again.
    expect(toWebp.calls).toBe(2);
    expect(readBytes(compiler, second, "image.webp").toString()).toBe(
      "WEBP:second",
    );
  });

  it("should keep the rename when only the module importing it changes", async () => {
    const compiler = makeCompiler();

    watcher = new Watcher(compiler);

    const first = await watcher.next();

    if (reportedNoAwait(first)) {
      return;
    }

    expect(Object.keys(first.compilation.assets)).toContain("image.webp");

    fs.writeFileSync(
      path.join(context, "index.js"),
      'import jpg from "./image.jpg";\n\n// eslint-disable-next-line no-console\nconsole.log(jpg, "changed");\n',
    );

    const second = await watcher.next();

    expect(getErrors(second)).toEqual([]);

    const names = Object.keys(second.compilation.assets);

    // One call across both builds is the evidence that the image module was
    // not rebuilt, so the rename survived on the module rather than being
    // reapplied — `buildInfo.assetResource` is what carries it.
    expect(toWebp.calls).toBe(1);
    expect(names).toContain("image.webp");
    expect(names).not.toContain("image.jpg");

    const bundle = readBytes(compiler, second, "main.js").toString();

    expect(bundle).toContain('"image.webp"');
    expect(bundle).not.toContain('"image.jpg"');
  });
});

describe("generate option with the filesystem cache", () => {
  let context;
  let cacheDirectory;

  beforeEach(() => {
    toWebp.calls = 0;
    toAvif.calls = 0;
    context = fs.mkdtempSync(path.join(os.tmpdir(), "minimizer-fs-cache-"));
    cacheDirectory = path.join(context, "cache");

    fs.writeFileSync(
      path.join(context, "index.js"),
      'import jpg from "./image.jpg";\n\n// eslint-disable-next-line no-console\nconsole.log(jpg);\n',
    );
    fs.writeFileSync(path.join(context, "image.jpg"), Buffer.from("first"));
  });

  afterEach(() => {
    removeRecursive(context);
  });

  /**
   * Runs one build against the shared cache directory and closes the compiler,
   * which is what writes the pack out for the next run to read.
   * @param {object=} options plugin options overriding the defaults
   * @returns {Promise<{ stats: import("webpack").Stats, assets: string[], read: (name: string) => string }>} what the build produced
   */
  function run(options) {
    const compiler = getCompiler({
      context,
      entry: path.join(context, "index.js"),
      // Through the config rather than a later `apply`: the cache strategy is
      // built while webpack applies the configured plugins, so a plugin
      // applied after `webpack()` returns cannot reach its version.
      plugins: [
        new MinimizerPlugin({
          test: /\.jpe?g$/i,
          generate: toWebp,
          ...options,
        }),
      ],
      cache: {
        type: "filesystem",
        cacheDirectory,
        // The test writes no config file for webpack to watch, and the
        // default points at one that does not exist here.
        buildDependencies: {},
      },
      module: {
        rules: [
          {
            test: /\.jpe?g$/i,
            type: "asset/resource",
            generator: { filename: "[name][ext]" },
          },
        ],
      },
    });

    return new Promise((resolve, reject) => {
      compiler.run((error, stats) => {
        if (error) {
          compiler.close(() => reject(error));

          return;
        }

        // Nothing is read here: on a webpack that cannot await, the build
        // reports an error and emits no bundle, and the caller checks that
        // before asking for one.
        const assets = Object.keys(stats.compilation.assets);
        const output = stats.compilation.outputOptions.path;

        compiler.close((closeError) => {
          if (closeError) {
            reject(closeError);

            return;
          }

          resolve({
            stats,
            assets,
            read: (name) =>
              compiler.outputFileSystem
                .readFileSync(path.join(output, name))
                .toString(),
          });
        });
      });
    });
  }

  it("should keep the rename when the module is restored from the pack", async () => {
    const first = await run();

    if (reportedNoAwait(first.stats)) {
      return;
    }

    expect(getErrors(first.stats)).toEqual([]);
    expect(first.assets).toContain("image.webp");
    expect(toWebp.calls).toBe(1);

    const second = await run();

    expect(getErrors(second.stats)).toEqual([]);

    // The second compiler is a new one reading the pack the first wrote, so
    // the image module is restored rather than rebuilt. `assetResource` is
    // serialized with it, which is what has to carry the rename -- a
    // `matchResource` would not survive.
    expect(toWebp.calls).toBe(1);
    expect(moduleState(second.stats, "./image.jpg")).toEqual({
      cached: true,
      built: false,
    });
    expect(second.assets).toContain("image.webp");
    expect(second.assets).not.toContain("image.jpg");
    const bundle = second.read("main.js");

    expect(bundle).toContain('"image.webp"');
    expect(bundle).not.toContain('"image.jpg"');
  });

  it("should re-encode when the image changed between runs", async () => {
    const first = await run();

    if (reportedNoAwait(first.stats)) {
      return;
    }

    expect(first.assets).toContain("image.webp");

    fs.writeFileSync(path.join(context, "image.jpg"), Buffer.from("second"));

    const second = await run();

    expect(getErrors(second.stats)).toEqual([]);
    // New bytes, so neither the module nor the generator's own cache entry
    // may answer from the pack.
    expect(moduleState(second.stats, "./image.jpg").built).toBe(true);
    expect(toWebp.calls).toBe(2);
    expect(second.assets).toContain("image.webp");
    expect(second.assets).not.toContain("image.jpg");
  });

  it("should re-run a changed generator against a warm pack", async () => {
    const first = await run();

    if (reportedNoAwait(first.stats)) {
      return;
    }

    expect(first.assets).toContain("image.webp");

    const second = await run({ generate: toAvif });

    expect(getErrors(second.stats)).toEqual([]);
    // Nothing per-module keys on the plugin, so without the generator in the
    // pack's version the restored module would keep the previous generator's
    // bytes and name.
    expect(toAvif.calls).toBe(1);
    expect(second.assets).toContain("image.avif");
    expect(second.assets).not.toContain("image.webp");
    expect(second.read("image.avif")).toBe("AVIF:first");
  });

  it("should re-run the generator when only its options changed", async () => {
    const first = await run({ generatorOptions: { quality: 50 } });

    if (reportedNoAwait(first.stats)) {
      return;
    }

    expect(toWebp.calls).toBe(1);

    const second = await run({ generatorOptions: { quality: 90 } });

    expect(getErrors(second.stats)).toEqual([]);
    expect(toWebp.calls).toBe(2);
    expect(second.assets).toContain("image.webp");
  });

  it("should read an array of generators for the identity too", async () => {
    const first = await run({ generate: [toWebp] });

    if (reportedNoAwait(first.stats)) {
      return;
    }

    expect(first.assets).toContain("image.webp");
    expect(toWebp.calls).toBe(1);

    const second = await run({ generate: [toAvif] });

    expect(getErrors(second.stats)).toEqual([]);
    expect(toAvif.calls).toBe(1);
    expect(second.assets).toContain("image.avif");
    expect(second.assets).not.toContain("image.webp");
  });
});

describe("replaceExtension", () => {
  it.each([
    ["a/photo.jpg", "webp", "a/photo.webp"],
    // The request's query and fragment name the asset too, so only the
    // extension is the encoder's to change.
    ["photo.jpeg?w=100", "webp", "photo.webp?w=100"],
    ["a/b.png#frag", "avif", "a/b.avif#frag"],
    ["photo.png?w=1#frag", "webp", "photo.webp?w=1#frag"],
    // A dot in a directory name is not an extension.
    ["dir.x/readme", "png", "dir.x/readme.png"],
  ])("should rewrite %s to .%s", (name, extension, expected) => {
    expect(replaceExtension(name, extension)).toBe(expected);
  });
});
