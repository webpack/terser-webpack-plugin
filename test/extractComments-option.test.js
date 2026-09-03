import path from "path";

import webpack from "webpack";

import MinimizerPlugin from "../src/index";

import {
  ExistingCommentsFile,
  compile,
  getCompiler,
  getErrors,
  getWarnings,
  readAsset,
  readsAssets,
} from "./helpers";

function createFilenameFn() {
  return (fileData) => {
    expect(fileData).toBeDefined();

    // A file can contain a query string (for example when you have `output.filename: '[name].js?[chunkhash]'`)
    // You must consider this
    return `${fileData.filename}.LICENSE.txt${fileData.query}`;
  };
}

describe("extractComments option", () => {
  let compiler;

  beforeEach(() => {
    compiler = getCompiler({
      entry: {
        one: path.resolve(__dirname, "./fixtures/comments.js"),
        two: path.resolve(__dirname, "./fixtures/comments-2.js"),
        three: path.resolve(__dirname, "./fixtures/comments-3.js"),
        four: path.resolve(__dirname, "./fixtures/comments-4.js"),
      },
      output: {
        filename: "filename/[name].js",
        chunkFilename: "chunks/[id].[name].js",
      },
    });
  });

  it("should match snapshot when a value is not specify", async () => {
    new MinimizerPlugin().apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "false" value', async () => {
    new MinimizerPlugin({ extractComments: false }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "true" value', async () => {
    new MinimizerPlugin({ extractComments: true }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "/Foo/" value', async () => {
    new MinimizerPlugin({ extractComments: /Foo/ }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "all" value', async () => {
    new MinimizerPlugin({ extractComments: "all" }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "some" value', async () => {
    new MinimizerPlugin({ extractComments: "some" }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "Foo" value', async () => {
    new MinimizerPlugin({ extractComments: "Foo" }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for a "function" value', async () => {
    new MinimizerPlugin({ extractComments: () => true }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "extractComments.condition" with the "true" value', async () => {
    new MinimizerPlugin({
      extractComments: {
        condition: true,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should match snapshot when extracts comments to multiple files", async () => {
    expect.assertions(8);

    new MinimizerPlugin({
      extractComments: {
        condition: true,
        filename: createFilenameFn(),
        banner: (licenseFile) =>
          `License information can be found in ${licenseFile}`,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should match snapshot when extracts comments to a single file", async () => {
    new MinimizerPlugin({
      extractComments: {
        condition: true,
        filename: "extracted-comments.js",
        banner(licenseFile) {
          return `License information can be found in ${licenseFile}`;
        },
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should match snapshot when extracts without condition", async () => {
    new MinimizerPlugin({
      extractComments: {
        condition: true,
        filename: "extracted-comments.js",
        banner(licenseFile) {
          return `License information can be found in ${licenseFile}`;
        },
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the `true` value and preserve "@license" comments', async () => {
    new MinimizerPlugin({
      terserOptions: {
        output: {
          comments: /@license/i,
        },
      },
      extractComments: true,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot when no condition, preserve only `/@license/i` comments and extract "some" comments', async () => {
    expect.assertions(8);

    new MinimizerPlugin({
      terserOptions: {
        output: {
          comments: /@license/i,
        },
      },
      extractComments: {
        filename: createFilenameFn(),
        banner: (licenseFile) =>
          `License information can be found in ${licenseFile}`,
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should match snapshot for the `true` value and dedupe duplicate comments", async () => {
    new MinimizerPlugin({ extractComments: true }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should match snapshot when extracts comments to a single file and dedupe duplicate comments", async () => {
    new MinimizerPlugin({
      extractComments: {
        condition: true,
        filename: "extracted-comments.js",
        banner(licenseFile) {
          return `License information can be found in ${licenseFile}`;
        },
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should match snapshot when extracts comments to files with query string", async () => {
    compiler = getCompiler({
      entry: {
        one: path.resolve(__dirname, "./fixtures/comments.js"),
        two: path.resolve(__dirname, "./fixtures/comments-2.js"),
        three: path.resolve(__dirname, "./fixtures/comments-3.js"),
        four: path.resolve(__dirname, "./fixtures/comments-4.js"),
      },
      output: {
        filename: "filename/[name].js?[chunkhash]",
        chunkFilename: "chunks/[id].[name].js?[chunkhash]",
      },
    });

    new MinimizerPlugin().apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should match snapshot when extracts comments to files with query string and with placeholders", async () => {
    compiler = getCompiler({
      entry: {
        one: path.resolve(__dirname, "./fixtures/comments.js"),
        two: path.resolve(__dirname, "./fixtures/comments-2.js"),
        three: path.resolve(__dirname, "./fixtures/comments-3.js"),
        four: path.resolve(__dirname, "./fixtures/comments-4.js"),
      },
      output: {
        filename: "filename/[name].js?[chunkhash]",
        chunkFilename: "chunks/[id].[name].js?[chunkhash]",
      },
    });

    new MinimizerPlugin({
      extractComments: {
        condition: true,
        filename: "[file].LICENSE.txt?query=[query]&filebase=[base]",
        banner(licenseFile) {
          return `License information can be found in ${licenseFile}`;
        },
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should match snapshot when extracts comments to files with query string and when filename is a function", async () => {
    expect.assertions(8);

    compiler = getCompiler({
      entry: {
        one: path.resolve(__dirname, "./fixtures/comments.js"),
        two: path.resolve(__dirname, "./fixtures/comments-2.js"),
        three: path.resolve(__dirname, "./fixtures/comments-3.js"),
        four: path.resolve(__dirname, "./fixtures/comments-4.js"),
      },
      output: {
        filename: "filename/[name].js?[chunkhash]",
        chunkFilename: "chunks/[id].[name].js?[chunkhash]",
      },
    });

    new MinimizerPlugin({
      extractComments: {
        condition: true,
        filename: createFilenameFn(),
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should match snapshot for nested comment file", async () => {
    compiler = getCompiler({
      entry: {
        one: path.resolve(__dirname, "./fixtures/comments.js"),
      },
    });

    new MinimizerPlugin({
      extractComments: {
        condition: true,
        filename: "comments/directory/one.js",
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should match snapshot for comment file when filename is nested", async () => {
    compiler = getCompiler({
      entry: {
        one: path.resolve(__dirname, "./fixtures/comments.js"),
      },
      output: {
        filename: "nested/directory/[name].js?[chunkhash]",
      },
    });

    new MinimizerPlugin({
      extractComments: {
        condition: true,
        filename: "one.js",
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot and extract "some" comments', async () => {
    new MinimizerPlugin({
      extractComments: true,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot and preserve "all" and extract "some" comments', async () => {
    new MinimizerPlugin({
      extractComments: true,
      terserOptions: {
        output: {
          comments: "all",
        },
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot and do not preserve and extract "all" comments', async () => {
    new MinimizerPlugin({
      extractComments: "all",
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot and preserve "all" and extract "all" comments', async () => {
    new MinimizerPlugin({
      extractComments: "all",
      terserOptions: {
        output: {
          comments: "all",
        },
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot and do not preserve and extract "all" comments when the option if a function', async () => {
    new MinimizerPlugin({
      extractComments: () => true,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot and preserve "all" and extract "all" comments with output.comments "all"', async () => {
    new MinimizerPlugin({
      extractComments: () => true,
      terserOptions: {
        output: {
          comments: "all",
        },
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot and do not preserve and extract "some" comments', async () => {
    new MinimizerPlugin({
      extractComments: {},
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot and preserve "all" and extract comments with output.comments "all"', async () => {
    new MinimizerPlugin({
      extractComments: {},
      terserOptions: {
        output: {
          comments: "all",
        },
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot and preserve "all" and extract "some" comments with output.comments "all"', async () => {
    new MinimizerPlugin({
      extractComments: {
        condition: "some",
      },
      terserOptions: {
        output: {
          comments: "all",
        },
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot and preserve "all" and do not extract comments', async () => {
    new MinimizerPlugin({
      extractComments: {
        condition: false,
      },
      terserOptions: {
        output: {
          comments: "all",
        },
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot and preserve "some" do not extract comments', async () => {
    new MinimizerPlugin({
      extractComments: false,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot and preserve "all" do not extract comments', async () => {
    new MinimizerPlugin({
      extractComments: false,
      terserOptions: {
        output: {
          comments: "all",
        },
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should match snapshot and do not preserve or extract comments", async () => {
    new MinimizerPlugin({
      extractComments: false,
      terserOptions: {
        output: {
          comments: false,
        },
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should match snapshot and keep shebang", async () => {
    compiler = getCompiler({
      entry: {
        shebang: path.resolve(__dirname, "./fixtures/shebang.js"),
        shebang1: path.resolve(__dirname, "./fixtures/shebang-1.js"),
      },
      target: "node",
      plugins: [
        new webpack.BannerPlugin({ banner: "#!/usr/bin/env node", raw: true }),
      ],
    });

    new MinimizerPlugin().apply(compiler);

    const stats = await compile(compiler);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should work with the existing licenses file", async () => {
    new ExistingCommentsFile().apply(compiler);
    new MinimizerPlugin({
      extractComments: {
        filename: "licenses.txt",
      },
    }).apply(compiler);

    const stats = await compile(compiler);

    const licenses = readAsset("licenses.txt", compiler, stats);

    // The file another plugin emitted is kept, and the first asset to reach it
    // is merged in rather than dropped.
    expect(licenses).toContain("// Existing Comment");
    expect(licenses).toContain("/*! Legal Comment */");

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should keep the comments of every asset sharing a file, when they are not adjacent", async () => {
    // Assets reach the comments file in name order, so `b` sits between the two
    // that share `shared.txt`.
    const sharedCompiler = getCompiler({
      entry: {
        a: path.resolve(__dirname, "./fixtures/comments-2.js"),
        b: path.resolve(__dirname, "./fixtures/comments-3.js"),
        c: path.resolve(__dirname, "./fixtures/comments-4.js"),
      },
    });

    new MinimizerPlugin({
      extractComments: {
        filename: (fileData) =>
          fileData.filename === "b.js" ? "b.txt" : "shared.txt",
      },
    }).apply(sharedCompiler);

    const stats = await compile(sharedCompiler);

    const shared = readAsset("shared.txt", sharedCompiler, stats);

    expect(shared).toContain("Information.");
    expect(shared).toContain("Duplicate comment in difference files.");
    expect(readAsset("b.txt", sharedCompiler, stats)).toContain(
      "Duplicate comment in same file.",
    );

    expect(readsAssets(sharedCompiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });
});
