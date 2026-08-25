import path from "path";

import MinimizerPlugin from "../src";

import { compile, getCompiler, getErrors, readAsset } from "./helpers";

// The `collectEmbeddedSource` / `embeddedSources` protocol on its own: a
// minimizer says what it nests, each body goes to whichever minimizer claims
// its language, and the answers come back for the pass that emits. Driven by
// minify functions written here rather than webpack's, so it holds on every
// webpack the plugin supports — including ones with no embedded-source hook.

// Built per call: a `g` regexp carries `lastIndex` between uses, and this file
// runs on every Node the plugin supports — including ones without `matchAll`.
const bodyRe = () => /<(style|script|svg)>([\s\S]*?)<\/\1>/g;
const LANGUAGE_BY_TAG = { script: "javascript", style: "css", svg: "svg" };

/** @type {string[]} */
let asked;

/**
 * A document minifier: reports the bodies it nests when asked to collect, and
 * writes back whatever answers it is given.
 * @param {{ [file: string]: string }} input a single `{ filename: code }` entry
 * @param {undefined} sourceMap unused
 * @param {{ collectEmbeddedSource?: boolean, embeddedSources?: { type: string, source: string, rendered: string }[] }} minimizerOptions minimizer options
 * @returns {EXPECTED_ANY} the document, and what it nests when asked to collect
 */
function pageMinify(input, sourceMap, minimizerOptions) {
  const [[, code]] = Object.entries(input);

  asked.push(minimizerOptions.collectEmbeddedSource ? "collect" : "emit");

  if (minimizerOptions.collectEmbeddedSource) {
    const embeddedSources = [];
    const re = bodyRe();
    let match = re.exec(code);

    while (match !== null) {
      embeddedSources.push({
        type: LANGUAGE_BY_TAG[/** @type {"script"} */ (match[1])],
        source: match[2],
      });
      match = re.exec(code);
    }

    return { code, embeddedSources };
  }

  const answers = new Map(
    (minimizerOptions.embeddedSources || []).map((entry) => [
      entry.source,
      entry.rendered,
    ]),
  );

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
    // Collected first, then emitted with the answer written back.
    expect(asked).toEqual(["collect", "emit"]);
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
    // One plain minification: nothing claims css or javascript, so the extra
    // pass would only ever be told about bodies with nowhere to go.
    expect(asked).toEqual(["emit"]);
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

  it("leaves everything alone when `minifyEmbedded` is false", async () => {
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
      minify: [pageMinify, fakeCssMinify],
      minimizerOptions: [{}, {}],
      minifyEmbedded: false,
      parallel: false,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toEqual([]);
    expect(asked).toEqual(["emit"]);
    expect(readAsset("host.page", compiler, stats)).toContain(
      "<style>  .a { COLOR : RED }  </style>",
    );
  });
});
