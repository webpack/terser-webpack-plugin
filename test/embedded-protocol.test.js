import path from "path";

import MinimizerPlugin from "../src";
import { asFunction, functionBody } from "../src/utils";

import {
  compile,
  getCompiler,
  getErrors,
  getWarnings,
  readAsset,
} from "./helpers";

// The `renderEmbeddedSource` dispatch on its own: a minimizer hands out what it
// nests, each body goes to whichever minimizer claims its language, and the
// answer comes back for the same print. Driven by
// minify functions written here rather than webpack's, so it holds on every
// webpack the plugin supports — including ones with no embedded-source hook.

// A renderer may answer with the text alone or with a whole result — what it
// minified plus anything it has to report. webpack's own minifiers unwrap it
// this way, so these stand-ins do too.
const answerText = (answer) =>
  answer === undefined || typeof answer === "string" ? answer : answer.code;

// Anything the renderer throws is reported rather than dropped, and the body is
// spelled as an untapped run spells it — which is what webpack's minifiers do.
const askRenderer = async (render, source, type, as) => {
  try {
    return await render(source, as === undefined ? { type } : { type, as });
  } catch (error) {
    return { errors: [error] };
  }
};

// And what it reported travels back with the asset that embeds the body: there
// is no asset of its own for it to be reported against.
const answerDiagnostics = (answers) => {
  const warnings = [];
  const errors = [];

  for (const answer of answers) {
    if (answer === undefined || typeof answer === "string") continue;
    if (answer.warnings) warnings.push(...answer.warnings);
    if (answer.errors) errors.push(...answer.errors);
  }

  const out = {};

  if (warnings.length !== 0) out.warnings = warnings;
  if (errors.length !== 0) out.errors = errors;

  return out;
};

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
    bodies.map(({ source, type }) =>
      askRenderer(renderEmbeddedSource, source, type),
    ),
  );
  const answers = new Map();

  for (let i = 0; i < bodies.length; i++) {
    const text = answerText(rendered[i]);

    if (typeof text === "string") {
      answers.set(bodies[i].source, text);
    }
  }

  return {
    code: code.replace(bodyRe(), (whole, tag, body) =>
      answers.has(body) ? `<${tag}>${answers.get(body)}</${tag}>` : whole,
    ),
    ...answerDiagnostics(rendered),
  };
}

pageMinify.getTypes = () => ["page"];
pageMinify.getEmbeddedTypes = () => ["css", "javascript"];
pageMinify.supportsWorker = () => false;
pageMinify.supportsWorkerThreads = () => false;
pageMinify.filter = (name) => /\.page$/i.test(name);

/** @type {EXPECTED_ANY[]} */
let handed;

/**
 * @param {{ [file: string]: string }} input a single `{ filename: code }` entry
 * @param {undefined} sourceMap unused
 * @param {EXPECTED_ANY} minimizerOptions the options it was handed
 * @returns {{ code: string }} the body, minified
 */
function recordingCssMinify(input, sourceMap, minimizerOptions) {
  const { renderEmbeddedSource, ...rest } = minimizerOptions || {};

  handed.push(["css", rest]);

  return { code: Object.values(input)[0].replace(/\s+/g, "") };
}

recordingCssMinify.getTypes = () => ["css"];
recordingCssMinify.supportsWorker = () => false;
recordingCssMinify.supportsWorkerThreads = () => false;
recordingCssMinify.filter = () => false;

/**
 * @param {{ [file: string]: string }} input a single `{ filename: code }` entry
 * @param {undefined} sourceMap unused
 * @param {EXPECTED_ANY} minimizerOptions the options it was handed
 * @returns {{ code: string }} the body, minified
 */
function recordingJsMinify(input, sourceMap, minimizerOptions) {
  const { renderEmbeddedSource, ...rest } = minimizerOptions || {};

  handed.push(["javascript", rest]);

  return { code: Object.values(input)[0].replace(/\s+/g, " ").trim() };
}

recordingJsMinify.getTypes = () => ["javascript"];
recordingJsMinify.supportsWorker = () => false;
recordingJsMinify.supportsWorkerThreads = () => false;
recordingJsMinify.filter = () => false;

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
 * @param {{ [file: string]: string }} input a single `{ filename: code }` entry
 * @returns {{ code: string, warnings: string[] }} the body, with something to say about it
 */
function noisyJsMinify(input) {
  const [[, code]] = Object.entries(input);

  return { code: code.trim(), warnings: ["watch out"] };
}

noisyJsMinify.getTypes = () => ["javascript"];
noisyJsMinify.supportsWorker = () => false;
noisyJsMinify.supportsWorkerThreads = () => false;
noisyJsMinify.filter = () => false;

/**
 * @returns {never} never returns
 */
function throwingJsMinify() {
  throw new Error("blew up");
}

throwingJsMinify.getTypes = () => ["javascript"];
throwingJsMinify.supportsWorker = () => false;
throwingJsMinify.supportsWorkerThreads = () => false;
throwingJsMinify.filter = () => false;

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
 * A module script: `await` at the top level is a syntax error in a classic one,
 * so which production a body is written in decides whether it can be read.
 */
const MODULE_BODY = "window.ran = true;\nawait Promise.resolve();\n";

/**
 * A document minifier handing out one inline `<script type=module>`: the
 * language is JavaScript, and `as` names which of its two productions the body
 * is written in.
 * @param {{ [file: string]: string }} input a single `{ filename: code }` entry
 * @param {undefined} sourceMap unused
 * @param {{ as?: string, renderEmbeddedSource: (source: string, info: { type: string, as?: string }) => Promise<EXPECTED_ANY> }} minimizerOptions minimizer options
 * @returns {Promise<EXPECTED_ANY>} the body as its minimizer wrote it
 */
async function moduleScriptMinify(input, sourceMap, minimizerOptions) {
  const rendered = await askRenderer(
    minimizerOptions.renderEmbeddedSource,
    MODULE_BODY,
    "javascript",
    minimizerOptions.as,
  );
  const text = answerText(rendered);

  return {
    code: typeof text === "string" ? text : MODULE_BODY,
    ...answerDiagnostics([rendered]),
  };
}

/**
 * An event handler attribute's value: a function body, where the `return`
 * cancelling an event lives. No JavaScript engine parses one on its own.
 */
const HANDLER_BODY = "  return  false  ";

/**
 * A document minifier handing out one `onsubmit=""`: JavaScript again, with
 * `as` naming the production its value is written in.
 * @param {{ [file: string]: string }} input a single `{ filename: code }` entry
 * @param {undefined} sourceMap unused
 * @param {{ renderEmbeddedSource: (source: string, info: { type: string, as?: string }) => Promise<EXPECTED_ANY> }} minimizerOptions minimizer options
 * @returns {Promise<EXPECTED_ANY>} the body as its minimizer wrote it
 */
async function eventHandlerMinify(input, sourceMap, minimizerOptions) {
  const rendered = await askRenderer(
    minimizerOptions.renderEmbeddedSource,
    HANDLER_BODY,
    "javascript",
    "event-handler",
  );
  const text = answerText(rendered);

  return {
    code: typeof text === "string" ? text : HANDLER_BODY,
    ...answerDiagnostics([rendered]),
  };
}

/**
 * A classic script: `with` is a syntax error in a module and in strict mode,
 * so a body holding one says which production it was read as.
 */
const CLASSIC_BODY =
  "var  o  =  { a : 1 } ;  with ( o ) { window.ran  =  a }\n";

/**
 * A document minifier handing out one bare `<script>`, the classic production.
 * @param {{ [file: string]: string }} input a single `{ filename: code }` entry
 * @param {undefined} sourceMap unused
 * @param {{ renderEmbeddedSource: (source: string, info: { type: string, as?: string }) => Promise<EXPECTED_ANY> }} minimizerOptions minimizer options
 * @returns {Promise<EXPECTED_ANY>} the body as its minimizer wrote it
 */
async function classicScriptMinify(input, sourceMap, minimizerOptions) {
  const rendered = await askRenderer(
    minimizerOptions.renderEmbeddedSource,
    CLASSIC_BODY,
    "javascript",
    "script",
  );
  const text = answerText(rendered);

  return {
    code: typeof text === "string" ? text : CLASSIC_BODY,
    ...answerDiagnostics([rendered]),
  };
}

classicScriptMinify.getTypes = () => ["page"];
classicScriptMinify.getEmbeddedTypes = () => ["javascript"];
classicScriptMinify.supportsWorker = () => false;
classicScriptMinify.supportsWorkerThreads = () => false;
classicScriptMinify.filter = (name) => /\.page$/i.test(name);

eventHandlerMinify.getTypes = () => ["page"];
eventHandlerMinify.getEmbeddedTypes = () => ["javascript"];
eventHandlerMinify.supportsWorker = () => false;
eventHandlerMinify.supportsWorkerThreads = () => false;
eventHandlerMinify.filter = (name) => /\.page$/i.test(name);

moduleScriptMinify.getTypes = () => ["page"];
moduleScriptMinify.getEmbeddedTypes = () => ["javascript"];
moduleScriptMinify.supportsWorker = () => false;
moduleScriptMinify.supportsWorkerThreads = () => false;
moduleScriptMinify.filter = (name) => /\.page$/i.test(name);

/**
 * @param {EXPECTED_ANY[]} minify minify functions
 * @param {EXPECTED_ANY[]=} minimizerOptions one options object per minify function
 * @returns {import("webpack").Compiler} compiler with the document emitted as an asset
 */
const getPageCompiler = (minify, minimizerOptions) => {
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
    minimizerOptions: minimizerOptions || minify.map(() => ({})),
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

  it("hands each nested minimizer its own options, and the target's ecma", async () => {
    handed = [];

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
      minify: [pageMinify, recordingCssMinify, recordingJsMinify],
      minimizerOptions: [
        {},
        { cssLevel: 2, dropComments: true },
        { jsPasses: 3 },
      ],
      parallel: false,
    }).apply(compiler);

    const stats = await compile(compiler);

    expect(getErrors(stats)).toEqual([]);
    // Each is handed what was configured for it — without that there is no way
    // to minify a nested body harder, or to turn one of its transforms off.
    expect(handed).toEqual([
      ["css", { cssLevel: 2, dropComments: true, ecma: expect.any(Number) }],
      ["javascript", { jsPasses: 3, ecma: expect.any(Number) }],
    ]);
    // What the target can read is the target's, so it reaches the body too.
    expect(handed[0][1].ecma).toBe(handed[1][1].ecma);
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

  it("reports what a nested minimizer had to say about a body", async () => {
    const compiler = getPageCompiler([pageMinify, noisyJsMinify]);
    const stats = await compile(compiler);

    expect(getErrors(stats)).toEqual([]);
    expect(getWarnings(stats)).toHaveLength(1);
    expect(getWarnings(stats)[0]).toMatch(/watch out/);
    // A warning is not a failure: the body is still written back minified.
    expect(readAsset("host.page", compiler, stats)).toContain(
      "<script>var  a  =  1</script>",
    );
  });

  it("reports a nested minimizer that threw, and keeps the body", async () => {
    const compiler = getPageCompiler([pageMinify, throwingJsMinify]);
    const stats = await compile(compiler);

    expect(getErrors(stats)).toHaveLength(1);
    expect(getErrors(stats)[0]).toMatch(/blew up/);
    // Read off the compilation rather than the output: an errored build emits
    // nothing, but the body it threw over is still spelled as it was written.
    expect(stats.compilation.getAsset("host.page").source.source()).toContain(
      "<script>  var  a  =  1  </script>",
    );
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
    bodies.map((source) => askRenderer(renderEmbeddedSource, source, "css")),
  );
  const answers = new Map();

  for (let i = 0; i < bodies.length; i++) {
    const text = answerText(rendered[i]);

    if (typeof text === "string") answers.set(bodies[i], text);
  }

  return {
    code: collapse(
      code.replace(nestedRe(), (whole, body) =>
        answers.has(body) ? `<<${answers.get(body)}>>` : whole,
      ),
    ),
    ...answerDiagnostics(rendered),
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

describe("which production of JavaScript a body is written in", () => {
  it.each([
    [
      "terserMinify",
      MinimizerPlugin.terserMinify,
      "window.ran=!0,await Promise.resolve();",
    ],
    [
      "uglifyJsMinify",
      MinimizerPlugin.uglifyJsMinify,
      "window.ran=!0,await Promise.resolve();",
    ],
    [
      "swcMinify",
      MinimizerPlugin.swcMinify,
      "window.ran=!0,await Promise.resolve();",
    ],
    [
      "esbuildMinify",
      MinimizerPlugin.esbuildMinify,
      "window.ran=!0,await Promise.resolve();\n",
    ],
  ])(
    "reads a body handed out as a module with `%s`",
    async (name, minifier, expected) => {
      const compiler = getPageCompiler(
        [moduleScriptMinify, minifier],
        [{ as: "module" }, {}],
      );
      const stats = await compile(compiler);

      expect(getErrors(stats)).toEqual([]);
      expect(getWarnings(stats)).toEqual([]);
      expect(readAsset("host.page", compiler, stats)).toBe(expected);
    },
  );

  it("reads one as a classic script when that is what it is handed out as", async () => {
    const compiler = getPageCompiler(
      [moduleScriptMinify, MinimizerPlugin.terserMinify],
      [{ as: "script" }, {}],
    );
    const stats = await compile(compiler);

    // The word itself never reaches the engine, which would answer
    // "`as` is not a supported option" rather than reading the source at all.
    expect(getErrors(stats)).toHaveLength(1);
    expect(getErrors(stats)[0]).toMatch(/Unexpected token: name \(Promise\)/);
    expect(stats.compilation.getAsset("host.page").source.source()).toBe(
      MODULE_BODY,
    );
  });

  it("leaves the production to the minimizer when none is named", async () => {
    const compiler = getPageCompiler([
      moduleScriptMinify,
      MinimizerPlugin.terserMinify,
    ]);
    const stats = await compile(compiler);

    // Nothing says which production this is, so it is read as the classic
    // script `terser` defaults to — which is what an inline script is.
    expect(getErrors(stats)).toHaveLength(1);
    expect(getErrors(stats)[0]).toMatch(/Unexpected token: name \(Promise\)/);
  });
});

describe("a body handed out as an event handler", () => {
  it.each([
    ["terserMinify", MinimizerPlugin.terserMinify],
    ["uglifyJsMinify", MinimizerPlugin.uglifyJsMinify],
    ["swcMinify", MinimizerPlugin.swcMinify],
    ["esbuildMinify", MinimizerPlugin.esbuildMinify],
  ])(
    "is minified as the function it belongs to by `%s`",
    async (name, minifier) => {
      const compiler = getPageCompiler([eventHandlerMinify, minifier]);
      const stats = await compile(compiler);

      // A `return` at the top level is a syntax error in either script
      // production, so reaching one at all is the wrap; what comes back is the
      // body rather than the function around it.
      expect(getErrors(stats)).toEqual([]);
      expect(readAsset("host.page", compiler, stats)).toBe("return!1");
    },
  );
});

describe("a body handed out as a classic script", () => {
  it.each([
    ["terserMinify", MinimizerPlugin.terserMinify],
    ["uglifyJsMinify", MinimizerPlugin.uglifyJsMinify],
    ["swcMinify", MinimizerPlugin.swcMinify],
    ["esbuildMinify", MinimizerPlugin.esbuildMinify],
  ])("is read as one by `%s`", async (name, minifier) => {
    const compiler = getPageCompiler([classicScriptMinify, minifier]);
    const stats = await compile(compiler);

    expect(getErrors(stats)).toEqual([]);
    expect(readAsset("host.page", compiler, stats)).toMatchSnapshot();
  });
});

describe("the function an event handler body is minified inside", () => {
  it("makes the body a whole script an engine can read", () => {
    expect(asFunction("return  false")).toBe("function _(){return  false\n}");
  });

  it("names the function past any run of `_` the body holds", () => {
    // A body naming the same binding would resolve to the function around it
    // rather than to what it meant.
    expect(asFunction("_( __ )")).toBe("function ___(){_( __ )\n}");
    expect(asFunction("f(_____)")).toBe("function ______(){f(_____)\n}");
  });

  it("ends a line comment the body closes with", () => {
    // Without the newline the brace closing the function would be inside the
    // comment, and nothing could parse what it was handed.
    expect(asFunction("f( 1 ) // done")).toBe("function _(){f( 1 ) // done\n}");
  });

  it("reads the body back out of what a minimizer answered", () => {
    expect(functionBody("function _(){f(1)}")).toBe("f(1)");
    expect(functionBody("function ___ ( ) { f(1) }")).toBe("f(1)");
    // `esbuild` writes the newline, and a declaration may be printed with the
    // semicolon that never belonged to the body.
    expect(functionBody("function _(){return!1}\n")).toBe("return!1");
    expect(functionBody("function _(){return!1};")).toBe("return!1");
  });

  it("declines an answer that is not that one function", () => {
    // Text around it, a second statement, and the empty answer a minimizer
    // dropping an unused declaration gives.
    expect(functionBody("f(1)")).toBeUndefined();
    expect(functionBody("function _(){f(1)}g()")).toBeUndefined();
    expect(functionBody("g();function _(){f(1)}")).toBeUndefined();
    expect(functionBody("")).toBeUndefined();
    expect(functionBody("function (){f(1)}")).toBeUndefined();
    expect(functionBody("function _(a){f(a)}")).toBeUndefined();
    expect(functionBody(undefined)).toBeUndefined();
  });
});
