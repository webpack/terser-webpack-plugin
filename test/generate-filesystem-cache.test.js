import fs from "fs";
import os from "os";
import path from "path";

import MinimizerPlugin from "../src";
import { replaceExtension } from "../src/utils";

import { getCompiler, getErrors } from "./helpers";

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

/**
 * A stand-in for an encoder: it prefixes the bytes and says what the result is
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
});
