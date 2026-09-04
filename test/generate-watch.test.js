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
