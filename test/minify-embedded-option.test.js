import path from "path";

import { TraceMap, originalPositionFor } from "@jridgewell/trace-mapping";
import del from "del";

import MinimizerPlugin from "../src";

import {
  compile,
  execute,
  getCompiler,
  getErrors,
  getWarnings,
  readAsset,
} from "./helpers";

// `renderEmbeddedSource` landed in webpack 5.110; see `jest.config.js`, which
// skips this file where the installed webpack has no such hook. Its minify
// functions are required by a deep path at call time for the same reason: an
// older webpack has no such file for a static import to resolve.
const WEBPACK_CSS_MINIFY = "webpack/lib/css/cssMinify";
const WEBPACK_HTML_MINIFY = "webpack/lib/html/htmlMinify";

const cssMinify = require(WEBPACK_CSS_MINIFY);
const htmlMinify = require(WEBPACK_HTML_MINIFY);

const fixture = (name) => path.resolve(__dirname, "./fixtures/embedded", name);

/**
 * The three minify functions webpack's own `optimization.minimize` wires into
 * one plugin instance, which is what makes this work out of the box.
 * @param {object} options plugin options
 * @returns {MinimizerPlugin} the plugin
 */
const defaultPlugin = (options = {}) =>
  new MinimizerPlugin({
    test: /\.(?:[cm]?js|css|html)(\?.*)?$/i,
    minify: [MinimizerPlugin.terserMinify, cssMinify, htmlMinify],
    minimizerOptions: [{}, {}, {}],
    parallel: false,
    ...options,
  });

/**
 * @param {import("webpack").Compiler} compiler compiler
 * @param {import("webpack").Stats} stats stats
 * @returns {EXPECTED_ANY} what the bundle exported
 */
const exported = (compiler, stats) =>
  execute(readAsset("main.js", compiler, stats));

/**
 * Stands in for an SVG minifier: collapsing runs of whitespace is enough to
 * show the source was reached and put back in the form it was written in.
 * @param {{ [file: string]: string }} input a single `{ filename: code }` entry
 * @returns {{ code: string }} the minified SVG
 */
function svgMinify(input) {
  const [[, code]] = Object.entries(input);

  return { code: code.replace(/\s+/g, " ").trim() };
}

svgMinify.getTypes = () => ["svg"];
svgMinify.getMinimizerVersion = () => "1.0.0";
svgMinify.supportsWorker = () => false;
svgMinify.supportsWorkerThreads = () => false;
svgMinify.filter = (name) => /\.svg(\?.*)?$/i.test(name);

/**
 * @returns {{ code: string }} never
 */
function brokenMinify() {
  throw new Error("broken");
}

brokenMinify.getTypes = () => ["css"];
brokenMinify.getMinimizerVersion = () => "1.0.0";
brokenMinify.supportsWorker = () => false;
brokenMinify.supportsWorkerThreads = () => false;
brokenMinify.filter = (name) => /\.css(\?.*)?$/i.test(name);

/**
 * @returns {{ code: undefined, errors: Error[] }} a failure, reported rather than thrown
 */
function failingMinify() {
  return { code: undefined, errors: [new Error("cannot read this")] };
}

failingMinify.getTypes = () => ["javascript"];
failingMinify.getMinimizerVersion = () => "1.0.0";
failingMinify.supportsWorker = () => false;
failingMinify.supportsWorkerThreads = () => false;
failingMinify.filter = (name) => /\.[cm]?js(\?.*)?$/i.test(name);

/** @type {boolean[]} */
const collectedBy = [];

/**
 * Reports a body written in a language nothing here minifies, as a minimizer
 * webpack does not ship may.
 * @param {{ [file: string]: string }} input a single `{ filename: code }` entry
 * @param {undefined} sourceMap unused
 * @param {{ collectEmbeddedSource?: boolean }} minimizerOptions minimizer options
 * @returns {EXPECTED_ANY} the input, and what it embeds when asked to collect
 */
function strangeLanguageMinify(input, sourceMap, minimizerOptions) {
  const [[, code]] = Object.entries(input);

  collectedBy.push(Boolean(minimizerOptions.collectEmbeddedSource));

  return minimizerOptions.collectEmbeddedSource
    ? { code, embeddedSources: [{ type: "wasm", source: code }] }
    : { code };
}

strangeLanguageMinify.getTypes = () => ["html"];
// Says it nests a language nothing here minifies, so it is never asked to
// collect: the answer could only ever be "nothing".
strangeLanguageMinify.getEmbeddedTypes = () => ["wasm"];
strangeLanguageMinify.getMinimizerVersion = () => "1.0.0";
strangeLanguageMinify.supportsWorker = () => false;
strangeLanguageMinify.supportsWorkerThreads = () => false;
strangeLanguageMinify.filter = (name) => /\.html(\?.*)?$/i.test(name);

/**
 * Reports rather than throws, as a minimizer that read the source but could
 * make nothing of it does.
 * @returns {{ code: undefined, errors: Error[], warnings: string[] }} the report
 */
function reportingMinify() {
  return {
    code: undefined,
    errors: [new Error("cannot read this")],
    warnings: ["odd, that"],
  };
}

reportingMinify.getTypes = () => ["css"];
reportingMinify.getMinimizerVersion = () => "1.0.0";
reportingMinify.supportsWorker = () => false;
reportingMinify.supportsWorkerThreads = () => false;
reportingMinify.filter = (name) => /\.css(\?.*)?$/i.test(name);

describe("minifyEmbedded option", () => {
  it("minifies CSS a module embeds in a JavaScript string literal", async () => {
    const compiler = getCompiler({
      entry: fixture("entry-css.js"),
      target: "node",
      experiments: { css: true },
      module: {
        rules: [
          { test: /\.css$/, type: "css/auto", parser: { exportType: "text" } },
        ],
      },
    });

    defaultPlugin().apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toEqual([]);
    expect(exported(compiler, stats)).toBe(".a{color:red;margin:10px}");
  });

  it("minifies HTML a module embeds in a JavaScript string literal", async () => {
    const compiler = getCompiler({
      entry: fixture("entry-html.js"),
      target: "node",
      experiments: { html: true },
    });

    defaultPlugin({
      minimizerOptions: [{}, {}, { collapseWhitespace: "all" }],
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toEqual([]);
    expect(exported(compiler, stats)).toBe("<div><p>hello</div>");
  });

  it("minifies the text an `asset/source` module embeds", async () => {
    const compiler = getCompiler({
      entry: fixture("entry-asset-source.js"),
      target: "node",
      module: {
        rules: [{ test: /\.(?:svg|txt)$/, type: "asset/source" }],
      },
    });

    // Nothing here claims `.svg`, so the plugin's own dispatch is what a
    // language no minimizer names has to fall through.
    defaultPlugin({
      test: /\.(?:[cm]?js|css|html|svg)(\?.*)?$/i,
      minify: [MinimizerPlugin.terserMinify, cssMinify, htmlMinify, svgMinify],
      minimizerOptions: [{}, {}, {}, {}],
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toEqual([]);
    expect(exported(compiler, stats)).toEqual({
      icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"> <rect width="10" height="10" /> </svg>',
      // `.txt` names no language webpack knows, so it is never offered.
      note: "   plain   text   names   no   language   \n",
    });
  });

  it("minifies the JavaScript an `asset/source` module embeds", async () => {
    const compiler = getCompiler({
      entry: fixture("entry-asset-source-js.js"),
      target: "node",
      module: {
        rules: [{ resourceQuery: /raw/, type: "asset/source" }],
      },
    });

    defaultPlugin().apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toEqual([]);
    // terser's, reached by the file's own name — the plugin's default `test`
    // already claims it.
    expect(exported(compiler, stats)).toBe(
      // eslint-disable-next-line no-template-curly-in-string
      'function greet(e){return`hello, ${e}`}greet("world");',
    );
  });

  it("minifies the payload an `asset/inline` module encodes", async () => {
    const compiler = getCompiler({
      entry: fixture("entry-asset-inline.js"),
      target: "node",
      module: { rules: [{ test: /\.svg$/, type: "asset/inline" }] },
    });

    // One minify function and one options object, the shape a plugin holding a
    // single minimizer is configured with.
    defaultPlugin({
      test: /\.svg(\?.*)?$/i,
      minify: svgMinify,
      minimizerOptions: {},
    }).apply(compiler);

    const stats = await compile(compiler);
    const url = exported(compiler, stats);

    expect(getErrors(stats)).toEqual([]);
    // Encoded after it was minified, so what came back is what is encoded.
    expect(
      Buffer.from(url.slice(url.indexOf(",") + 1), "base64").toString("utf8"),
    ).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"> <rect width="10" height="10" /> </svg>',
    );
  });

  it("leaves embedded source alone when no minimizer claims its language", async () => {
    const compiler = getCompiler({
      entry: fixture("entry-asset-source.js"),
      target: "node",
      module: { rules: [{ test: /\.(?:svg|txt)$/, type: "asset/source" }] },
    });

    defaultPlugin().apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toEqual([]);
    expect(exported(compiler, stats).icon).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg"   viewBox="0 0 10 10">\n\t<rect  width="10"   height="10"  />\n</svg>\n',
    );
  });

  it("leaves embedded source alone when `minifyEmbedded` is false", async () => {
    const compiler = getCompiler({
      entry: fixture("entry-css.js"),
      target: "node",
      experiments: { css: true },
      module: {
        rules: [
          { test: /\.css$/, type: "css/auto", parser: { exportType: "text" } },
        ],
      },
    });

    defaultPlugin({ minifyEmbedded: false }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toEqual([]);
    expect(exported(compiler, stats)).toMatch(/\.empty \{/);
  });

  it("dispatches by the language a minimizer declares, not by `test`", async () => {
    const compiler = getCompiler({
      entry: fixture("entry-css.js"),
      target: "node",
      experiments: { css: true },
      module: {
        rules: [
          { test: /\.css$/, type: "css/auto", parser: { exportType: "text" } },
        ],
      },
    });

    // A JavaScript minimizer only. `test` still says `.css`, but no configured
    // minimizer claims that language, so the stylesheet is left as written.
    defaultPlugin({
      minify: [MinimizerPlugin.terserMinify],
      minimizerOptions: [{}],
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toEqual([]);
    expect(exported(compiler, stats)).toMatch(/\.empty \{/);
  });

  it("reports what a minimizer threw over embedded source", async () => {
    const compiler = getCompiler({
      entry: fixture("entry-css.js"),
      target: "node",
      bail: false,
      experiments: { css: true },
      module: {
        rules: [
          { test: /\.css$/, type: "css/auto", parser: { exportType: "text" } },
        ],
      },
    });

    defaultPlugin({ minify: [brokenMinify], minimizerOptions: [{}] }).apply(
      compiler,
    );

    const stats = await compile(compiler);

    // Reported rather than thrown, and the source is embedded as it was
    // written — a build does not die because something nested did not parse.
    expect(getErrors(stats)).toHaveLength(1);
    expect(getErrors(stats)[0]).toMatch(/Terser plugin\nbroken/);
  });

  it("reports what a minimizer returned over embedded source", async () => {
    const compiler = getCompiler({
      entry: fixture("entry-css.js"),
      target: "node",
      bail: false,
      experiments: { css: true },
      module: {
        rules: [
          { test: /\.css$/, type: "css/auto", parser: { exportType: "text" } },
        ],
      },
    });

    defaultPlugin({ minify: [reportingMinify], minimizerOptions: [{}] }).apply(
      compiler,
    );

    const stats = await compile(compiler);

    expect(getErrors(stats)).toHaveLength(1);
    expect(getErrors(stats)[0]).toMatch(/Terser plugin\ncannot read this/);
    expect(getWarnings(stats)).toHaveLength(1);
    expect(getWarnings(stats)[0]).toMatch(/Warning: odd, that/);
  });

  it("does not answer an embedded source from a cache another option filled", async () => {
    const cacheDirectory = path.resolve(
      __dirname,
      "helpers/dist/embedded-cache",
    );

    // `del` rather than `fs.rmSync`, which needs a newer Node than this
    // plugin supports.
    await del(cacheDirectory);

    /**
     * @param {object} minimizerOptions options for the CSS minimizer
     * @returns {Promise<string>} the stylesheet as it was embedded
     */
    const buildWith = async (minimizerOptions) => {
      const compiler = getCompiler({
        entry: fixture("entry-length.js"),
        target: "node",
        cache: { type: "filesystem", cacheDirectory },
        experiments: { css: true },
        module: {
          rules: [
            {
              test: /\.css$/,
              type: "css/auto",
              parser: { exportType: "text" },
            },
          ],
        },
      });

      defaultPlugin({ minimizerOptions: [{}, minimizerOptions, {}] }).apply(
        compiler,
      );

      const stats = await compile(compiler);

      expect(getErrors(stats)).toEqual([]);

      const embedded = exported(compiler, stats);

      // The pack is written on close, so the next build sees this one.
      await new Promise((resolve) => {
        compiler.close(() => resolve());
      });

      return embedded;
    };

    // `16px` -> `1pc` is what the option does, so the two builds must differ.
    expect(await buildWith({})).toBe(".a{margin:16px}");
    expect(await buildWith({ convertLengthUnits: true })).toBe(
      ".a{margin:1pc}",
    );
    expect(await buildWith({})).toBe(".a{margin:16px}");

    await del(cacheDirectory);
  });

  it("keeps the map a source carried into what it is embedded as", async () => {
    const compiler = getCompiler({
      entry: fixture("entry-mapped.js"),
      target: "node",
      devtool: "source-map",
      experiments: { css: true },
      module: {
        rules: [
          { test: /\.css$/, type: "css/auto", parser: { exportType: "text" } },
        ],
      },
    });

    defaultPlugin().apply(compiler);

    const stats = await compile(compiler);
    // Read rather than run: the bundle's own `sourceMappingURL` comment is the
    // last line, which `execute` would wrap its assignment into.
    const bundle = readAsset("main.js", compiler, stats);

    expect(getErrors(stats)).toEqual([]);
    expect(bundle).toContain(".a{color:red}.b{margin:10px}");

    // The generator inlines the map the minimizer composed, so it has to point
    // at the stylesheet rather than at the minified text.
    const inlined = bundle.match(
      /sourceMappingURL=data:application\/json;charset=utf-8;base64,([\d+/=A-Za-z]+)/,
    );

    expect(inlined).not.toBeNull();

    const map = JSON.parse(
      Buffer.from(
        /** @type {RegExpMatchArray} */ (inlined)[1],
        "base64",
      ).toString("utf8"),
    );

    expect(map.sources).toHaveLength(1);
    expect(map.sources[0]).toMatch(/mapped\.css$/);
    expect(map.sourcesContent[0]).toContain("#ff0000");

    // Both rules land on the line they were written on: `.b` is at column 13
    // of the one minified line, and on line 5 of the stylesheet.
    const trace = new TraceMap(map);

    expect(originalPositionFor(trace, { line: 1, column: 0 })).toMatchObject({
      line: 1,
      column: 0,
    });
    expect(originalPositionFor(trace, { line: 1, column: 13 })).toMatchObject({
      line: 5,
      column: 0,
    });
  });

  describe("what a document or a stylesheet nests inside itself", () => {
    for (const parallel of [false, true]) {
      it(`reaches it in an asset, parallel: ${parallel}`, async () => {
        const compiler = getCompiler({
          entry: fixture("entry-assets.js"),
          target: "node",
          output: {
            path: path.resolve(__dirname, "helpers/dist"),
            filename: "[name].js",
            assetModuleFilename: "[name][ext]",
          },
          module: {
            rules: [{ test: /\.(?:html|css)$/, type: "asset/resource" }],
          },
        });

        defaultPlugin({ parallel }).apply(compiler);

        const stats = await compile(compiler);

        expect(getErrors(stats)).toEqual([]);
        // The inline `<script>` is terser's, which nothing but this reaches;
        // the `<style>` and the JSON `<script>` are the built-in minifiers'.
        expect(readAsset("document.html", compiler, stats)).toBe(
          '<!doctype html><html lang=en><head><title>x</title><style>.b{color:#0f0}</style><script>var a=1;function f(){return a}</script><script type=application/json>{"a":1}</script></head><body><p>hi</p>\n</body></html>',
        );
      });
    }

    it("falls back to the built-in minifiers when nothing claims a body", async () => {
      const compiler = getCompiler({
        entry: fixture("entry-assets.js"),
        target: "node",
        output: {
          path: path.resolve(__dirname, "helpers/dist"),
          filename: "[name].js",
          assetModuleFilename: "[name][ext]",
        },
        module: {
          rules: [{ test: /\.(?:html|css)$/, type: "asset/resource" }],
        },
      });

      // HTML alone: the inline `<script>` reaches no minimizer, and the
      // `<style>` and JSON bodies still reach webpack's own.
      defaultPlugin({
        test: /\.html(\?.*)?$/i,
        minify: [htmlMinify],
        minimizerOptions: [{}],
      }).apply(compiler);

      const stats = await compile(compiler);

      expect(getErrors(stats)).toEqual([]);
      expect(readAsset("document.html", compiler, stats)).toBe(
        '<!doctype html><html lang=en><head><title>x</title><style>.b{color:#0f0}</style><script>  var  a  =  1 ;  function  f ( ) { return  a }  </script><script type=application/json>{"a":1}</script></head><body><p>hi</p>\n</body></html>',
      );
    });

    it("reaches a `data:` payload a stylesheet holds", async () => {
      const compiler = getCompiler({
        entry: fixture("entry-assets.js"),
        target: "node",
        output: {
          path: path.resolve(__dirname, "helpers/dist"),
          filename: "[name].js",
          assetModuleFilename: "[name][ext]",
        },
        module: {
          rules: [{ test: /\.(?:html|css)$/, type: "asset/resource" }],
        },
      });

      defaultPlugin({
        test: /\.(?:css|svg)(\?.*)?$/i,
        minify: [cssMinify, svgMinify],
        minimizerOptions: [{}, {}],
      }).apply(compiler);

      const stats = await compile(compiler);

      expect(getErrors(stats)).toEqual([]);
      expect(readAsset("sheet.css", compiler, stats)).toBe(
        ".a{background:url(\"data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'> <rect /> </svg>\");color:red}",
      );
    });

    it("keeps a nested body its minimizer reported an error over", async () => {
      const compiler = getCompiler({
        entry: fixture("entry-assets.js"),
        target: "node",
        output: {
          path: path.resolve(__dirname, "helpers/dist"),
          filename: "[name].js",
          assetModuleFilename: "[name][ext]",
        },
        module: {
          rules: [{ test: /\.(?:html|css)$/, type: "asset/resource" }],
        },
      });

      defaultPlugin({
        test: /\.(?:[cm]?js|html)(\?.*)?$/i,
        // The bundle itself is left out, so the only failure reported is the
        // one the nested body produced.
        exclude: /main\.js$/,
        minify: [failingMinify, htmlMinify],
        minimizerOptions: [{}, {}],
      }).apply(compiler);

      const stats = await compile(compiler);

      // The failure belongs to the asset the body came from, and the body is
      // written exactly as it was. Read off the compilation rather than the
      // output: an errored build emits nothing.
      expect(getErrors(stats)).toHaveLength(1);
      expect(getErrors(stats)[0]).toMatch(/Terser plugin\ncannot read this/);
      expect(
        stats.compilation.getAsset("document.html").source.source(),
      ).toContain(
        "<script>  var  a  =  1 ;  function  f ( ) { return  a }  </script>",
      );
    });

    it("is not asked to collect what nothing here can minify", async () => {
      const compiler = getCompiler({
        entry: fixture("entry-assets.js"),
        target: "node",
        output: {
          path: path.resolve(__dirname, "helpers/dist"),
          filename: "[name].js",
          assetModuleFilename: "[name][ext]",
        },
        module: {
          rules: [{ test: /\.(?:html|css)$/, type: "asset/resource" }],
        },
      });

      defaultPlugin({
        test: /\.html(\?.*)?$/i,
        minify: [strangeLanguageMinify],
        minimizerOptions: [{}],
      }).apply(compiler);

      const stats = await compile(compiler);

      expect(getErrors(stats)).toEqual([]);
      // One plain minification: it was never handed `collectEmbeddedSource`.
      expect(collectedBy).toEqual([false]);
      expect(readAsset("document.html", compiler, stats)).toContain(
        "<style>  .b { color : #00ff00 }  </style>",
      );
    });

    it("leaves a payload alone when nothing claims its language", async () => {
      const compiler = getCompiler({
        entry: fixture("entry-assets.js"),
        target: "node",
        output: {
          path: path.resolve(__dirname, "helpers/dist"),
          filename: "[name].js",
          assetModuleFilename: "[name][ext]",
        },
        module: {
          rules: [{ test: /\.(?:html|css)$/, type: "asset/resource" }],
        },
      });

      defaultPlugin({
        test: /\.css(\?.*)?$/i,
        minify: [cssMinify],
        minimizerOptions: [{}],
      }).apply(compiler);

      const stats = await compile(compiler);

      expect(getErrors(stats)).toEqual([]);
      expect(readAsset("sheet.css", compiler, stats)).toBe(
        ".a{background:url(\"data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'>   <rect  />   </svg>\");color:red}",
      );
    });
  });
});
