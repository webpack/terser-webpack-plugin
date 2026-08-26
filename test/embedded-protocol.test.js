import path from "path";

import MinimizerPlugin from "../src";

import { compile, getCompiler, getErrors, readAsset } from "./helpers";

// The `renderEmbeddedSource` dispatch on its own: a minimizer hands out what it
// nests, each body goes to whichever minimizer claims its language, and the
// answer comes back for the same print. Driven by
// minify functions written here rather than webpack's, so it holds on every
// webpack the plugin supports — including ones with no embedded-source hook.

// Built per call: a `g` regexp carries `lastIndex` between uses, and this file
// runs on every Node the plugin supports — including ones without `matchAll`.
const bodyRe = () => /<(style|script|svg)>([\s\S]*?)<\/\1>/g;
const LANGUAGE_BY_TAG = { script: "javascript", style: "css", svg: "svg" };

/** @type {string[]} */
let asked;

/**
 * A document minifier: hands each body it nests to the caller's renderer and
 * writes back whatever comes of it.
 * @param {{ [file: string]: string }} input a single `{ filename: code }` entry
 * @param {undefined} sourceMap unused
 * @param {{ renderEmbeddedSource?: (source: string, info: { type: string }) => Promise<string | undefined> }} minimizerOptions minimizer options
 * @returns {Promise<{ code: string }>} the document
 */
async function pageMinify(input, sourceMap, minimizerOptions) {
  const [[, code]] = Object.entries(input);
  const { renderEmbeddedSource } = minimizerOptions;

  asked.push(renderEmbeddedSource ? "render" : "plain");

  if (!renderEmbeddedSource) return { code };

  // Collected first so every body is rendered at once, exactly as webpack's own
  // minifiers defer them: one parse, the answers put in afterwards.
  const bodies = [];
  const re = bodyRe();
  let match = re.exec(code);

  while (match !== null) {
    bodies.push({
      type: LANGUAGE_BY_TAG[/** @type {"script"} */ (match[1])],
      source: match[2],
    });
    match = re.exec(code);
  }

  const rendered = await Promise.all(
    bodies.map(({ source, type }) => renderEmbeddedSource(source, { type })),
  );
  const answers = new Map();

  for (let i = 0; i < bodies.length; i++) {
    if (typeof rendered[i] === "string") {
      answers.set(bodies[i].source, rendered[i]);
    }
  }

  return {
    code: code.replace(bodyRe(), (whole, tag, body) =>
      answers.has(body) ? `<${tag}>${answers.get(body)}</${tag}>` : whole,
    ),
  };
}

pageMinify.getTypes = () => ["page"];
pageMinify.getEmbeddedTypes = () => ["css", "javascript"];
pageMinify.supportsWorker = () => false;
pageMinify.supportsWorkerThreads = () => false;
pageMinify.filter = (name) => /\.page$/i.test(name);

/**
 * @param {{ [file: string]: string }} input a single `{ filename: code }` entry
 * @returns {{ code: string }} the body, lowercased and trimmed
 */
function fakeCssMinify(input) {
  const [[, code]] = Object.entries(input);

  return { code: code.toLowerCase().replace(/\s+/g, "") };
}

fakeCssMinify.getTypes = () => ["css"];
fakeCssMinify.supportsWorker = () => false;
fakeCssMinify.supportsWorkerThreads = () => false;
// Claims no asset at all: a minimizer can be configured for embedded source
// alone, since `filter` answers for assets and `getTypes` for languages.
fakeCssMinify.filter = () => false;

/**
 * @returns {{ code: undefined, errors: Error[] }} a failure, reported rather than thrown
 */
function failingJsMinify() {
  return { code: undefined, errors: [new Error("cannot read this")] };
}

failingJsMinify.getTypes = () => ["javascript"];
failingJsMinify.supportsWorker = () => false;
failingJsMinify.supportsWorkerThreads = () => false;
failingJsMinify.filter = () => false;

/**
 * @param {EXPECTED_ANY[]} minify minify functions
 * @returns {import("webpack").Compiler} compiler with the document emitted as an asset
 */
const getPageCompiler = (minify) => {
  const compiler = getCompiler({
    entry: path.resolve(__dirname, "./fixtures/embedded/entry-page.js"),
    target: "node",
    output: {
      path: path.resolve(__dirname, "helpers/dist"),
      filename: "[name].js",
      assetModuleFilename: "[name][ext]",
    },
    module: { rules: [{ test: /\.page$/, type: "asset/resource" }] },
  });

  new MinimizerPlugin({
    test: /\.page$/i,
    minify,
    minimizerOptions: minify.map(() => ({})),
    parallel: false,
  }).apply(compiler);

  return compiler;
};

describe("embedded sources", () => {
  beforeEach(() => {
    asked = [];
  });

  it("hands each nested body to the minimizer claiming its language", async () => {
    const compiler = getPageCompiler([pageMinify, fakeCssMinify]);
    const stats = await compile(compiler);

    expect(getErrors(stats)).toEqual([]);
    // One call, with the renderer handed in.
    expect(asked).toEqual(["render"]);
    expect(readAsset("host.page", compiler, stats)).toContain(
      "<style>.a{color:red}</style>",
    );
  });

  it("keeps a body whose language nothing claims exactly as written", async () => {
    const compiler = getPageCompiler([pageMinify, fakeCssMinify]);
    const stats = await compile(compiler);
    const page = readAsset("host.page", compiler, stats);

    // JavaScript is offered but nothing here minifies it, and `svg` is not even
    // offered — both come out byte for byte.
    expect(page).toContain("<script>  var  a  =  1  </script>");
    expect(page).toContain("<svg>  <rect />  </svg>");
  });

  it("does not ask for what nothing here can minify", async () => {
    const compiler = getPageCompiler([pageMinify]);
    const stats = await compile(compiler);

    expect(getErrors(stats)).toEqual([]);
    // No renderer handed in: nothing claims css or javascript, so offering a
    // body would only ever reach one with nowhere to go.
    expect(asked).toEqual(["plain"]);
  });

  it("reports a nested failure against the document that holds it", async () => {
    const compiler = getPageCompiler([pageMinify, failingJsMinify]);
    const stats = await compile(compiler);

    expect(getErrors(stats)).toHaveLength(1);
    expect(getErrors(stats)[0]).toMatch(/Terser plugin\ncannot read this/);
    // Reported, not thrown, and the body it failed over stays as written.
    expect(stats.compilation.getAsset("host.page").source.source()).toContain(
      "<script>  var  a  =  1  </script>",
    );
  });
});

// A minifier that both claims a language and can hand that same language out —
// the shape webpack's own `cssMinify` has, and the one a single non-array
// `minify` option takes.
const nestedRe = () => /<<([\s\S]*?)>>/g;
const collapse = (text) => text.replace(/\s+/g, "");

/**
 * @param {{ [file: string]: string }} input a single `{ filename: code }` entry
 * @param {undefined} sourceMap unused
 * @param {{ renderEmbeddedSource?: (source: string, info: { type: string }) => Promise<string | undefined> }} minimizerOptions minimizer options
 * @returns {Promise<{ code: string }>} the sheet
 */
async function selfNestingCssMinify(input, sourceMap, minimizerOptions) {
  const [[, code]] = Object.entries(input);
  const { renderEmbeddedSource } = minimizerOptions;

  asked.push(renderEmbeddedSource ? "render" : "plain");

  if (!renderEmbeddedSource) return { code: collapse(code) };

  const bodies = [];
  const re = nestedRe();
  let match = re.exec(code);

  while (match !== null) {
    bodies.push(match[1]);
    match = re.exec(code);
  }

  const rendered = await Promise.all(
    bodies.map((source) => renderEmbeddedSource(source, { type: "css" })),
  );
  const answers = new Map();

  for (let i = 0; i < bodies.length; i++) {
    if (typeof rendered[i] === "string") answers.set(bodies[i], rendered[i]);
  }

  return {
    code: collapse(
      code.replace(nestedRe(), (whole, body) =>
        answers.has(body) ? `<<${answers.get(body)}>>` : whole,
      ),
    ),
  };
}

selfNestingCssMinify.getTypes = () => ["css"];
selfNestingCssMinify.getEmbeddedTypes = () => ["css"];
selfNestingCssMinify.supportsWorker = () => false;
selfNestingCssMinify.supportsWorkerThreads = () => false;
selfNestingCssMinify.filter = (name) => /\.page$/i.test(name);

/**
 * A second minifier over the same asset that reads no nested source at all.
 * @param {{ [file: string]: string }} input a single `{ filename: code }` entry
 * @returns {{ code: string }} the input, untouched
 */
function passThroughMinify(input) {
  const [[, code]] = Object.entries(input);

  return { code };
}

passThroughMinify.getTypes = () => ["page"];
passThroughMinify.supportsWorker = () => false;
passThroughMinify.supportsWorkerThreads = () => false;
passThroughMinify.filter = () => true;

describe("embedded dispatch shapes", () => {
  beforeEach(() => {
    asked = [];
  });

  it("takes a single `minify` function and a single `minimizerOptions`", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/embedded/entry-nesting.js"),
      target: "node",
      output: {
        path: path.resolve(__dirname, "helpers/dist"),
        filename: "[name].js",
        assetModuleFilename: "[name][ext]",
      },
      module: { rules: [{ test: /\.page$/, type: "asset/resource" }] },
    });

    // Neither is an array: one implementation, one options object shared by it.
    new MinimizerPlugin({
      test: /\.page$/i,
      minify: selfNestingCssMinify,
      minimizerOptions: {},
      parallel: false,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toEqual([]);
    // The nested body is dispatched back to the same minimizer, which is handed
    // a renderer of its own and finds nothing further to offer.
    expect(asked).toEqual(["render", "render"]);
    expect(readAsset("nesting.page", compiler, stats)).toContain("<<.b{}>>");
  });

  it("takes an options array shorter than the minimizers it pairs with", async () => {
    const compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/embedded/entry-page.js"),
      target: "node",
      output: {
        path: path.resolve(__dirname, "helpers/dist"),
        filename: "[name].js",
        assetModuleFilename: "[name][ext]",
      },
      module: { rules: [{ test: /\.page$/, type: "asset/resource" }] },
    });

    // One entry for two implementations, and the second reads no nested source
    // at all: the missing entry is an empty one, and it gets no overlay.
    new MinimizerPlugin({
      test: /\.page$/i,
      minify: [pageMinify, fakeCssMinify, passThroughMinify],
      minimizerOptions: [{}],
      parallel: false,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toEqual([]);
    expect(readAsset("host.page", compiler, stats)).toContain(
      "<style>.a{color:red}</style>",
    );
  });
});
