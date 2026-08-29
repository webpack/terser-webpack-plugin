import path from "path";

import MinimizerPlugin from "../src";
import { replaceExtension } from "../src/utils";

import { compile, getCompiler, getErrors, getWarnings } from "./helpers";

// Renaming an asset needs `NormalModule`'s `processResult` hook to be able to
// await, which webpack gained in 5.110. Older webpack is not silently ignored:
// the plugin says what it needs, and these cases assert that instead.
const [major, minor] = require("webpack/package.json")
  .version.split(".")
  .map(Number);

const CAN_AWAIT = major > 5 || (major === 5 && minor >= 110);

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

  return {
    code: Buffer.concat([Buffer.from("WEBP:"), Buffer.from(code)]),
    filename: replaceExtension(name, "webp"),
  };
}

toWebp.supportsBinary = () => true;
toWebp.supportsWorker = () => false;

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

    if (!CAN_AWAIT) {
      expect(getErrors(stats).join("\n")).toMatch(/needs webpack >= 5\.110/);

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

    if (!CAN_AWAIT) {
      expect(getErrors(stats).join("\n")).toMatch(/needs webpack >= 5\.110/);

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

    if (!CAN_AWAIT) {
      expect(getErrors(stats).join("\n")).toMatch(/needs webpack >= 5\.110/);

      return;
    }

    const names = Object.keys(stats.compilation.assets);

    expect(getErrors(stats)).toEqual([]);
    expect(names).toContain("image.jpg");
    expect(names).not.toContain("image.webp");
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
