/** @typedef {import("./index.js").ExtractCommentsOptions} ExtractCommentsOptions */
/** @typedef {import("./index.js").ExtractCommentsFunction} ExtractCommentsFunction */
/** @typedef {import("./index.js").ExtractCommentsCondition} ExtractCommentsCondition */
/** @typedef {import("./index.js").Input} Input */
/** @typedef {import("./index.js").MinimizedResult} MinimizedResult */
/** @typedef {import("./index.js").CustomOptions} CustomOptions */
/** @typedef {import("./index.js").RawSourceMap} RawSourceMap */
/** @typedef {import("./index.js").EXPECTED_OBJECT} EXPECTED_OBJECT */
/** @typedef {import("./index.js").EXPECTED_ANY} EXPECTED_ANY */

/**
 * @typedef {string[]} ExtractedComments
 */

const path = require("path");

/**
 * Which production of a language an embedded body is written in, as `as` names
 * it. A `style=""` is `css` with `as: "block-contents"`; JavaScript's are these
 * three, and only the last is one no engine here parses on its own.
 */
const CLASSIC_SCRIPT = "script";
const MODULE_SCRIPT = "module";
const EVENT_HANDLER = "event-handler";

/**
 * The function a body handed out as an event handler belongs to. Named past any
 * run of `_` the body holds, so nothing in it resolves to the function instead
 * of what it meant; the newline ends a line comment the body may close with.
 * @param {string} body the handler's text
 * @returns {string} the script it is the body of
 */
function asFunction(body) {
  const runs = body.match(/_+/g);
  const longest = runs
    ? runs.reduce((widest, run) => Math.max(widest, run.length), 0)
    : 0;

  return `function ${"_".repeat(longest + 1)}(){${body}\n}`;
}

/**
 * The handler body inside the function a minimizer answered with. `undefined`
 * for an answer that is not that function — one holding anything else, or one
 * that dropped it whole as the unused declaration it is.
 * @param {string | undefined} answered what the minimizer answered
 * @returns {string | undefined} the body, or undefined
 */
function functionBody(answered) {
  if (typeof answered !== "string") return undefined;

  // Trimmed first: an engine may end what it writes with a newline, and a
  // trailing `;` is the declaration's own rather than the body's.
  const written = answered.trim().replace(/;$/, "");
  const opened = written.indexOf("{");

  return opened !== -1 &&
    written.endsWith("}") &&
    /^function\s+[^\s(]+\s*\(\s*\)\s*$/.test(written.slice(0, opened))
    ? written.slice(opened + 1, -1).trim()
    : undefined;
}

/**
 * The version a package reports. Read by walking up from its resolved entry
 * point rather than by requiring `<name>/package.json`, which a package whose
 * `exports` does not list that path — `sharp`, `svgo` and `imagemin` among them
 * — makes throw. The version is part of the cache key, so failing to read one
 * means an upgrade of that package does not invalidate what it minified.
 * @param {string} name package name
 * @returns {string | undefined} its version, or undefined when it is not installed
 */
function packageVersion(name) {
  let directory;

  try {
    // Resolved to an absolute path so the walk below cannot turn a directory
    // into a bare specifier, which is what a core module's name resolves to.
    directory = path.dirname(path.resolve(require.resolve(name)));
  } catch (_err) {
    return undefined;
  }

  // `require.resolve` can land several directories deep inside the package.
  for (;;) {
    let packageJson;

    try {
      packageJson = require(path.join(directory, "package.json"));
    } catch (_err) {
      // Not this directory; keep walking.
    }

    if (packageJson && packageJson.name === name) {
      return packageJson.version;
    }

    const parent = path.dirname(directory);

    if (parent === directory) {
      return undefined;
    }

    directory = parent;
  }
}

/**
 * The options entry belonging to one minimizer: an array is parallel to the
 * implementations, a single object is shared by all of them.
 * @param {EXPECTED_ANY} minimizerOptions the options as configured
 * @param {number} index index into the implementations
 * @returns {EXPECTED_OBJECT} its options
 */
function getMinimizerOptionsAt(minimizerOptions, index) {
  return Array.isArray(minimizerOptions)
    ? minimizerOptions[index] || {}
    : minimizerOptions;
}

const JS_FILE_RE = /\.[cm]?js(\?.*)?$/i;
const JSON_FILE_RE = /\.json(\?.*)?$/i;
const HTML_FILE_RE = /\.html?(\?.*)?$/i;
const CSS_FILE_RE = /\.css(\?.*)?$/i;
const SVG_FILE_RE = /\.svg(\?.*)?$/i;
// What `imageminMinify` is offered; its plugins decide what they act on.
const IMAGE_FILE_RE = /\.(?:avif|gif|jpe?g|jxl|png|svg|tiff?|webp)(\?.*)?$/i;

/** @type {undefined | ((specifier: string) => Promise<EXPECTED_ANY>)} */
let dynamicImport;

/**
 * `imagemin` and its plugins are ESM-only, so they are reached through
 * `import()` — built here rather than written inline so the CommonJS build does
 * not compile it to a `require` that cannot load them, and so this file still
 * parses on the Node versions that predate it. Nothing but `imageminMinify`
 * calls this.
 * @returns {(specifier: string) => Promise<EXPECTED_ANY>} the importer
 */
function getDynamicImport() {
  if (dynamicImport) {
    return dynamicImport;
  }

  // eslint-disable-next-line no-new-func
  const importer = new Function("specifier", "return import(specifier)");

  dynamicImport =
    /** @type {(specifier: string) => Promise<EXPECTED_ANY>} */
    (importer);

  return dynamicImport;
}

/**
 * Map a webpack `output.environment` configuration to the highest
 * ECMAScript version that the target is known to support. Returns `5`
 * when no ES2015+ features are flagged.
 * @param {NonNullable<NonNullable<import("webpack").Configuration["output"]>["environment"]>} environment environment
 * @returns {number} ecma version (5, 2015, 2017 or 2020)
 */
function getEcmaVersion(environment) {
  // ES2020 (11th edition)
  if (
    environment.bigIntLiteral ||
    environment.dynamicImport ||
    environment.dynamicImportInWorker ||
    environment.globalThis ||
    environment.optionalChaining
  ) {
    return 2020;
  }

  // ES2017 (8th edition)
  if (environment.asyncFunction) {
    return 2017;
  }

  // ES2015 (6th edition)
  if (
    environment.arrowFunction ||
    environment.const ||
    environment.destructuring ||
    environment.forOf ||
    environment.methodShorthand ||
    environment.module ||
    environment.templateLiteral
  ) {
    return 2015;
  }

  return 5;
}

const notSettled = Symbol("not-settled");

/**
 * @template T
 * @typedef {() => Promise<T>} Task
 */

/**
 * Run tasks with limited concurrency.
 * @template T
 * @param {number} limit Limit of tasks that run at once.
 * @param {Task<T>[]} tasks List of tasks to run.
 * @returns {Promise<T[]>} A promise that fulfills to an array of the results
 */
function throttleAll(limit, tasks) {
  return new Promise((resolve, reject) => {
    const result = Array.from({ length: tasks.length }).fill(notSettled);
    const entries = tasks.entries();
    const next = () => {
      const { done, value } = entries.next();

      if (done) {
        const isLast = !result.includes(notSettled);

        if (isLast) resolve(result);

        return;
      }

      const [index, task] = value;

      /**
       * @param {T} resultValue Result value
       */
      const onFulfilled = (resultValue) => {
        result[index] = resultValue;
        next();
      };

      task().then(onFulfilled, reject);
    };

    for (let i = 0; i < limit; i++) {
      next();
    }
  });
}

/* istanbul ignore next */
/**
 * @param {Input} input input
 * @param {RawSourceMap=} sourceMap source map
 * @param {CustomOptions=} minimizerOptions options
 * @param {ExtractCommentsOptions=} extractComments extract comments option
 * @returns {Promise<MinimizedResult>} minimized result
 */
async function terserMinify(
  input,
  sourceMap,
  minimizerOptions,
  extractComments,
) {
  // Self-require rather than the bindings above: a minify function reaches a
  // worker as its source, where this module's own scope is gone.
  const { EVENT_HANDLER, MODULE_SCRIPT, asFunction, functionBody } =
    // eslint-disable-next-line import/no-self-import
    require("./utils.js");

  /**
   * @param {unknown} value value
   * @returns {value is EXPECTED_OBJECT} true when value is object or function
   */
  const isObject = (value) => {
    const type = typeof value;

    // eslint-disable-next-line no-eq-null, eqeqeq
    return value != null && (type === "object" || type === "function");
  };

  /**
   * @param {import("terser").MinifyOptions & { sourceMap: import("terser").SourceMapOptions | undefined } & ({ output: import("terser").FormatOptions & { beautify: boolean } } | { format: import("terser").FormatOptions & { beautify: boolean } })} terserOptions terser options
   * @param {ExtractedComments} extractedComments extracted comments
   * @returns {ExtractCommentsFunction} function to extract comments
   */
  const buildComments = (terserOptions, extractedComments) => {
    /** @type {{ [index: string]: ExtractCommentsCondition }} */
    const condition = {};

    let comments;

    if (terserOptions.format) {
      ({ comments } = terserOptions.format);
    } else if (terserOptions.output) {
      ({ comments } = terserOptions.output);
    }

    condition.preserve = typeof comments !== "undefined" ? comments : false;

    if (typeof extractComments === "boolean" && extractComments) {
      condition.extract = "some";
    } else if (
      typeof extractComments === "string" ||
      extractComments instanceof RegExp
    ) {
      condition.extract = extractComments;
    } else if (typeof extractComments === "function") {
      condition.extract = extractComments;
    } else if (extractComments && isObject(extractComments)) {
      condition.extract =
        typeof extractComments.condition === "boolean" &&
        extractComments.condition
          ? "some"
          : typeof extractComments.condition !== "undefined"
            ? extractComments.condition
            : "some";
    } else {
      // No extract
      // Preserve using "commentsOpts" or "some"
      condition.preserve = typeof comments !== "undefined" ? comments : "some";
      condition.extract = false;
    }

    // Ensure that both conditions are functions
    for (const key of ["preserve", "extract"]) {
      /** @type {undefined | string} */
      let regexStr;
      /** @type {undefined | RegExp} */
      let regex;

      switch (typeof condition[key]) {
        case "boolean":
          condition[key] = condition[key] ? () => true : () => false;

          break;
        case "function":
          break;
        case "string":
          if (condition[key] === "all") {
            condition[key] = () => true;

            break;
          }

          if (condition[key] === "some") {
            condition[key] = /** @type {ExtractCommentsFunction} */ (
              (astNode, comment) =>
                (comment.type === "comment2" || comment.type === "comment1") &&
                /@preserve|@lic|@cc_on|^\**!/i.test(comment.value)
            );

            break;
          }

          regexStr = /** @type {string} */ (condition[key]);

          condition[key] = /** @type {ExtractCommentsFunction} */ (
            (astNode, comment) =>
              new RegExp(/** @type {string} */ (regexStr)).test(comment.value)
          );

          break;
        default:
          regex = /** @type {RegExp} */ (condition[key]);

          condition[key] = /** @type {ExtractCommentsFunction} */ (
            (astNode, comment) =>
              /** @type {RegExp} */ (regex).test(comment.value)
          );
      }
    }

    // Redefine the comments function to extract and preserve
    // comments according to the two conditions
    const seenComments = new Set(extractedComments);

    return (astNode, comment) => {
      if (
        /** @type {{ extract: ExtractCommentsFunction }} */
        (condition).extract(astNode, comment)
      ) {
        const commentText =
          comment.type === "comment2"
            ? `/*${comment.value}*/`
            : `//${comment.value}`;

        // Don't include duplicate comments
        if (!seenComments.has(commentText)) {
          seenComments.add(commentText);
          extractedComments.push(commentText);
        }
      }

      return /** @type {{ preserve: ExtractCommentsFunction }} */ (
        condition
      ).preserve(astNode, comment);
    };
  };

  /**
   * @param {(import("terser").MinifyOptions & { as?: string })=} terserOptions terser options
   * @returns {import("terser").MinifyOptions & { sourceMap: import("terser").SourceMapOptions | undefined } & { compress: import("terser").CompressOptions } & ({ output: import("terser").FormatOptions & { beautify: boolean } } | { format: import("terser").FormatOptions & { beautify: boolean } })} built terser options
   */
  const buildTerserOptions = ({ as, ...terserOptions } = {}) =>
    // Need deep copy objects to avoid https://github.com/terser/terser/issues/366
    ({
      ...terserOptions,
      // `as` names which production of JavaScript the source is, and is the
      // source's own rather than the configuration's, so it overrides `module`.
      ...(typeof as === "undefined"
        ? undefined
        : { module: as === MODULE_SCRIPT }),
      compress:
        typeof terserOptions.compress === "boolean"
          ? terserOptions.compress
            ? {}
            : false
          : { ...terserOptions.compress },
      // ecma: terserOptions.ecma,
      // ie8: terserOptions.ie8,
      // keep_classnames: terserOptions.keep_classnames,
      // keep_fnames: terserOptions.keep_fnames,
      mangle:
        // eslint-disable-next-line no-eq-null, eqeqeq
        terserOptions.mangle == null
          ? true
          : typeof terserOptions.mangle === "boolean"
            ? terserOptions.mangle
            : { ...terserOptions.mangle },
      // module: terserOptions.module,
      // nameCache: { ...terserOptions.toplevel },
      // the `output` option is deprecated
      ...(terserOptions.format
        ? { format: { beautify: false, ...terserOptions.format } }
        : { output: { beautify: false, ...terserOptions.output } }),
      parse: { ...terserOptions.parse },
      // safari10: terserOptions.safari10,
      // Ignoring sourceMap from options
      sourceMap: undefined,
      // toplevel: terserOptions.toplevel
    });

  // The production is the body's own, and a function body is the one terser has
  // no goal symbol for: it is minified as the function it belongs to.
  const handler =
    typeof minimizerOptions !== "undefined" &&
    minimizerOptions.as === EVENT_HANDLER;

  let minify;

  try {
    ({ minify } = require("terser"));
  } catch (err) {
    return { errors: [/** @type {Error} */ (err)] };
  }

  // Copy `terser` options
  const terserOptions = buildTerserOptions(minimizerOptions);

  // Let terser generate a SourceMap. The dispatcher in `minify.js`
  // chains the previous step's map onto this one.
  if (sourceMap) {
    terserOptions.sourceMap = { asObject: true };
  }

  /** @type {ExtractedComments} */
  const extractedComments = [];

  if (terserOptions.output) {
    terserOptions.output.comments = buildComments(
      terserOptions,
      extractedComments,
    );
  } else if (terserOptions.format) {
    terserOptions.format.comments = buildComments(
      terserOptions,
      extractedComments,
    );
  }

  if (terserOptions.compress) {
    // More optimizations
    if (typeof terserOptions.compress.ecma === "undefined") {
      terserOptions.compress.ecma = terserOptions.ecma;
    }

    // https://github.com/webpack/webpack/issues/16135
    if (
      terserOptions.ecma === 5 &&
      typeof terserOptions.compress.arrows === "undefined"
    ) {
      terserOptions.compress.arrows = false;
    }
  }

  const [[filename, source]] = Object.entries(input);
  const text = Buffer.isBuffer(source) ? source.toString() : source;
  const result = await minify(
    { [filename]: handler ? asFunction(text) : text },
    terserOptions,
  );

  if (handler) {
    const body = functionBody(result.code);

    // A wrap moves every position, so the map terser wrote describes a script
    // that is not what comes back.
    return { code: body === undefined ? text : body, extractedComments };
  }

  return {
    code: /** @type {string} * */ (result.code),
    map: result.map ? /** @type {RawSourceMap} * */ (result.map) : undefined,
    extractedComments,
  };
}

/**
 * @returns {string | undefined} the minimizer version
 */
terserMinify.getMinimizerVersion = () => packageVersion("terser");

/**
 * @returns {boolean | undefined} true if worker thread is supported, false otherwise
 */
terserMinify.supportsWorkerThreads = () => true;

/**
 * The language this minifies, for a caller dispatching source that carries
 * no filename of its own.
 * @returns {string[]} the languages
 */
terserMinify.getTypes = () => ["javascript"];

/**
 * @param {string} name asset name
 * @returns {boolean} true if `name` looks like a JavaScript file
 */
terserMinify.filter = (name) => JS_FILE_RE.test(name);

/* istanbul ignore next */
/**
 * @param {Input} input input
 * @param {RawSourceMap=} sourceMap source map
 * @param {CustomOptions=} minimizerOptions options
 * @param {ExtractCommentsOptions=} extractComments extract comments option
 * @returns {Promise<MinimizedResult>} minimized result
 */
async function uglifyJsMinify(
  input,
  sourceMap,
  minimizerOptions,
  extractComments,
) {
  // Self-require rather than the bindings above: a minify function reaches a
  // worker as its source, where this module's own scope is gone.
  const { EVENT_HANDLER, MODULE_SCRIPT, asFunction, functionBody } =
    // eslint-disable-next-line import/no-self-import
    require("./utils.js");

  /**
   * @param {unknown} value value
   * @returns {boolean} true when value is object or function
   */
  const isObject = (value) => {
    const type = typeof value;

    // eslint-disable-next-line no-eq-null, eqeqeq
    return value != null && (type === "object" || type === "function");
  };

  /**
   * @param {import("uglify-js").MinifyOptions & { sourceMap: boolean | import("uglify-js").SourceMapOptions | undefined } & { output: import("uglify-js").OutputOptions & { beautify: boolean } }} uglifyJsOptions uglify-js options
   * @param {ExtractedComments} extractedComments extracted comments
   * @returns {ExtractCommentsFunction} extract comments function
   */
  const buildComments = (uglifyJsOptions, extractedComments) => {
    /** @type {{ [index: string]: ExtractCommentsCondition }} */
    const condition = {};
    const { comments } = uglifyJsOptions.output;

    condition.preserve = typeof comments !== "undefined" ? comments : false;

    if (typeof extractComments === "boolean" && extractComments) {
      condition.extract = "some";
    } else if (
      typeof extractComments === "string" ||
      extractComments instanceof RegExp
    ) {
      condition.extract = extractComments;
    } else if (typeof extractComments === "function") {
      condition.extract = extractComments;
    } else if (extractComments && isObject(extractComments)) {
      condition.extract =
        typeof extractComments.condition === "boolean" &&
        extractComments.condition
          ? "some"
          : typeof extractComments.condition !== "undefined"
            ? extractComments.condition
            : "some";
    } else {
      // No extract
      // Preserve using "commentsOpts" or "some"
      condition.preserve = typeof comments !== "undefined" ? comments : "some";
      condition.extract = false;
    }

    // Ensure that both conditions are functions
    for (const key of ["preserve", "extract"]) {
      /** @type {undefined | string} */
      let regexStr;
      /** @type {undefined | RegExp} */
      let regex;

      switch (typeof condition[key]) {
        case "boolean":
          condition[key] = condition[key] ? () => true : () => false;

          break;
        case "function":
          break;
        case "string":
          if (condition[key] === "all") {
            condition[key] = () => true;

            break;
          }

          if (condition[key] === "some") {
            condition[key] = /** @type {ExtractCommentsFunction} */ (
              (astNode, comment) =>
                (comment.type === "comment2" || comment.type === "comment1") &&
                /@preserve|@lic|@cc_on|^\**!/i.test(comment.value)
            );

            break;
          }

          regexStr = /** @type {string} */ (condition[key]);
          condition[key] = /** @type {ExtractCommentsFunction} */ (
            (astNode, comment) =>
              new RegExp(/** @type {string} */ (regexStr)).test(comment.value)
          );

          break;
        default:
          regex = /** @type {RegExp} */ (condition[key]);

          condition[key] = /** @type {ExtractCommentsFunction} */ (
            (astNode, comment) =>
              /** @type {RegExp} */ (regex).test(comment.value)
          );
      }
    }

    // Redefine the comments function to extract and preserve
    // comments according to the two conditions
    const seenComments = new Set(extractedComments);

    return (astNode, comment) => {
      if (
        /** @type {{ extract: ExtractCommentsFunction }} */
        (condition).extract(astNode, comment)
      ) {
        const commentText =
          comment.type === "comment2"
            ? `/*${comment.value}*/`
            : `//${comment.value}`;

        // Don't include duplicate comments
        if (!seenComments.has(commentText)) {
          seenComments.add(commentText);
          extractedComments.push(commentText);
        }
      }

      return /** @type {{ preserve: ExtractCommentsFunction }} */ (
        condition
      ).preserve(astNode, comment);
    };
  };

  /**
   * @param {import("uglify-js").MinifyOptions & { ecma?: number | string, as?: string }=} uglifyJsOptions uglify-js options
   * @returns {import("uglify-js").MinifyOptions & { sourceMap: boolean | import("uglify-js").SourceMapOptions | undefined } & { output: import("uglify-js").OutputOptions & { beautify: boolean } }} uglify-js options
   */
  const buildUglifyJsOptions = (uglifyJsOptions = {}) => {
    // `as` names which production of JavaScript the source is. An inherited
    // `module` is the asset's rather than the source's, so it still goes.
    const { as } = uglifyJsOptions;

    if (typeof uglifyJsOptions.ecma !== "undefined") {
      delete uglifyJsOptions.ecma;
    }

    if (typeof uglifyJsOptions.module !== "undefined") {
      delete uglifyJsOptions.module;
    }

    if (typeof as !== "undefined") {
      delete uglifyJsOptions.as;
    }

    // Need deep copy objects to avoid https://github.com/terser/terser/issues/366
    return {
      ...uglifyJsOptions,
      ...(typeof as === "undefined"
        ? undefined
        : { module: as === MODULE_SCRIPT }),
      // warnings: uglifyJsOptions.warnings,
      parse: { ...uglifyJsOptions.parse },
      compress:
        typeof uglifyJsOptions.compress === "boolean"
          ? uglifyJsOptions.compress
          : { ...uglifyJsOptions.compress },
      mangle:
        // eslint-disable-next-line no-eq-null, eqeqeq
        uglifyJsOptions.mangle == null
          ? true
          : typeof uglifyJsOptions.mangle === "boolean"
            ? uglifyJsOptions.mangle
            : { ...uglifyJsOptions.mangle },
      output: { beautify: false, ...uglifyJsOptions.output },
      // Ignoring sourceMap from options

      sourceMap: undefined,
      // toplevel: uglifyJsOptions.toplevel
      // nameCache: { ...uglifyJsOptions.toplevel },
      // ie8: uglifyJsOptions.ie8,
      // keep_fnames: uglifyJsOptions.keep_fnames,
    };
  };

  // A function body is the production uglify-js has no goal symbol for, so the
  // function it belongs to is what is minified.
  const handler =
    typeof minimizerOptions !== "undefined" &&
    minimizerOptions.as === EVENT_HANDLER;

  let minify;

  try {
    ({ minify } = require("uglify-js"));
  } catch (err) {
    return { errors: [/** @type {Error} */ (err)] };
  }

  // Copy `uglify-js` options
  const uglifyJsOptions = buildUglifyJsOptions(minimizerOptions);

  // Let `uglify-js` generate a SourceMap. The dispatcher in `minify.js`
  // chains the previous step's map onto this one.
  if (sourceMap) {
    uglifyJsOptions.sourceMap = true;
  }

  /** @type {ExtractedComments} */
  const extractedComments = [];

  // @ts-expect-error wrong types in uglify-js
  uglifyJsOptions.output.comments = buildComments(
    uglifyJsOptions,
    extractedComments,
  );

  const [[filename, source]] = Object.entries(input);
  const text = Buffer.isBuffer(source) ? source.toString() : source;
  const result = await minify(
    { [filename]: handler ? asFunction(text) : text },
    uglifyJsOptions,
  );

  if (handler) {
    const body = functionBody(result.code);

    // A wrap moves every position, so the map uglify-js wrote describes a
    // script that is not what comes back.
    return {
      code: body === undefined ? text : body,
      errors: result.error ? [result.error] : [],
      warnings: result.warnings || [],
      extractedComments,
    };
  }

  return {
    code: result.code,
    map: result.map ? JSON.parse(result.map) : undefined,
    errors: result.error ? [result.error] : [],
    warnings: result.warnings || [],
    extractedComments,
  };
}

/**
 * @returns {string | undefined} the minimizer version
 */
uglifyJsMinify.getMinimizerVersion = () => packageVersion("uglify-js");

/**
 * @returns {boolean | undefined} true if worker thread is supported, false otherwise
 */
uglifyJsMinify.supportsWorkerThreads = () => true;

/**
 * The language this minifies, for a caller dispatching source that carries
 * no filename of its own.
 * @returns {string[]} the languages
 */
uglifyJsMinify.getTypes = () => ["javascript"];

/**
 * @param {string} name asset name
 * @returns {boolean} true if `name` looks like a JavaScript file
 */
uglifyJsMinify.filter = (name) => JS_FILE_RE.test(name);

/* istanbul ignore next */
/**
 * @param {Input} input input
 * @param {RawSourceMap=} sourceMap source map
 * @param {CustomOptions=} minimizerOptions options
 * @param {ExtractCommentsOptions=} extractComments extract comments option
 * @returns {Promise<MinimizedResult>} minimized result
 */
async function swcMinify(input, sourceMap, minimizerOptions, extractComments) {
  // Self-require rather than the bindings above: a minify function reaches a
  // worker as its source, where this module's own scope is gone.
  const { EVENT_HANDLER, MODULE_SCRIPT, asFunction, functionBody } =
    // eslint-disable-next-line import/no-self-import
    require("./utils.js");

  /**
   * @param {unknown} value value
   * @returns {boolean} true when value is object or function
   */
  const isObject = (value) => {
    const type = typeof value;

    // eslint-disable-next-line no-eq-null, eqeqeq
    return value != null && (type === "object" || type === "function");
  };

  /**
   * @param {unknown} extractCommentsOptions extract comments option
   * @returns {Error} error for unsupported extract comments option
   */
  const createExtractCommentsError = (extractCommentsOptions) =>
    new Error(
      `The 'extractComments' option for 'swcMinify' only supports booleans, "some", "all", string patterns, RegExp values without flags, or object conditions that resolve to those forms. Received: ${extractCommentsOptions instanceof RegExp ? extractCommentsOptions.toString() : typeof extractCommentsOptions}.`,
    );

  /**
   * @param {unknown} extractCommentsOptions extract comments option
   * @returns {{ extractComments: false | true | "some" | "all" | { regex: string }, useDefaultPreserveComments: boolean }} normalized swc extract comments options
   */
  const normalizeExtractComments = (extractCommentsOptions) => {
    if (typeof extractCommentsOptions === "boolean") {
      return {
        extractComments: extractCommentsOptions,
        useDefaultPreserveComments: !extractCommentsOptions,
      };
    }

    if (typeof extractCommentsOptions === "string") {
      return {
        extractComments:
          extractCommentsOptions === "some" || extractCommentsOptions === "all"
            ? extractCommentsOptions
            : { regex: extractCommentsOptions },
        useDefaultPreserveComments: false,
      };
    }

    if (extractCommentsOptions instanceof RegExp) {
      if (extractCommentsOptions.flags) {
        throw createExtractCommentsError(extractCommentsOptions);
      }

      return {
        extractComments: { regex: extractCommentsOptions.source },
        useDefaultPreserveComments: false,
      };
    }

    if (typeof extractCommentsOptions === "function") {
      throw createExtractCommentsError(extractCommentsOptions);
    }

    if (extractCommentsOptions && isObject(extractCommentsOptions)) {
      const { condition = "some" } =
        /** @type {{ condition?: unknown }} */
        (extractCommentsOptions);

      if (typeof condition === "boolean") {
        return {
          extractComments: condition ? "some" : false,
          useDefaultPreserveComments: false,
        };
      }

      if (typeof condition === "string") {
        return {
          extractComments:
            condition === "some" || condition === "all"
              ? condition
              : { regex: condition },
          useDefaultPreserveComments: false,
        };
      }

      if (condition instanceof RegExp) {
        if (condition.flags) {
          throw createExtractCommentsError(condition);
        }

        return {
          extractComments: { regex: condition.source },
          useDefaultPreserveComments: false,
        };
      }

      throw createExtractCommentsError(condition);
    }

    return {
      extractComments: false,
      useDefaultPreserveComments: false,
    };
  };

  /**
   * @param {(import("@swc/core").JsMinifyOptions & { as?: string })=} swcOptions swc options
   * @returns {import("@swc/core").JsMinifyOptions & { extractComments?: false | true | "some" | "all" | { regex: string } } & { sourceMap: undefined | boolean } & { compress: import("@swc/core").TerserCompressOptions }} built swc options
   */
  const buildSwcOptions = ({ as, ...swcOptions } = {}) =>
    // Need deep copy objects to avoid https://github.com/terser/terser/issues/366
    ({
      ...swcOptions,
      // `as` names which production of JavaScript the source is, and is the
      // source's own rather than the configuration's, so it overrides `module`.
      ...(typeof as === "undefined"
        ? undefined
        : { module: as === MODULE_SCRIPT }),
      compress:
        typeof swcOptions.compress === "boolean"
          ? swcOptions.compress
            ? {}
            : false
          : { ...swcOptions.compress },
      mangle:
        // eslint-disable-next-line no-eq-null, eqeqeq
        swcOptions.mangle == null
          ? true
          : typeof swcOptions.mangle === "boolean"
            ? swcOptions.mangle
            : { ...swcOptions.mangle },
      format: { ...swcOptions.format },
      // ecma: swcOptions.ecma,
      // keep_classnames: swcOptions.keep_classnames,
      // keep_fnames: swcOptions.keep_fnames,
      // module: swcOptions.module,
      // safari10: swcOptions.safari10,
      // toplevel: swcOptions.toplevel

      sourceMap: undefined,
    });

  // A function body is the production swc has no goal symbol for, so the
  // function it belongs to is what is minified.
  const handler =
    typeof minimizerOptions !== "undefined" &&
    minimizerOptions.as === EVENT_HANDLER;

  let swc;

  try {
    swc = require("@swc/core");
  } catch (err) {
    return { errors: [/** @type {Error} */ (err)] };
  }

  // Copy `swc` options
  const swcOptions = buildSwcOptions(minimizerOptions);
  const normalizedExtractComments = normalizeExtractComments(extractComments);

  if (!swcOptions.format) {
    swcOptions.format = {};
  }

  // Let `swc` generate a SourceMap.
  if (sourceMap) {
    swcOptions.sourceMap = true;
  }

  if (
    normalizedExtractComments.useDefaultPreserveComments &&
    typeof swcOptions.format.comments === "undefined"
  ) {
    swcOptions.format.comments = "some";
  }

  if (normalizedExtractComments.extractComments !== false) {
    /** @type {import("@swc/core").JsMinifyOptions & { extractComments?: false | true | "some" | "all" | { regex: string } }} */
    (swcOptions).extractComments = normalizedExtractComments.extractComments;
  }

  if (swcOptions.compress) {
    // More optimizations
    if (typeof swcOptions.compress.ecma === "undefined") {
      swcOptions.compress.ecma = swcOptions.ecma;
    }

    // https://github.com/webpack/webpack/issues/16135
    if (
      swcOptions.ecma === 5 &&
      typeof swcOptions.compress.arrows === "undefined"
    ) {
      swcOptions.compress.arrows = false;
    }
  }

  const [[filename, source]] = Object.entries(input);
  const text = Buffer.isBuffer(source) ? source.toString() : source;
  const result =
    /** @type {import("@swc/core").Output & { extractedComments?: string[] }} */
    (await swc.minify(handler ? asFunction(text) : text, swcOptions));

  if (handler) {
    const body = functionBody(result.code);

    // A wrap moves every position, so the map swc wrote describes a script that
    // is not what comes back.
    return {
      code: body === undefined ? text : body,
      extractedComments: result.extractedComments || [],
    };
  }

  let map;

  if (result.map) {
    map = JSON.parse(result.map);

    // TODO workaround for swc because `filename` is not preset as in `swc` signature as for `terser`
    map.sources = [filename];

    delete map.sourcesContent;
  }

  return {
    code: result.code,
    map,
    extractedComments: result.extractedComments || [],
  };
}

/**
 * @returns {string | undefined} the minimizer version
 */
swcMinify.getMinimizerVersion = () => packageVersion("@swc/core");

/**
 * @returns {boolean | undefined} true if worker thread is supported, false otherwise
 */
swcMinify.supportsWorkerThreads = () => false;

/**
 * The language this minifies, for a caller dispatching source that carries
 * no filename of its own.
 * @returns {string[]} the languages
 */
swcMinify.getTypes = () => ["javascript"];

/**
 * @param {string} name asset name
 * @returns {boolean} true if `name` looks like a JavaScript file
 */
swcMinify.filter = (name) => JS_FILE_RE.test(name);

/* istanbul ignore next */
/**
 * @param {Input} input input
 * @param {RawSourceMap=} sourceMap source map
 * @param {CustomOptions=} minimizerOptions options
 * @returns {Promise<MinimizedResult>} minimized result
 */
async function esbuildMinify(input, sourceMap, minimizerOptions) {
  // Self-require rather than the bindings above: a minify function reaches a
  // worker as its source, where this module's own scope is gone.
  const { EVENT_HANDLER, MODULE_SCRIPT, asFunction, functionBody } =
    // eslint-disable-next-line import/no-self-import
    require("./utils.js");

  /**
   * @param {import("esbuild").TransformOptions & { ecma?: string | number, module?: boolean, as?: string }=} esbuildOptions esbuild options
   * @returns {import("esbuild").TransformOptions} built esbuild options
   */
  const buildEsbuildOptions = (esbuildOptions = {}) => {
    delete esbuildOptions.ecma;

    // `as` names which production of JavaScript the source is, and is the
    // source's own rather than the configuration's, so it overrides `module`.
    if (typeof esbuildOptions.as !== "undefined") {
      esbuildOptions.module = esbuildOptions.as === MODULE_SCRIPT;

      delete esbuildOptions.as;
    }

    if (esbuildOptions.module) {
      esbuildOptions.format = "esm";
    }

    delete esbuildOptions.module;

    // Need deep copy objects to avoid https://github.com/terser/terser/issues/366
    return {
      minify: true,
      legalComments: "inline",
      ...esbuildOptions,
      sourcemap: false,
    };
  };

  // A function body is the production esbuild has no goal symbol for, so the
  // function it belongs to is what is minified.
  const handler =
    typeof minimizerOptions !== "undefined" &&
    minimizerOptions.as === EVENT_HANDLER;

  let esbuild;

  try {
    esbuild = require("esbuild");
  } catch (err) {
    return { errors: [/** @type {Error} */ (err)] };
  }

  // Copy `esbuild` options
  const esbuildOptions = buildEsbuildOptions(minimizerOptions);

  // Let `esbuild` generate a SourceMap
  if (sourceMap) {
    esbuildOptions.sourcemap = true;
    esbuildOptions.sourcesContent = false;
  }

  const [[filename, source]] = Object.entries(input);
  const text = Buffer.isBuffer(source) ? source.toString() : source;

  esbuildOptions.sourcefile = filename;

  const result = await esbuild.transform(
    handler ? asFunction(text) : text,
    esbuildOptions,
  );
  const body = handler ? functionBody(result.code) : undefined;

  return {
    code: handler ? (body === undefined ? text : body) : result.code,
    // A wrap moves every position, so the map esbuild wrote describes a script
    // that is not what comes back.
    map: handler || !result.map ? undefined : JSON.parse(result.map),
    warnings:
      result.warnings.length > 0
        ? result.warnings.map((item) => {
            const plugin = item.pluginName
              ? `\nPlugin Name: ${item.pluginName}`
              : "";
            const location = item.location
              ? `\n\n${item.location.file}:${item.location.line}:${item.location.column}:\n  ${item.location.line} | ${item.location.lineText}\n\nSuggestion: ${item.location.suggestion}`
              : "";
            const notes =
              item.notes.length > 0
                ? `\n\nNotes:\n${item.notes
                    .map(
                      (note) =>
                        `${
                          note.location
                            ? `[${note.location.file}:${note.location.line}:${note.location.column}] `
                            : ""
                        }${note.text}${
                          note.location
                            ? `\nSuggestion: ${note.location.suggestion}`
                            : ""
                        }${
                          note.location
                            ? `\nLine text:\n${note.location.lineText}\n`
                            : ""
                        }`,
                    )
                    .join("\n")}`
                : "";

            return `${item.text} [${item.id}]${plugin}${location}${
              item.detail ? `\nDetails:\n${item.detail}` : ""
            }${notes}`;
          })
        : [],
  };
}

/**
 * @returns {string | undefined} the minimizer version
 */
esbuildMinify.getMinimizerVersion = () => packageVersion("esbuild");

/**
 * @returns {boolean | undefined} true if worker thread is supported, false otherwise
 */
esbuildMinify.supportsWorkerThreads = () => false;

/**
 * The language this minifies, for a caller dispatching source that carries
 * no filename of its own.
 * @returns {string[]} the languages
 */
esbuildMinify.getTypes = () => ["javascript"];

/**
 * @param {string} name asset name
 * @returns {boolean} true if `name` looks like a JavaScript file
 */
esbuildMinify.filter = (name) => JS_FILE_RE.test(name);

/* istanbul ignore next */
/**
 * @param {Input} input input
 * @param {RawSourceMap=} sourceMap source map
 * @param {CustomOptions=} minimizerOptions options
 * @returns {Promise<MinimizedResult>} minimized result
 */
async function jsonMinify(input, sourceMap, minimizerOptions) {
  const options =
    /** @type {{ replacer?: Parameters<typeof JSON.stringify>[1], space?: Parameters<typeof JSON.stringify>[2] }} */
    (minimizerOptions);

  const [[, source]] = Object.entries(input);
  const code = Buffer.isBuffer(source) ? source.toString() : source;
  const result = JSON.stringify(
    JSON.parse(code),
    options.replacer,
    options.space,
  );

  return { code: result };
}

jsonMinify.getMinimizerVersion = () => "1.0.0";
jsonMinify.supportsWorker = () => false;
jsonMinify.supportsWorkerThreads = () => false;

/**
 * The language this minifies, for a caller dispatching source that carries
 * no filename of its own.
 * @returns {string[]} the languages
 */
jsonMinify.getTypes = () => ["json"];

/**
 * @param {string} name asset name
 * @returns {boolean} true if `name` looks like a JSON file
 */
jsonMinify.filter = (name) => JSON_FILE_RE.test(name);

/* istanbul ignore next */
/**
 * Minify HTML using `html-minifier-terser`.
 * @param {Input} input input
 * @param {RawSourceMap=} sourceMap source map (ignored for HTML)
 * @param {CustomOptions=} minimizerOptions options
 * @returns {Promise<MinimizedResult>} minimized result
 */
async function htmlMinifierTerser(input, sourceMap, minimizerOptions) {
  let htmlMinifier;

  try {
    htmlMinifier = require("html-minifier-terser");
  } catch (err) {
    return { errors: [/** @type {Error} */ (err)] };
  }

  const [[, source]] = Object.entries(input);
  const code = Buffer.isBuffer(source) ? source.toString() : source;
  /** @type {import("html-minifier-terser").Options} */
  const defaultMinimizerOptions = {
    caseSensitive: true,
    // `collapseBooleanAttributes` is not always safe, since this can break CSS attribute selectors and not safe for XHTML
    collapseWhitespace: true,
    conservativeCollapse: true,
    keepClosingSlash: true,
    // We need ability to use cssnano, or setup own function without extra dependencies
    minifyCSS: true,
    minifyJS: true,
    // `minifyURLs` is unsafe, because we can't guarantee what the base URL is
    // `removeAttributeQuotes` is not safe in some rare cases, also HTML spec recommends against doing this
    removeComments: true,
    // `removeEmptyAttributes` is not safe, can affect certain style or script behavior, look at https://github.com/webpack-contrib/html-loader/issues/323
    // `removeRedundantAttributes` is not safe, can affect certain style or script behavior, look at https://github.com/webpack-contrib/html-loader/issues/323
    removeScriptTypeAttributes: true,
    removeStyleLinkTypeAttributes: true,
    // `useShortDoctype` is not safe for XHTML
  };

  const result = await htmlMinifier.minify(code, {
    ...defaultMinimizerOptions,
    .../** @type {import("html-minifier-terser").Options} */ (minimizerOptions),
  });

  return { code: result };
}

/**
 * @returns {string | undefined} the minimizer version
 */
htmlMinifierTerser.getMinimizerVersion = () =>
  packageVersion("html-minifier-terser");

/**
 * @returns {boolean | undefined} true if worker threads are supported
 */
htmlMinifierTerser.supportsWorkerThreads = () => true;

/**
 * The language this minifies, for a caller dispatching source that carries
 * no filename of its own.
 * @returns {string[]} the languages
 */
htmlMinifierTerser.getTypes = () => ["html"];

/**
 * @param {string} name asset name
 * @returns {boolean} true if `name` looks like an HTML file
 */
htmlMinifierTerser.filter = (name) => HTML_FILE_RE.test(name);

/* istanbul ignore next */
/**
 * Minify HTML using `@minify-html/node`.
 * @param {Input} input input
 * @param {RawSourceMap=} sourceMap source map (ignored for HTML)
 * @param {CustomOptions=} minimizerOptions options
 * @returns {Promise<MinimizedResult>} minimized result
 */
async function minifyHtmlNode(input, sourceMap, minimizerOptions) {
  let minifyHtmlPkg;

  try {
    minifyHtmlPkg = require("@minify-html/node");
  } catch (err) {
    return { errors: [/** @type {Error} */ (err)] };
  }

  const [[, source]] = Object.entries(input);
  const code = Buffer.isBuffer(source) ? source.toString() : source;
  const options =
    /** @type {Parameters<import("@minify-html/node").minify>[1]} */ ({
      ...minimizerOptions,
    });
  const result = await minifyHtmlPkg.minify(Buffer.from(code), options);

  return { code: result.toString() };
}

/**
 * @returns {string | undefined} the minimizer version
 */
minifyHtmlNode.getMinimizerVersion = () => packageVersion("@minify-html/node");

/**
 * @returns {boolean | undefined} false because `@minify-html/node` is a native binding
 */
minifyHtmlNode.supportsWorkerThreads = () => false;

/**
 * The language this minifies, for a caller dispatching source that carries
 * no filename of its own.
 * @returns {string[]} the languages
 */
minifyHtmlNode.getTypes = () => ["html"];

/**
 * @param {string} name asset name
 * @returns {boolean} true if `name` looks like an HTML file
 */
minifyHtmlNode.filter = (name) => HTML_FILE_RE.test(name);

/* istanbul ignore next */
/**
 * Map an `@swc/html` diagnostic to a regular `Error`.
 * @param {EXPECTED_OBJECT} diagnostic diagnostic from `@swc/html`
 * @returns {Error} error preserving `span` and `level` from the diagnostic
 */
function swcHtmlDiagnosticToError(diagnostic) {
  const typed =
    /** @type {{ message: string, span?: unknown, level?: unknown }} */
    (diagnostic);
  /** @type {Error & { span?: unknown, level?: unknown }} */
  const error = new Error(typed.message);

  error.span = typed.span;
  error.level = typed.level;

  return error;
}

/* istanbul ignore next */
/**
 * Minify a complete HTML document using `@swc/html`.
 * @param {Input} input input
 * @param {RawSourceMap=} sourceMap source map (ignored for HTML)
 * @param {CustomOptions=} minimizerOptions options
 * @returns {Promise<MinimizedResult>} minimized result
 */
async function swcMinifyHtml(input, sourceMap, minimizerOptions) {
  let swcMinifier;

  try {
    swcMinifier = require("@swc/html");
  } catch (err) {
    return { errors: [/** @type {Error} */ (err)] };
  }

  const [[, source]] = Object.entries(input);
  const code = Buffer.isBuffer(source) ? source.toString() : source;
  const options = /** @type {import("@swc/html").Options} */ ({
    ...minimizerOptions,
  });
  const result = await swcMinifier.minify(Buffer.from(code), options);

  return {
    code: result.code,
    errors: result.errors
      ? result.errors.map(swcHtmlDiagnosticToError)
      : undefined,
  };
}

/**
 * @returns {string | undefined} the minimizer version
 */
swcMinifyHtml.getMinimizerVersion = () => packageVersion("@swc/html");

/**
 * @returns {boolean | undefined} false because `@swc/html` is a native binding
 */
swcMinifyHtml.supportsWorkerThreads = () => false;

/**
 * The language this minifies, for a caller dispatching source that carries
 * no filename of its own.
 * @returns {string[]} the languages
 */
swcMinifyHtml.getTypes = () => ["html"];

/**
 * @param {string} name asset name
 * @returns {boolean} true if `name` looks like an HTML file
 */
swcMinifyHtml.filter = (name) => HTML_FILE_RE.test(name);

/* istanbul ignore next */
/**
 * Minify an HTML fragment using `@swc/html`.
 *
 * Use this for partial HTML (e.g. inside `<template></template>` tags or
 * HTML strings that are inserted into another document).
 * @param {Input} input input
 * @param {RawSourceMap=} sourceMap source map (ignored for HTML)
 * @param {CustomOptions=} minimizerOptions options
 * @returns {Promise<MinimizedResult>} minimized result
 */
async function swcMinifyHtmlFragment(input, sourceMap, minimizerOptions) {
  let swcMinifier;

  try {
    swcMinifier = require("@swc/html");
  } catch (err) {
    return { errors: [/** @type {Error} */ (err)] };
  }

  const [[, source]] = Object.entries(input);
  const code = Buffer.isBuffer(source) ? source.toString() : source;
  const options = /** @type {import("@swc/html").FragmentOptions} */ ({
    ...minimizerOptions,
  });
  const result = await swcMinifier.minifyFragment(Buffer.from(code), options);

  return {
    code: result.code,
    errors: result.errors
      ? result.errors.map(swcHtmlDiagnosticToError)
      : undefined,
  };
}

/**
 * @returns {string | undefined} the minimizer version
 */
swcMinifyHtmlFragment.getMinimizerVersion = () => packageVersion("@swc/html");

/**
 * @returns {boolean | undefined} false because `@swc/html` is a native binding
 */
swcMinifyHtmlFragment.supportsWorkerThreads = () => false;

/**
 * The language this minifies, for a caller dispatching source that carries
 * no filename of its own.
 * @returns {string[]} the languages
 */
swcMinifyHtmlFragment.getTypes = () => ["html"];

/**
 * @param {string} name asset name
 * @returns {boolean} true if `name` looks like an HTML file
 */
swcMinifyHtmlFragment.filter = (name) => HTML_FILE_RE.test(name);

/* istanbul ignore next */
/**
 * Minify CSS using `cssnano` (via `postcss`).
 * @param {Input} input input
 * @param {RawSourceMap=} sourceMap source map
 * @param {CustomOptions=} minimizerOptions options
 * @returns {Promise<MinimizedResult>} minimized result
 */
async function cssnanoMinify(
  input,
  sourceMap,
  minimizerOptions = { preset: "default" },
) {
  /**
   * @template T
   * @param {string} mod module to load
   * @returns {Promise<T>} loaded module
   */
  const load = async (mod) => {
    let exports;

    try {
      exports = require(mod);

      return exports;
    } catch (err) {
      let importESM;

      try {
        // eslint-disable-next-line no-new-func
        importESM = new Function("id", "return import(id);");
      } catch (_err) {
        importESM = null;
      }

      if (
        /** @type {Error & { code: string }} */
        (err).code === "ERR_REQUIRE_ESM" &&
        importESM
      ) {
        exports = await importESM(mod);

        return exports.default;
      }

      throw err;
    }
  };

  let postcss;
  let cssnano;

  try {
    postcss = require("postcss");
    // cssnano exposes itself only through the `exports` field, which neither
    // `moduleResolution: "node"` nor the `import` plugin's node resolver reads
    // @ts-expect-error
    // eslint-disable-next-line import/no-unresolved
    cssnano = require("cssnano");
  } catch (err) {
    return { errors: [/** @type {Error} */ (err)] };
  }

  const [[name, source]] = Object.entries(input);
  const code = Buffer.isBuffer(source) ? source.toString() : source;
  /** @type {import("postcss").ProcessOptions} */
  const postcssOptions = {
    from: name,
    .../** @type {{ processorOptions?: import("postcss").ProcessOptions }} */ (
      minimizerOptions
    ).processorOptions,
  };

  if (typeof postcssOptions.parser === "string") {
    try {
      postcssOptions.parser = await load(postcssOptions.parser);
    } catch (error) {
      throw new Error(
        `Loading PostCSS "${postcssOptions.parser}" parser failed: ${
          /** @type {Error} */ (error).message
        }\n\n(@${name})`,
        { cause: error },
      );
    }
  }

  if (typeof postcssOptions.stringifier === "string") {
    try {
      postcssOptions.stringifier = await load(postcssOptions.stringifier);
    } catch (error) {
      throw new Error(
        `Loading PostCSS "${postcssOptions.stringifier}" stringifier failed: ${
          /** @type {Error} */ (error).message
        }\n\n(@${name})`,
        { cause: error },
      );
    }
  }

  if (typeof postcssOptions.syntax === "string") {
    try {
      postcssOptions.syntax = await load(postcssOptions.syntax);
    } catch (error) {
      throw new Error(
        `Loading PostCSS "${postcssOptions.syntax}" syntax failed: ${
          /** @type {Error} */ (error).message
        }\n\n(@${name})`,
        { cause: error },
      );
    }
  }

  if (sourceMap) {
    postcssOptions.map = { annotation: false };
  }

  const result = await postcss
    .default([cssnano(minimizerOptions)])
    .process(code, postcssOptions);

  return {
    code: result.css,
    map: result.map
      ? /** @type {RawSourceMap} */ (
          /** @type {unknown} */ (result.map.toJSON())
        )
      : undefined,
    warnings: result.warnings().map(String),
  };
}

/**
 * @returns {string | undefined} the minimizer version
 */
cssnanoMinify.getMinimizerVersion = () => packageVersion("cssnano");

/**
 * @returns {boolean | undefined} true if worker threads are supported
 */
cssnanoMinify.supportsWorkerThreads = () => true;

/**
 * The language this minifies, for a caller dispatching source that carries
 * no filename of its own.
 * @returns {string[]} the languages
 */
cssnanoMinify.getTypes = () => ["css"];

/**
 * @param {string} name asset name
 * @returns {boolean} true if `name` looks like a CSS file
 */
cssnanoMinify.filter = (name) => CSS_FILE_RE.test(name);

/* istanbul ignore next */
/**
 * Minify CSS using `csso`.
 * @param {Input} input input
 * @param {RawSourceMap=} sourceMap source map
 * @param {CustomOptions=} minimizerOptions options
 * @returns {Promise<MinimizedResult>} minimized result
 */
async function cssoMinify(input, sourceMap, minimizerOptions) {
  let csso;

  try {
    csso = require("csso");
  } catch (err) {
    return { errors: [/** @type {Error} */ (err)] };
  }

  const [[filename, source]] = Object.entries(input);
  const code = Buffer.isBuffer(source) ? source.toString() : source;
  const result = csso.minify(code, {
    filename,
    sourceMap: Boolean(sourceMap),
    ...minimizerOptions,
  });

  return {
    code: result.css,
    map: result.map
      ? /** @type {RawSourceMap} */ (
          /** @type {{ toJSON(): RawSourceMap }} */ (result.map).toJSON()
        )
      : undefined,
  };
}

/**
 * @returns {string | undefined} the minimizer version
 */
cssoMinify.getMinimizerVersion = () => packageVersion("csso");

/**
 * @returns {boolean | undefined} true if worker threads are supported
 */
cssoMinify.supportsWorkerThreads = () => true;

/**
 * The language this minifies, for a caller dispatching source that carries
 * no filename of its own.
 * @returns {string[]} the languages
 */
cssoMinify.getTypes = () => ["css"];

/**
 * @param {string} name asset name
 * @returns {boolean} true if `name` looks like a CSS file
 */
cssoMinify.filter = (name) => CSS_FILE_RE.test(name);

/* istanbul ignore next */
/**
 * Minify CSS using `clean-css`.
 * @param {Input} input input
 * @param {RawSourceMap=} sourceMap source map
 * @param {CustomOptions=} minimizerOptions options
 * @returns {Promise<MinimizedResult>} minimized result
 */
async function cleanCssMinify(input, sourceMap, minimizerOptions) {
  let CleanCSS;

  try {
    CleanCSS = require("clean-css");
  } catch (err) {
    return { errors: [/** @type {Error} */ (err)] };
  }

  const [[name, source]] = Object.entries(input);
  const code = Buffer.isBuffer(source) ? source.toString() : source;
  const result = await new CleanCSS({
    sourceMap: Boolean(sourceMap),
    ...minimizerOptions,
    returnPromise: true,
  }).minify({ [name]: { styles: code } });
  const generatedSourceMap = result.sourceMap
    ? /** @type {RawSourceMap} */ (
        /** @type {{ toJSON(): RawSourceMap }} */ (
          /** @type {unknown} */ (result.sourceMap)
        ).toJSON()
      )
    : undefined;

  // workaround for source maps on windows
  if (generatedSourceMap) {
    const isWindowsPathSep = require("path").sep === "\\";

    generatedSourceMap.sources = generatedSourceMap.sources.map(
      /**
       * @param {string | null} item path item
       * @returns {string} normalized path
       */
      (item) =>
        isWindowsPathSep ? (item || "").replace(/\\/g, "/") : item || "",
    );
  }

  return {
    code: result.styles,
    map: generatedSourceMap,
    warnings: result.warnings,
  };
}

/**
 * @returns {string | undefined} the minimizer version
 */
cleanCssMinify.getMinimizerVersion = () => packageVersion("clean-css");

/**
 * @returns {boolean | undefined} true if worker threads are supported
 */
cleanCssMinify.supportsWorkerThreads = () => true;

/**
 * The language this minifies, for a caller dispatching source that carries
 * no filename of its own.
 * @returns {string[]} the languages
 */
cleanCssMinify.getTypes = () => ["css"];

/**
 * @param {string} name asset name
 * @returns {boolean} true if `name` looks like a CSS file
 */
cleanCssMinify.filter = (name) => CSS_FILE_RE.test(name);

/* istanbul ignore next */
/**
 * Minify CSS using `esbuild` (with the CSS loader).
 * @param {Input} input input
 * @param {RawSourceMap=} sourceMap source map
 * @param {CustomOptions=} minimizerOptions options
 * @returns {Promise<MinimizedResult>} minimized result
 */
async function esbuildMinifyCss(input, sourceMap, minimizerOptions) {
  /**
   * @param {import("esbuild").TransformOptions & { ecma?: string | number, module?: boolean }=} esbuildOptions esbuild options
   * @returns {import("esbuild").TransformOptions} built esbuild options
   */
  const buildEsbuildOptions = (esbuildOptions = {}) => {
    // `module` and `ecma` are JavaScript-only concepts; the dispatcher
    // injects them for every minimizer, but esbuild's CSS transform
    // rejects unknown options.
    delete esbuildOptions.ecma;
    delete esbuildOptions.module;

    // Need deep copy objects to avoid https://github.com/terser/terser/issues/366
    return {
      loader: "css",
      minify: true,
      legalComments: "inline",
      ...esbuildOptions,
      sourcemap: false,
    };
  };

  let esbuild;

  try {
    esbuild = require("esbuild");
  } catch (err) {
    return { errors: [/** @type {Error} */ (err)] };
  }

  // Copy `esbuild` options
  const esbuildOptions = buildEsbuildOptions(minimizerOptions);

  // Let `esbuild` generate a SourceMap
  if (sourceMap) {
    esbuildOptions.sourcemap = true;
    esbuildOptions.sourcesContent = false;
  }

  const [[filename, source]] = Object.entries(input);
  const code = Buffer.isBuffer(source) ? source.toString() : source;

  esbuildOptions.sourcefile = filename;

  const result = await esbuild.transform(code, esbuildOptions);

  return {
    code: result.code,
    map: result.map ? JSON.parse(result.map) : undefined,
    warnings:
      result.warnings.length > 0
        ? result.warnings.map((item) => {
            const plugin = item.pluginName
              ? `\nPlugin Name: ${item.pluginName}`
              : "";
            const location = item.location
              ? `\n\n${item.location.file}:${item.location.line}:${item.location.column}:\n  ${item.location.line} | ${item.location.lineText}\n\nSuggestion: ${item.location.suggestion}`
              : "";
            const notes =
              item.notes.length > 0
                ? `\n\nNotes:\n${item.notes
                    .map(
                      (note) =>
                        `${
                          note.location
                            ? `[${note.location.file}:${note.location.line}:${note.location.column}] `
                            : ""
                        }${note.text}${
                          note.location
                            ? `\nSuggestion: ${note.location.suggestion}`
                            : ""
                        }${
                          note.location
                            ? `\nLine text:\n${note.location.lineText}\n`
                            : ""
                        }`,
                    )
                    .join("\n")}`
                : "";

            return `${item.text} [${item.id}]${plugin}${location}${
              item.detail ? `\nDetails:\n${item.detail}` : ""
            }${notes}`;
          })
        : [],
  };
}

/**
 * @returns {string | undefined} the minimizer version
 */
esbuildMinifyCss.getMinimizerVersion = () => packageVersion("esbuild");

/**
 * @returns {boolean | undefined} false because `esbuild` is a native binding
 */
esbuildMinifyCss.supportsWorkerThreads = () => false;

/**
 * The language this minifies, for a caller dispatching source that carries
 * no filename of its own.
 * @returns {string[]} the languages
 */
esbuildMinifyCss.getTypes = () => ["css"];

/**
 * @param {string} name asset name
 * @returns {boolean} true if `name` looks like a CSS file
 */
esbuildMinifyCss.filter = (name) => CSS_FILE_RE.test(name);

/* istanbul ignore next */
/**
 * Minify CSS using `lightningcss`.
 * @param {Input} input input
 * @param {RawSourceMap=} sourceMap source map
 * @param {CustomOptions=} minimizerOptions options
 * @returns {Promise<MinimizedResult>} minimized result
 */
async function lightningCssMinify(input, sourceMap, minimizerOptions) {
  let lightningCss;

  try {
    lightningCss = require("lightningcss");
  } catch (err) {
    return { errors: [/** @type {Error} */ (err)] };
  }

  const [[filename, source]] = Object.entries(input);
  const code = Buffer.isBuffer(source) ? source.toString() : source;
  /**
   * @param {Partial<import("lightningcss").TransformOptions<import("lightningcss").CustomAtRules>>=} lightningCssOptions lightning css options
   * @returns {import("lightningcss").TransformOptions<import("lightningcss").CustomAtRules>} built lightning css options
   */
  const buildLightningCssOptions = (lightningCssOptions = {}) =>
    // Need deep copy objects to avoid https://github.com/terser/terser/issues/366
    ({
      minify: true,
      ...lightningCssOptions,
      sourceMap: false,
      filename,
      code: new Uint8Array(Buffer.from(code)),
    });

  // Copy `lightningCss` options
  const lightningCssOptions = buildLightningCssOptions(minimizerOptions);

  // Let `lightningcss` generate a SourceMap. The dispatcher in
  // `minify.js` chains the previous step's map onto this one.
  if (sourceMap) {
    lightningCssOptions.sourceMap = true;
  }

  const result = lightningCss.transform(lightningCssOptions);

  return {
    code: result.code.toString(),
    map: result.map ? JSON.parse(result.map.toString()) : undefined,
  };
}

/**
 * @returns {string | undefined} the minimizer version
 */
lightningCssMinify.getMinimizerVersion = () => packageVersion("lightningcss");

/**
 * @returns {boolean | undefined} false because `lightningcss` is a native binding
 */
lightningCssMinify.supportsWorkerThreads = () => false;

/**
 * The language this minifies, for a caller dispatching source that carries
 * no filename of its own.
 * @returns {string[]} the languages
 */
lightningCssMinify.getTypes = () => ["css"];

/**
 * @param {string} name asset name
 * @returns {boolean} true if `name` looks like a CSS file
 */
lightningCssMinify.filter = (name) => CSS_FILE_RE.test(name);

/* istanbul ignore next */
/**
 * Map a `@swc/css` diagnostic to a regular `Error`.
 * @param {EXPECTED_OBJECT} diagnostic diagnostic from `@swc/css`
 * @returns {Error} error preserving `span` and `level` from the diagnostic
 */
function swcCssDiagnosticToError(diagnostic) {
  const typed =
    /** @type {{ message: string, span?: unknown, level?: unknown }} */
    (diagnostic);
  /** @type {Error & { span?: unknown, level?: unknown }} */
  const error = new Error(typed.message);

  error.span = typed.span;
  error.level = typed.level;

  return error;
}

/* istanbul ignore next */
/**
 * Minify CSS using `@swc/css`.
 * @param {Input} input input
 * @param {RawSourceMap=} sourceMap source map
 * @param {CustomOptions=} minimizerOptions options
 * @returns {Promise<MinimizedResult>} minimized result
 */
async function swcMinifyCss(input, sourceMap, minimizerOptions) {
  let swc;

  try {
    swc = require("@swc/css");
  } catch (err) {
    return { errors: [/** @type {Error} */ (err)] };
  }

  const [[filename, source]] = Object.entries(input);
  const code = Buffer.isBuffer(source) ? source.toString() : source;
  /**
   * @param {Partial<import("@swc/css").MinifyOptions>=} swcOptions swc options
   * @returns {import("@swc/css").MinifyOptions} built swc options
   */
  const buildSwcOptions = (swcOptions = {}) =>
    // Need deep copy objects to avoid https://github.com/terser/terser/issues/366
    ({ ...swcOptions, filename });

  // Copy `swc` options
  const swcOptions = buildSwcOptions(minimizerOptions);

  // Let `swc` generate a SourceMap
  if (sourceMap) {
    swcOptions.sourceMap = true;
  }

  const result = await swc.minify(Buffer.from(code), swcOptions);

  return {
    code: result.code.toString(),
    map: result.map ? JSON.parse(result.map.toString()) : undefined,
    errors: result.errors
      ? result.errors.map(swcCssDiagnosticToError)
      : undefined,
  };
}

/**
 * @returns {string | undefined} the minimizer version
 */
swcMinifyCss.getMinimizerVersion = () => packageVersion("@swc/css");

/**
 * @returns {boolean | undefined} false because `@swc/css` is a native binding
 */
swcMinifyCss.supportsWorkerThreads = () => false;

/**
 * The language this minifies, for a caller dispatching source that carries
 * no filename of its own.
 * @returns {string[]} the languages
 */
swcMinifyCss.getTypes = () => ["css"];

/**
 * @param {string} name asset name
 * @returns {boolean} true if `name` looks like a CSS file
 */
swcMinifyCss.filter = (name) => CSS_FILE_RE.test(name);

/**
 * The extension a name carries, lowercased and without the dot or any query.
 * @param {string} name asset name
 * @returns {string} the extension, or "" when it has none
 */
function extensionOf(name) {
  const withoutQuery = name.replace(/\?.*$/, "");
  const dotIndex = withoutQuery.lastIndexOf(".");
  const slashIndex = Math.max(
    withoutQuery.lastIndexOf("/"),
    withoutQuery.lastIndexOf("\\"),
  );

  return dotIndex > slashIndex
    ? withoutQuery.slice(dotIndex + 1).toLowerCase()
    : "";
}

/**
 * @param {string} value the text
 * @returns {number | undefined} it as a number, when it is one
 */
function readNumber(value) {
  const number = Number(value);

  return value.trim() !== "" && Number.isFinite(number) ? number : undefined;
}

/**
 * @param {string} value the text
 * @returns {number | undefined} it as a number above zero
 */
function readPositiveNumber(value) {
  const number = readNumber(value);

  return typeof number !== "undefined" && number > 0 ? number : undefined;
}

/**
 * @param {string} value the text
 * @returns {number | undefined} it as a whole number above zero
 */
function readPositiveInteger(value) {
  const number = readPositiveNumber(value);

  return typeof number !== "undefined" && Number.isInteger(number)
    ? number
    : undefined;
}

/**
 * @param {string} value the text
 * @returns {number | undefined} it as a whole number of zero or more
 */
function readWholeNumber(value) {
  const number = readNumber(value);

  return typeof number !== "undefined" &&
    Number.isInteger(number) &&
    number >= 0
    ? number
    : undefined;
}

const TRUE_TEXT = new Set(["", "true", "1", "yes"]);
const FALSE_TEXT = new Set(["false", "0", "no"]);

/**
 * A parameter present with no value — `?flip` — reads as true.
 * @param {string} value the text
 * @returns {boolean | undefined} it as a boolean, when it is one
 */
function readFlag(value) {
  const text = value.toLowerCase();

  if (TRUE_TEXT.has(text)) {
    return true;
  }

  return FALSE_TEXT.has(text) ? false : undefined;
}

/**
 * @param {string} value the text
 * @returns {number | boolean | undefined} how much, or whether at all
 */
function readAmount(value) {
  const number = readPositiveNumber(value);

  return typeof number === "undefined" ? readFlag(value) : number;
}

/**
 * `null` drops a dimension the configuration set.
 * @param {string} value the text
 * @returns {number | null | undefined} the size asked for
 */
function readDimension(value) {
  return value === "auto" ? null : readPositiveInteger(value);
}

/**
 * A value this table has a number for, and nothing else.
 * @param {Map<string, number>} numbers what each spelling means
 * @returns {(value: string) => number | undefined} the reader
 */
function readOneOf(numbers) {
  return (value) => numbers.get(value.toLowerCase());
}

/**
 * @param {number} lowest the least it may be
 * @param {number} highest the most it may be
 * @returns {(value: string) => number | undefined} the reader
 */
function readIntegerBetween(lowest, highest) {
  return (value) => {
    const number = readWholeNumber(value);

    return typeof number !== "undefined" &&
      number >= lowest &&
      number <= highest
      ? number
      : undefined;
  };
}

/**
 * A quarter turn or a multiple of one, normalized to 0-359, or the EXIF
 * orientation. Negative turns and multiples of a full circle read as the
 * quarter they land on.
 * @param {string} value the text
 * @returns {number | "auto" | undefined} how far to turn clockwise
 */
function readRightAngle(value) {
  if (value === "auto") {
    return "auto";
  }

  const number = readNumber(value);

  if (typeof number === "undefined" || number % 90 !== 0) {
    return undefined;
  }

  return ((number % 360) + 360) % 360;
}

/**
 * The one parameter sharp never sees, so the only enum checked here.
 * @param {string} value the text
 * @returns {"px" | "percent" | undefined} the unit asked for
 */
function readUnit(value) {
  return value === "px" || value === "percent" ? value : undefined;
}

/**
 * @param {string} value the text
 * @returns {number | "auto" | undefined} the angle, or the EXIF orientation
 */
function readAngle(value) {
  return value === "auto" ? "auto" : readNumber(value);
}

/**
 * @param {string} value the text
 * @returns {string | undefined} it, when it says anything
 */
function readText(value) {
  return value === "" ? undefined : value;
}

/**
 * What an asset's name may ask sharp for: the spellings that name each
 * parameter, which of sharp's three argument bags the value belongs in, the
 * name sharp knows it by, and how the text is read. Adding a parameter is
 * adding an entry.
 *
 * Only the *shape* of a value is checked, because a name carries queries this
 * plugin never put there — `?v=2` must not become a resize. Whether a
 * well-formed value is one sharp accepts is sharp's to answer, and it does so
 * per format: `effort` runs to 6 for webp and 9 for avif, `fit` and `position`
 * are enums it owns, and a colour is whatever it can parse. Enumerating any of
 * that here would be a second, staler copy of sharp's own validation.
 * @type {{ spellings: string[], group: "resize" | "pipeline" | "encode" | "output", name: string, read: (value: string) => EXPECTED_ANY }[]}
 */
const SHARP_QUERY_PARAMETERS = [
  {
    spellings: ["width", "w"],
    group: "resize",
    name: "width",
    read: readDimension,
  },
  {
    spellings: ["height", "h"],
    group: "resize",
    name: "height",
    read: readDimension,
  },
  {
    spellings: ["as", "format"],
    group: "output",
    name: "format",
    read: readText,
  },
  { spellings: ["unit", "u"], group: "resize", name: "unit", read: readUnit },
  { spellings: ["fit"], group: "resize", name: "fit", read: readText },
  {
    spellings: ["position", "pos"],
    group: "resize",
    name: "position",
    read: readText,
  },
  {
    spellings: ["background", "bg"],
    group: "resize",
    name: "background",
    read: readText,
  },
  {
    spellings: ["without-enlargement", "withoutEnlargement"],
    group: "resize",
    name: "withoutEnlargement",
    read: readFlag,
  },
  {
    spellings: ["rotate", "rot"],
    group: "pipeline",
    name: "rotate",
    read: readAngle,
  },
  { spellings: ["flip"], group: "pipeline", name: "flip", read: readFlag },
  { spellings: ["flop"], group: "pipeline", name: "flop", read: readFlag },
  {
    spellings: ["grayscale", "greyscale", "gray", "grey"],
    group: "pipeline",
    name: "grayscale",
    read: readFlag,
  },
  { spellings: ["blur"], group: "pipeline", name: "blur", read: readAmount },
  {
    spellings: ["sharpen"],
    group: "pipeline",
    name: "sharpen",
    read: readAmount,
  },
  {
    spellings: ["quality", "q"],
    group: "encode",
    name: "quality",
    // Zero is a quality png accepts and jpeg does not, so sharp decides.
    read: readWholeNumber,
  },
  {
    spellings: ["lossless"],
    group: "encode",
    name: "lossless",
    read: readFlag,
  },
  {
    spellings: ["effort"],
    group: "encode",
    name: "effort",
    read: readWholeNumber,
  },
  {
    spellings: ["progressive", "prog"],
    group: "encode",
    name: "progressive",
    read: readFlag,
  },
];

/**
 * A bag of parameters: whatever a table's `name`s are, read off a query or set
 * in `minimizerOptions`.
 * @typedef {{ [name: string]: EXPECTED_ANY }} QueryValues
 */

/**
 * The pipeline parameters that are a sharp method of the same name taking one
 * argument. `rotate` is not among them: its no-argument call means EXIF.
 * @type {("flip" | "flop" | "grayscale" | "blur" | "sharpen")[]}
 */
const SHARP_PIPELINE_OPERATIONS = [
  "flip",
  "flop",
  "grayscale",
  "blur",
  "sharpen",
];

/**
 * @typedef {{ spellings: string[], group: string, name: string, read: (value: string) => EXPECTED_ANY }} QueryParameter
 */

/**
 * A table keyed by every spelling that names one of its parameters.
 * @param {QueryParameter[]} parameters the table
 * @returns {Map<string, QueryParameter>} it, ready to look a spelling up in
 */
function bySpelling(parameters) {
  /** @type {Map<string, QueryParameter>} */
  const lookup = new Map();

  for (const parameter of parameters) {
    for (const spelling of parameter.spellings) {
      // Looked up in lower case, so a spelling is written however it reads best.
      lookup.set(spelling.toLowerCase(), parameter);
    }
  }

  return lookup;
}

const SHARP_QUERY_PARAMETER_BY_SPELLING = bySpelling(SHARP_QUERY_PARAMETERS);

/**
 * Whether `generate` was written as a set of named presets rather than as one
 * generator or a pipeline of them. A function is never a set; an array is a
 * pipeline, which is why only a plain object counts.
 * @param {EXPECTED_ANY} generate what `generate` was set to
 * @returns {boolean} true when it names its generators
 */
function isPresets(generate) {
  return (
    typeof generate === "object" &&
    generate !== null &&
    !Array.isArray(generate)
  );
}

/**
 * Substitutes `[width]` and `[height]` into a name, which webpack's own
 * templates do not know. A placeholder no generator reported a size for is
 * left standing, so the caller can tell it apart from a name it can use.
 * @param {string} filename a filename template, already otherwise resolved
 * @param {{ width?: number, height?: number }} size what the generator reported
 * @returns {string} the name
 */
function interpolateSize(filename, size) {
  return filename.replace(/\[(width|height)\]/gi, (placeholder, key) => {
    const value = size[/** @type {"width" | "height"} */ (key.toLowerCase())];

    return typeof value === "number" ? String(value) : placeholder;
  });
}

/**
 * Whether a minimizer or generator was written as an object stating how to run
 * it, rather than as the function itself.
 * @param {EXPECTED_ANY} entry what `minify` or `generate` holds
 * @returns {boolean} true when it describes one
 */
function isDescriptor(entry) {
  return (
    typeof entry === "object" &&
    entry !== null &&
    !Array.isArray(entry) &&
    typeof entry.implementation !== "undefined"
  );
}

/**
 * Flattens the objects `minify` may hold into the implementation-and-options
 * pair the rest of the plugin reads, so a descriptor's own `options` and the
 * deprecated `minimizerOptions` end up in one place, aligned by position.
 * @param {EXPECTED_ANY} minify what `minify` was set to
 * @param {EXPECTED_ANY} declared what `minimizerOptions` says
 * @returns {{ implementation: EXPECTED_ANY, options: EXPECTED_ANY }} the pair
 */
function normalizeMinimizers(minify, declared) {
  // TODO drop the `declared` fallback in the next major release, with the
  // deprecated `minimizerOptions` it carries.
  if (Array.isArray(minify)) {
    if (!minify.some(isDescriptor)) {
      return { implementation: minify, options: declared };
    }

    return {
      implementation: minify.map((one) =>
        isDescriptor(one) ? one.implementation : one,
      ),
      options: minify.map((one, index) =>
        isDescriptor(one) && typeof one.options !== "undefined"
          ? one.options
          : getMinimizerOptionsAt(declared, index),
      ),
    };
  }

  if (isDescriptor(minify)) {
    return {
      implementation: minify.implementation,
      options:
        typeof minify.options === "undefined" ? declared : minify.options,
    };
  }

  return { implementation: minify, options: declared };
}

/**
 * The preset an asset's own name asks for, as `?as=webp`.
 * @param {string} name asset name, query and all
 * @returns {string | undefined} the preset asked for, or undefined
 */
function readPreset(name) {
  const queryIndex = name.indexOf("?");

  if (queryIndex === -1) {
    return undefined;
  }

  const query = name.slice(queryIndex + 1);
  const fragmentIndex = query.indexOf("#");
  const asked = new URLSearchParams(
    fragmentIndex === -1 ? query : query.slice(0, fragmentIndex),
  ).get("as");

  return asked || undefined;
}

/**
 * What an asset's name asks a minimizer for, grouped by the argument bag each
 * value belongs in. `output.assetModuleFilename` carries the request's query
 * into the emitted name, so `import banner from "./banner.png?width=320"`
 * arrives here as `banner.png?width=320`.
 *
 * None of this needs a new name — the asset keeps the one it already has —
 * which is why it can be read here rather than in a loader, unlike `?as=`.
 * @param {string} name asset name
 * @param {Map<string, QueryParameter>} parameters what this minimizer accepts
 * @returns {{ [group: string]: QueryValues } | undefined} what it asks for, or undefined when it asks for nothing
 */
function readQuery(name, parameters) {
  const queryIndex = name.indexOf("?");

  if (queryIndex === -1) {
    return undefined;
  }

  const query = name.slice(queryIndex + 1);
  const fragmentIndex = query.indexOf("#");
  /** @type {{ [group: string]: QueryValues }} */
  const asked = {};
  let asksForAnything = false;

  for (const [spelling, text] of new URLSearchParams(
    fragmentIndex === -1 ? query : query.slice(0, fragmentIndex),
  )) {
    const parameter = parameters.get(spelling.toLowerCase());

    if (!parameter) {
      continue;
    }

    const value = parameter.read(text);

    if (typeof value === "undefined") {
      continue;
    }

    asked[parameter.group] = asked[parameter.group] || {};
    asked[parameter.group][parameter.name] = value;
    asksForAnything = true;
  }

  return asksForAnything ? asked : undefined;
}

/**
 * The query wins over the configuration, being the more specific of the two.
 * @template {EXPECTED_OBJECT} T
 * @param {T | undefined} configured what `minimizerOptions` set
 * @param {EXPECTED_OBJECT=} requested what the name asked for
 * @returns {T | undefined} the two merged, or undefined when neither says anything
 */
function mergeRequested(configured, requested) {
  if (!requested) {
    return configured;
  }

  const merged = /** @type {EXPECTED_ANY} */ ({ ...configured });

  for (const [name, value] of Object.entries(requested)) {
    if (value === null) {
      delete merged[name];
    } else {
      merged[name] = value;
    }
  }

  return merged;
}

/**
 * The bytes of what a binary minimizer was handed. Its source may reach it as
 * text when the asset was built as one, so this is the one place that decides.
 *
 * Only reachable from a minimizer that declares `supportsWorker` false: every
 * other one is serialized to source and re-evaluated in a worker, where nothing
 * this module defines exists.
 * @param {string | Buffer} code the input
 * @returns {Buffer} its bytes
 */
function toBuffer(code) {
  return Buffer.isBuffer(code) ? code : Buffer.from(code);
}

/**
 * Which sharp format each extension names. Minifying re-encodes a file as
 * itself, so this is both the set sharp is offered and the format it writes.
 *
 * `raw` is not among them though sharp writes it: bare pixels carry no header,
 * so sharp cannot read one back without being told its width and height, which
 * a minimizer handed only bytes has no way to know.
 * @type {Map<string, string>}
 */
const SHARP_MINIFY_FORMATS = new Map([
  ["avif", "avif"],
  ["gif", "gif"],
  ["heic", "heif"],
  ["heif", "heif"],
  ["j2c", "jp2"],
  ["j2k", "jp2"],
  ["jp2", "jp2"],
  ["jpeg", "jpeg"],
  ["jpg", "jpeg"],
  ["jpx", "jp2"],
  ["png", "png"],
  ["tif", "tiff"],
  ["tiff", "tiff"],
  ["webp", "webp"],
]);

/**
 * Which sharp format each spelling of a target names. Derived from the read
 * map, so a format sharp is not offered cannot be asked for either. Both
 * `webp` and the extensions that alias a format (`jpg`) are accepted, and the
 * spelling asked for is the extension the result carries.
 * @type {Map<string, string>}
 */
const SHARP_GENERATE_FORMATS = new Map(SHARP_MINIFY_FORMATS);

/**
 * Replace a name's extension, keeping any query and fragment: the request that
 * asked for the conversion is still part of what the asset is named after.
 * @param {string} name asset name
 * @param {string} extension the new extension, without a dot
 * @returns {string} the renamed asset
 */
function replaceExtension(name, extension) {
  const suffix = /[?#]/.exec(name);
  const bare = suffix ? name.slice(0, suffix.index) : name;
  const rest = suffix ? name.slice(suffix.index) : "";
  const dot = bare.lastIndexOf(".");

  return `${dot > bare.lastIndexOf("/") ? bare.slice(0, dot) : bare}.${extension}${rest}`;
}

/* istanbul ignore next */
/**
 * Re-encode an image with `sharp`, as its own format or as another one.
 * @param {Input} input input
 * @param {CustomOptions=} minimizerOptions options
 * @param {string=} targetFormat the format to write, when it is not the input's own
 * @returns {Promise<MinimizedResult>} minimized result
 */
async function sharpTransform(input, minimizerOptions, targetFormat) {
  /**
   * @typedef {object} SharpMinifyOptions
   * @property {(import("sharp").ResizeOptions & { unit?: "px" | "percent", enabled?: boolean })=} resize resize the image before re-encoding it
   * @property {number | "auto"=} rotate rotate by an angle, or by what the EXIF orientation says
   * @property {boolean=} flip mirror vertically
   * @property {boolean=} flop mirror horizontally
   * @property {boolean=} grayscale drop the colour
   * @property {number | boolean=} blur blur by this sigma, or by a fast default
   * @property {number | boolean=} sharpen sharpen by this sigma, or by a fast default
   * @property {{ [format: string]: EXPECTED_OBJECT }=} encodeOptions per-format options, keyed by sharp's format name
   *
   * Every one of these can also be asked for by the asset's own name — see
   * `SHARP_QUERY_PARAMETERS` — and the name wins where both say something.
   */
  const [[name, code]] = Object.entries(input);
  // Minifying writes the input's own format; generating writes the one asked
  // for, and only needs the input to be readable.
  const format = targetFormat
    ? SHARP_GENERATE_FORMATS.get(targetFormat)
    : SHARP_MINIFY_FORMATS.get(extensionOf(name));

  // `filter` offers only what these maps hold, so a name reaching here without
  // one came from a caller that dispatched by something else.
  if (
    typeof format === "undefined" ||
    !SHARP_MINIFY_FORMATS.has(extensionOf(name))
  ) {
    return { code };
  }

  const options = /** @type {SharpMinifyOptions} */ (minimizerOptions || {});

  /** @type {import("sharp")} */

  const sharp = require("sharp");

  const pipeline = sharp(toBuffer(code), { animated: true });

  const requested = readQuery(name, SHARP_QUERY_PARAMETER_BY_SPELLING);
  const transforms = /** @type {QueryValues} */ (
    mergeRequested(
      {
        rotate: options.rotate,
        flip: options.flip,
        flop: options.flop,
        grayscale: options.grayscale,
        blur: options.blur,
        sharpen: options.sharpen,
      },
      requested && requested.pipeline,
    )
  );

  if (typeof transforms.rotate === "number") {
    pipeline.rotate(transforms.rotate);
  } else if (transforms.rotate === "auto") {
    pipeline.rotate();
  }

  // Each takes one argument and accepts `false`, so the name is enough to
  // drive it. sharp orders the operations itself, whatever order they arrive.
  for (const operation of SHARP_PIPELINE_OPERATIONS) {
    if (typeof transforms[operation] !== "undefined") {
      pipeline[operation](/** @type {EXPECTED_ANY} */ (transforms[operation]));
    }
  }

  const requestedResize = mergeRequested(
    options.resize,
    requested && requested.resize,
  );

  if (requestedResize) {
    const { enabled = true, unit = "px", ...params } = requestedResize;

    if (
      enabled &&
      (typeof params.width === "number" || typeof params.height === "number")
    ) {
      if (unit === "percent") {
        const { width, height } = await pipeline.metadata();

        if (typeof params.width === "number" && width) {
          params.width = Math.ceil((width * params.width) / 100);
        }

        if (typeof params.height === "number" && height) {
          params.height = Math.ceil((height * params.height) / 100);
        }
      }

      pipeline.resize(params);
    }
  }

  pipeline.toFormat(
    /** @type {EXPECTED_ANY} */ (format),
    mergeRequested(
      options.encodeOptions && options.encodeOptions[format],
      requested && requested.encode,
    ),
  );

  const { data: encoded, info } = await pipeline.toBuffer({
    resolveWithObject: true,
  });
  const size = { width: info.width, height: info.height };

  return targetFormat
    ? {
        ...size,
        code: encoded,
        filename: replaceExtension(name, targetFormat),
      }
    : { ...size, code: encoded };
}

/* istanbul ignore next */
/**
 * Minify an image using `sharp`, re-encoding it as its own format.
 * @param {Input} input input
 * @param {RawSourceMap=} sourceMap source map (ignored for images)
 * @param {CustomOptions=} minimizerOptions options
 * @returns {Promise<MinimizedResult>} minimized result
 */
async function sharpMinify(input, sourceMap, minimizerOptions) {
  return sharpTransform(input, minimizerOptions);
}

/* istanbul ignore next */
/**
 * Re-encode an image as another format with `sharp`, renaming it to match.
 *
 * The format is asked for by the asset's own name — `?as=webp` — or by the one
 * key of `encodeOptions`, and the name wins where both say something. Naming
 * neither is an error: there is no format to generate.
 * @param {Input} input input
 * @param {RawSourceMap=} sourceMap source map (ignored for images)
 * @param {CustomOptions=} minimizerOptions options
 * @returns {Promise<MinimizedResult>} minimized result
 */
async function sharpGenerate(input, sourceMap, minimizerOptions) {
  const [[name, code]] = Object.entries(input);
  const options = minimizerOptions || {};
  const requested = readQuery(name, SHARP_QUERY_PARAMETER_BY_SPELLING);
  const named = requested && requested.output && requested.output.format;
  const keys = Object.keys(options.encodeOptions || {});

  if (!named && keys.length !== 1) {
    return {
      code,
      errors: [
        new Error(
          keys.length === 0
            ? `Error with '${name}': no target format. Ask for one by name (\`?as=webp\`) or give \`encodeOptions\` exactly one format.`
            : `Error with '${name}': \`encodeOptions\` names ${keys.length} formats (${keys.join(", ")}), so which to generate is ambiguous. Ask for one by name (\`?as=webp\`) or give it exactly one.`,
        ),
      ],
    };
  }

  const target = /** @type {string} */ (named || keys[0]);

  if (!SHARP_GENERATE_FORMATS.has(target)) {
    return {
      code,
      errors: [
        new Error(`Error with '${name}': sharp does not write '${target}'.`),
      ],
    };
  }

  return sharpTransform(input, options, target);
}

/**
 * @returns {string | undefined} the minimizer version
 */
sharpGenerate.getMinimizerVersion = () => packageVersion("sharp");

/**
 * @returns {boolean} true, images are binary
 */
sharpGenerate.supportsBinary = () => true;

/**
 * @returns {boolean} false, sharp stays in process
 */
sharpGenerate.supportsWorker = () => false;

/**
 * @returns {boolean} false
 */
sharpGenerate.supportsWorkerThreads = () => false;

/**
 * @param {string} name asset name
 * @returns {boolean} true if sharp can read `name`
 */
sharpGenerate.filter = (name) => SHARP_MINIFY_FORMATS.has(extensionOf(name));

/**
 * @returns {string | undefined} the minimizer version
 */
sharpMinify.getMinimizerVersion = () => packageVersion("sharp");

/**
 * The asset reaches this one as bytes rather than as text.
 * @returns {boolean} true, images are binary
 */
sharpMinify.supportsBinary = () => true;

/**
 * sharp runs its own thread pool over native code, and its input cannot cross
 * the worker boundary as text, so it stays in process.
 * @returns {boolean} false
 */
sharpMinify.supportsWorker = () => false;

/**
 * @returns {boolean} false
 */
sharpMinify.supportsWorkerThreads = () => false;

/**
 * @param {string} name asset name
 * @returns {boolean} true if sharp can re-encode `name` as its own format
 */
sharpMinify.filter = (name) => SHARP_MINIFY_FORMATS.has(extensionOf(name));

/**
 * `@napi-rs/image` declares its enums in TypeScript alone — at runtime they
 * are bare numbers — so each spelling is mapped to its number here. That also
 * makes an unknown one a value this table simply has no number for, which
 * matters more than it does for sharp: napi either throws without naming the
 * parameter (`Value is none of these types`) or, for a quality out of range,
 * silently writes a bigger file.
 * @type {Map<string, number>}
 */
const NAPI_RS_IMAGE_FITS = new Map([
  ["cover", 0],
  ["fill", 1],
  ["inside", 2],
]);

/** @type {Map<string, number>} */
const NAPI_RS_IMAGE_FILTERS = new Map([
  ["nearest", 0],
  ["triangle", 1],
  ["catmull-rom", 2],
  ["gaussian", 3],
  ["lanczos3", 4],
]);

/**
 * EXIF orientation encodes the eight symmetries of a rectangle, and `rotate`
 * takes one of them, so mirroring and a turn compose into a single value.
 * Keyed by whether the image is mirrored and how far it then turns clockwise.
 * @type {Map<string, number>}
 */
const NAPI_RS_IMAGE_ORIENTATIONS = new Map([
  ["0", 1],
  ["90", 6],
  ["180", 3],
  ["270", 8],
  ["mirrored 0", 2],
  ["mirrored 90", 7],
  ["mirrored 180", 4],
  ["mirrored 270", 5],
]);

/**
 * What an asset's name may ask `@napi-rs/image` for. Same spellings as sharp's
 * table wherever the two can do the same thing, so one vocabulary covers both.
 * @type {QueryParameter[]}
 */
const NAPI_RS_IMAGE_QUERY_PARAMETERS = [
  {
    spellings: ["width", "w"],
    group: "resize",
    name: "width",
    read: readDimension,
  },
  {
    spellings: ["height", "h"],
    group: "resize",
    name: "height",
    read: readDimension,
  },
  {
    spellings: ["fit"],
    group: "resize",
    name: "fit",
    read: readOneOf(NAPI_RS_IMAGE_FITS),
  },
  {
    spellings: ["filter"],
    group: "resize",
    name: "filter",
    read: readOneOf(NAPI_RS_IMAGE_FILTERS),
  },
  {
    spellings: ["rotate", "rot"],
    group: "orient",
    name: "rotate",
    read: readRightAngle,
  },
  { spellings: ["flip"], group: "orient", name: "flip", read: readFlag },
  { spellings: ["flop"], group: "orient", name: "flop", read: readFlag },
  {
    spellings: ["grayscale", "greyscale", "gray", "grey"],
    group: "pipeline",
    name: "grayscale",
    read: readFlag,
  },
  { spellings: ["invert"], group: "pipeline", name: "invert", read: readFlag },
  {
    spellings: ["blur"],
    group: "pipeline",
    name: "blur",
    read: readPositiveNumber,
  },
  {
    spellings: ["quality", "q"],
    group: "encode",
    name: "quality",
    read: readIntegerBetween(0, 100),
  },
  {
    spellings: ["lossless"],
    group: "encode",
    name: "lossless",
    read: readFlag,
  },
  {
    spellings: ["speed"],
    group: "encode",
    name: "speed",
    read: readIntegerBetween(1, 10),
  },
];

const NAPI_RS_IMAGE_QUERY_PARAMETER_BY_SPELLING = bySpelling(
  NAPI_RS_IMAGE_QUERY_PARAMETERS,
);

/**
 * The pipeline parameters that are a `Transformer` method of the same name.
 * `blur` takes its sigma; the other two take nothing, so a false reads as
 * "do not call it" rather than being passed on.
 * @type {("grayscale" | "invert")[]}
 */
const NAPI_RS_IMAGE_OPERATIONS = ["grayscale", "invert"];

/**
 * The single orientation to hand `rotate`, given what was asked for. A mirror
 * about the vertical axis is a mirror about the horizontal one turned half a
 * circle, which is what lets the two compose into one value.
 * @param {QueryValues} orient rotate, flip and flop as asked for
 * @returns {number | undefined} the EXIF orientation, or undefined for none
 */
function napiRsImageOrientation(orient) {
  const turn = typeof orient.rotate === "number" ? orient.rotate : 0;
  const rotation = (turn + (orient.flip ? 180 : 0)) % 360;
  const mirrored = Boolean(orient.flip) !== Boolean(orient.flop);

  // Leaving it where it is is not an orientation to apply, so saying so lets
  // `rotate=auto` keep the no-argument call that reads the EXIF one.
  if (rotation === 0 && !mirrored) {
    return undefined;
  }

  return NAPI_RS_IMAGE_ORIENTATIONS.get(
    `${mirrored ? "mirrored " : ""}${rotation}`,
  );
}

/**
 * Which encoder each extension names. Only the four `@napi-rs/image` both reads
 * back reliably and makes smaller: `bmp` is uncompressed so re-encoding gains
 * nothing, `tiff` and `ico` fail to decode what other encoders write, and
 * `heic` encoding exists only on macOS and Windows.
 * @type {Map<string, string>}
 */
const NAPI_RS_IMAGE_FORMATS = new Map([
  ["avif", "avif"],
  ["jpeg", "jpeg"],
  ["jpg", "jpeg"],
  ["png", "png"],
  ["webp", "webp"],
]);

/**
 * How each format is written. A `repack` one rewrites the encoded bytes in
 * place, which is where napi's win is — oxipng saves 99% of this repository's
 * png fixture where decoding to pixels and encoding again saves 9% — so when a
 * transform has to run first, its output is handed back to the repack rather
 * than replacing it. The other two already go through a `Transformer`, so the
 * transforms simply join the one that was going to run anyway.
 * @type {Map<string, { write: (transformer: EXPECTED_ANY, options: QueryValues) => Promise<Buffer>, repack?: (image: EXPECTED_ANY, bytes: Buffer, options: QueryValues) => Promise<Buffer> }>}
 */
const NAPI_RS_IMAGE_ENCODERS = new Map([
  [
    "avif",
    {
      // avif has no `lossless` of its own; on its scale that is quality 100.
      write: (transformer, options) =>
        transformer.avif(
          options.lossless ? { ...options, quality: 100 } : options,
        ),
    },
  ],
  [
    "webp",
    {
      write: (transformer, options) =>
        options.lossless
          ? transformer.webpLossless()
          : transformer.webp(options.quality),
    },
  ],
  [
    "jpeg",
    {
      // Written back at full quality so mozjpeg, not this step, decides what
      // is lost.
      write: (transformer) => transformer.jpeg(100),
      repack: (image, bytes, options) => image.compressJpeg(bytes, options),
    },
  ],
  [
    "png",
    {
      write: (transformer) => transformer.png(),
      repack: (image, bytes, options) =>
        image.losslessCompressPng(bytes, options),
    },
  ],
]);

/**
 * @param {Buffer} code the minified bytes
 * @param {string[]} warnings what came up on the way, if anything did
 * @returns {MinimizedResult} the result, carrying them only when there are any
 */
function withWarnings(code, warnings) {
  return warnings.length > 0 ? { code, warnings } : { code };
}

/* istanbul ignore next */
/**
 * Minify an image using `@napi-rs/image`, re-encoding it as the format its name
 * already claims.
 * @param {Input} input input
 * @param {RawSourceMap=} sourceMap source map (ignored for images)
 * @param {CustomOptions=} minimizerOptions options
 * @returns {Promise<MinimizedResult>} minimized result
 */
async function napiRsImageMinify(input, sourceMap, minimizerOptions) {
  /**
   * @typedef {object} NapiRsImageMinifyOptions
   * @property {{ width?: number, height?: number, fit?: number, filter?: number }=} resize resize the image before re-encoding it
   * @property {number | "auto"=} rotate turn by a quarter, half or three quarters, or by what the EXIF orientation says
   * @property {boolean=} flip mirror vertically
   * @property {boolean=} flop mirror horizontally
   * @property {boolean=} grayscale drop the colour
   * @property {boolean=} invert invert the colour
   * @property {number=} blur blur by this sigma
   * @property {{ [format: string]: EXPECTED_OBJECT }=} encodeOptions per-format options, keyed by the format's own name — `avif`, `jpeg`, `png`, `webp`
   *
   * Every one of these can also be asked for by the asset's own name — see
   * `NAPI_RS_IMAGE_QUERY_PARAMETERS` — and the name wins where both say
   * something.
   */
  const [[name, code]] = Object.entries(input);
  const format = NAPI_RS_IMAGE_FORMATS.get(extensionOf(name));

  // `filter` offers only what the map holds, so a name reaching here without
  // one came from a caller that dispatched by something else.
  if (typeof format === "undefined") {
    return { code };
  }

  const options = /** @type {NapiRsImageMinifyOptions} */ (
    minimizerOptions || {}
  );
  const requested = readQuery(name, NAPI_RS_IMAGE_QUERY_PARAMETER_BY_SPELLING);
  const resize = mergeRequested(options.resize, requested && requested.resize);
  const orient = /** @type {QueryValues} */ (
    mergeRequested(
      { rotate: options.rotate, flip: options.flip, flop: options.flop },
      requested && requested.orient,
    )
  );
  const pipeline = /** @type {QueryValues} */ (
    mergeRequested(
      {
        grayscale: options.grayscale,
        invert: options.invert,
        blur: options.blur,
      },
      requested && requested.pipeline,
    )
  );
  const encodeOptions = /** @type {QueryValues} */ (
    mergeRequested(
      (options.encodeOptions && options.encodeOptions[format]) || {},
      requested && requested.encode,
    )
  );

  const image = require("@napi-rs/image");

  const encoder =
    /** @type {NonNullable<ReturnType<typeof NAPI_RS_IMAGE_ENCODERS.get>>} */
    (NAPI_RS_IMAGE_ENCODERS.get(format));

  const orientation = napiRsImageOrientation(orient);
  let turnsByExif = orient.rotate === "auto";
  const resizes =
    resize &&
    (typeof resize.width === "number" || typeof resize.height === "number");
  const operates = NAPI_RS_IMAGE_OPERATIONS.some(
    (operation) => pipeline[operation],
  );
  const blurs = typeof pipeline.blur === "number";
  const bytes = toBuffer(code);
  /** @type {EXPECTED_OBJECT | undefined} */
  let metadata;

  /**
   * The header, read at most once for the two questions below that need it.
   * Asked with its EXIF, which is the only way `orientation` comes back.
   * @returns {Promise<EXPECTED_ANY>} what the header says
   */
  const readMetadata = async () => {
    metadata = metadata || (await new image.Transformer(bytes).metadata(true));

    return metadata;
  };

  // Decoding and encoding again costs some twenty times what reading the
  // header does, so an image whose EXIF asks for nothing keeps the fast path
  // rather than paying for a turn it does not need — which is what
  // `rotate: "auto"` set for every image would otherwise cost most of them.
  if (turnsByExif && typeof orientation === "undefined") {
    const { orientation: exif } = await readMetadata();

    turnsByExif = typeof exif === "number" && exif > 1;
  }

  let sizing = resize;
  const askedHeight = resize && resize.height;

  // `resize` needs a width, so a height on its own is turned into the width
  // that keeps the image's own proportions — what asking for a height alone
  // is understood to mean everywhere else.
  if (
    resizes &&
    typeof resize.width !== "number" &&
    typeof askedHeight === "number"
  ) {
    const { width, height } = await readMetadata();

    sizing = {
      ...resize,
      width: Math.max(1, Math.round((width * askedHeight) / height)),
    };
  }

  const transforms =
    resizes ||
    operates ||
    blurs ||
    turnsByExif ||
    typeof orientation !== "undefined";

  /** @type {string[]} */
  const warnings = [];

  /**
   * @param {EXPECTED_ANY} transformer a `Transformer`
   * @returns {EXPECTED_ANY} it, with everything asked for applied
   */
  const transform = (transformer) => {
    // One orientation is all `rotate` holds — a second call replaces the
    // first rather than composing — so EXIF and an explicit turn are
    // alternatives, and the explicit one is the one that was spelled out.
    if (typeof orientation !== "undefined") {
      if (turnsByExif) {
        warnings.push(
          `"napiRsImageMinify" applies one orientation, so "rotate=auto" was not applied to "${name}" alongside the turn asked for`,
        );
      }

      transformer.rotate(orientation);
    } else if (turnsByExif) {
      transformer.rotate();
    }

    for (const operation of NAPI_RS_IMAGE_OPERATIONS) {
      if (pipeline[operation]) {
        transformer[operation]();
      }
    }

    if (blurs) {
      transformer.blur(pipeline.blur);
    }

    if (resizes) {
      transformer.resize(sizing);
    }

    return transformer;
  };

  let written = bytes;

  if (encoder.repack) {
    if (transforms) {
      written = await encoder.write(
        transform(new image.Transformer(bytes)),
        encodeOptions,
      );
    }

    return withWarnings(
      await encoder.repack(image, written, encodeOptions),
      warnings,
    );
  }

  return withWarnings(
    await encoder.write(transform(new image.Transformer(bytes)), encodeOptions),
    warnings,
  );
}

/**
 * @returns {string | undefined} the minimizer version
 */
napiRsImageMinify.getMinimizerVersion = () => packageVersion("@napi-rs/image");

/**
 * The asset reaches this one as bytes rather than as text.
 * @returns {boolean} true, images are binary
 */
napiRsImageMinify.supportsBinary = () => true;

/**
 * A native addon whose input cannot cross the worker boundary as text, so it
 * stays in process; its own codecs thread underneath.
 * @returns {boolean} false
 */
napiRsImageMinify.supportsWorker = () => false;

/**
 * @returns {boolean} false
 */
napiRsImageMinify.supportsWorkerThreads = () => false;

/**
 * @param {string} name asset name
 * @returns {boolean} true if `@napi-rs/image` can re-encode `name` as its own format
 */
napiRsImageMinify.filter = (name) =>
  NAPI_RS_IMAGE_FORMATS.has(extensionOf(name));

/**
 * Resolve the `plugins` entry of an `imagemin` configuration to the plugin
 * functions it names, importing each one.
 * @param {EXPECTED_OBJECT=} imageminConfig imagemin configuration
 * @returns {Promise<EXPECTED_OBJECT>} the configuration with resolved plugins
 */
async function imageminNormalizeConfig(imageminConfig) {
  const config =
    /** @type {{ plugins?: (string | [string, EXPECTED_OBJECT])[] }} */
    (imageminConfig || {});

  if (!Array.isArray(config.plugins) || config.plugins.length === 0) {
    throw new Error(
      "No plugins found for `imagemin`, please read documentation",
    );
  }

  const plugins = [];

  for (const plugin of config.plugins) {
    const isPluginArray = Array.isArray(plugin);
    const pluginName = isPluginArray ? plugin[0] : plugin;

    if (typeof pluginName !== "string") {
      throw new Error(
        `Invalid plugin configuration '${JSON.stringify(
          plugin,
        )}', plugin configuration should be 'string' or '[string, object]'`,
      );
    }

    const pluginOptions = isPluginArray ? plugin[1] : undefined;
    const prefixed = pluginName.startsWith("imagemin")
      ? pluginName
      : `imagemin-${pluginName}`;
    let requiredPlugin;

    const load = getDynamicImport();

    try {
      requiredPlugin = (await load(prefixed)).default(pluginOptions);
    } catch (_err) {
      try {
        requiredPlugin = (await load(pluginName)).default(pluginOptions);
      } catch (error) {
        throw new Error(
          `Unknown plugin: ${prefixed}\n\nDid you forget to install the plugin?\nYou can install it with:\n\n$ npm install ${prefixed} --save-dev\n$ yarn add ${prefixed} --dev`,
          { cause: error },
        );
      }
    }

    plugins.push(requiredPlugin);
  }

  return { ...config, plugins };
}

/* istanbul ignore next */
/**
 * Minify an image using `imagemin` and the plugins named in the options.
 * @param {Input} input input
 * @param {RawSourceMap=} sourceMap source map (ignored for images)
 * @param {CustomOptions=} minimizerOptions options
 * @returns {Promise<MinimizedResult>} minimized result
 */
async function imageminMinify(input, sourceMap, minimizerOptions) {
  const [[name, code]] = Object.entries(input);
  const normalized = await imageminNormalizeConfig(minimizerOptions);
  const imagemin = (await getDynamicImport()("imagemin")).default;
  const result = await imagemin.buffer(
    toBuffer(code),
    /** @type {EXPECTED_ANY} */ (normalized),
  );
  // imagemin@8 answers with a Buffer, imagemin@9 with a Uint8Array.
  const minified = Buffer.isBuffer(result) ? result : Buffer.from(result);

  const { canonicalExtension, fileTypeFromBuffer } = require("./fileType.js");

  const inputExtension = canonicalExtension(extensionOf(name));
  const detected = fileTypeFromBuffer(minified);
  const outputExtension = detected && canonicalExtension(detected.ext);

  // A plugin that converted the image wrote a format this asset's name does not
  // claim. Nothing here can rename the asset, so the original is kept.
  if (inputExtension && outputExtension && inputExtension !== outputExtension) {
    return {
      code,
      warnings: [
        `"imageminMinify" does not support generating "${outputExtension}" from "${name}", the original was kept`,
      ],
    };
  }

  return { code: minified };
}

/* istanbul ignore next */
/**
 * Re-encode an image with `imagemin`, renaming it when a plugin wrote another
 * format.
 *
 * Which format is written is the plugins' to decide -- `imagemin-webp` writes
 * webp -- so it is read back off the bytes rather than asked for by name, and
 * an asset a plugin left in its own format is simply not renamed.
 * @param {Input} input input
 * @param {RawSourceMap=} sourceMap source map (ignored for images)
 * @param {CustomOptions=} minimizerOptions options
 * @returns {Promise<MinimizedResult>} generated result
 */
async function imageminGenerate(input, sourceMap, minimizerOptions) {
  const [[name, code]] = Object.entries(input);
  const normalized = await imageminNormalizeConfig(minimizerOptions);
  const imagemin = (await getDynamicImport()("imagemin")).default;
  const result = await imagemin.buffer(
    toBuffer(code),
    /** @type {EXPECTED_ANY} */ (normalized),
  );
  // imagemin@8 answers with a Buffer, imagemin@9 with a Uint8Array.
  const generated = Buffer.isBuffer(result) ? result : Buffer.from(result);

  const { canonicalExtension, fileTypeFromBuffer } = require("./fileType.js");

  const inputExtension = canonicalExtension(extensionOf(name));
  const detected = fileTypeFromBuffer(generated);
  const outputExtension = detected && canonicalExtension(detected.ext);

  if (outputExtension && inputExtension !== outputExtension) {
    return {
      code: generated,
      filename: replaceExtension(name, outputExtension),
    };
  }

  return { code: generated };
}

/**
 * @returns {string | undefined} the minimizer version
 */
imageminGenerate.getMinimizerVersion = () => packageVersion("imagemin");

/**
 * The asset reaches this one as bytes rather than as text.
 * @returns {boolean} true, images are binary
 */
imageminGenerate.supportsBinary = () => true;

/**
 * Its plugins shell out to native binaries of their own, and its input cannot
 * cross the worker boundary as text, so it stays in process.
 * @returns {boolean} false
 */
imageminGenerate.supportsWorker = () => false;

/**
 * @returns {boolean} false
 */
imageminGenerate.supportsWorkerThreads = () => false;

/**
 * @param {string} name asset name
 * @returns {boolean} true if `name` looks like an image
 */
imageminGenerate.filter = (name) => IMAGE_FILE_RE.test(name);

/**
 * @returns {string | undefined} the minimizer version
 */
imageminMinify.getMinimizerVersion = () => packageVersion("imagemin");

/**
 * The asset reaches this one as bytes rather than as text.
 * @returns {boolean} true, images are binary
 */
imageminMinify.supportsBinary = () => true;

/**
 * Its plugins shell out to native binaries of their own, and its input cannot
 * cross the worker boundary as text, so it stays in process.
 * @returns {boolean} false
 */
imageminMinify.supportsWorker = () => false;

/**
 * @returns {boolean} false
 */
imageminMinify.supportsWorkerThreads = () => false;

/**
 * @param {string} name asset name
 * @returns {boolean} true if `name` looks like an image
 */
imageminMinify.filter = (name) => IMAGE_FILE_RE.test(name);

/* istanbul ignore next */
/**
 * Minify an SVG using `svgo`.
 * @param {Input} input input
 * @param {RawSourceMap=} sourceMap source map (ignored for SVG)
 * @param {CustomOptions=} minimizerOptions options
 * @returns {Promise<MinimizedResult>} minimized result
 */
async function svgoMinify(input, sourceMap, minimizerOptions) {
  /**
   * @typedef {object} SvgoMinifyOptions
   * @property {Omit<import("svgo").Config, "path" | "datauri">=} encodeOptions options handed to `svgo`
   */
  const [[name, source]] = Object.entries(input);
  const code = Buffer.isBuffer(source) ? source.toString() : source;
  const { encodeOptions } = /** @type {SvgoMinifyOptions} */ (
    minimizerOptions || {}
  );

  // Read here rather than through the table the image minimizers share: this
  // function reaches a worker as source and carries no module scope with it.
  // `floatPrecision` stops at 10 because `toFixed` does, and svgo answers a
  // number outside that with a RangeError naming neither.
  const queryIndex = name.indexOf("?");
  /** @type {import("svgo").Config} */
  const asked = {};
  /** @type {{ pretty?: boolean, indent?: number }} */
  const js2svg = {};

  if (queryIndex !== -1) {
    const text = name.slice(queryIndex + 1);
    const fragmentIndex = text.indexOf("#");

    for (const [spelling, value] of new URLSearchParams(
      fragmentIndex === -1 ? text : text.slice(0, fragmentIndex),
    )) {
      const lowered = value.toLowerCase();
      const flag =
        lowered === "" ||
        lowered === "true" ||
        lowered === "1" ||
        lowered === "yes"
          ? true
          : lowered === "false" || lowered === "0" || lowered === "no"
            ? false
            : undefined;
      const number = Number(value);
      const whole =
        value.trim() !== "" &&
        Number.isInteger(number) &&
        number >= 0 &&
        number <= 10
          ? number
          : undefined;

      // `floatPrecision` is svgo's own name for it and `precision` the short
      // one, so dropping the prefix leaves one spelling to match.
      switch (spelling.toLowerCase().replace("float", "")) {
        case "precision":
          if (typeof whole !== "undefined") {
            asked.floatPrecision = whole;
          }

          break;
        case "multipass":
          if (typeof flag !== "undefined") {
            asked.multipass = flag;
          }

          break;
        case "pretty":
          if (typeof flag !== "undefined") {
            js2svg.pretty = flag;
          }

          break;
        case "indent":
          if (typeof whole !== "undefined") {
            js2svg.indent = whole;
          }

          break;
        default:
      }
    }
  }

  /** @type {import("svgo")} */
  // eslint-disable-next-line import/no-unresolved
  const { optimize } = require("svgo");

  const result = optimize(code, {
    path: name,
    ...encodeOptions,
    ...asked,
    ...(Object.keys(js2svg).length > 0
      ? { js2svg: { ...(encodeOptions && encodeOptions.js2svg), ...js2svg } }
      : {}),
  });

  return { code: result.data };
}

/**
 * @returns {string | undefined} the minimizer version
 */
svgoMinify.getMinimizerVersion = () => packageVersion("svgo");

/**
 * @returns {boolean} true
 */
svgoMinify.supportsWorkerThreads = () => true;

/**
 * The language this minifies, for a caller dispatching source that carries
 * no filename of its own — an `asset/inline` SVG reaches this and no asset.
 * @returns {string[]} the languages
 */
svgoMinify.getTypes = () => ["svg"];

/**
 * @param {string} name asset name
 * @returns {boolean} true if `name` looks like an SVG file
 */
svgoMinify.filter = (name) => SVG_FILE_RE.test(name);

/**
 * @template T
 * @typedef {() => T} FunctionReturning
 */

/**
 * @template T
 * @param {FunctionReturning<T>} fn memorized function
 * @returns {FunctionReturning<T>} new function
 */
function memoize(fn) {
  let cache = false;
  /** @type {T} */
  let result;

  return () => {
    if (cache) {
      return result;
    }
    result = fn();
    cache = true;
    // Allow to clean up memory for fn
    // and all dependent resources
    /** @type {FunctionReturning<T> | undefined} */
    (fn) = undefined;
    return /** @type {T} */ (result);
  };
}

module.exports = {
  CLASSIC_SCRIPT,
  EVENT_HANDLER,
  MODULE_SCRIPT,
  asFunction,
  cleanCssMinify,
  cssnanoMinify,
  cssoMinify,
  esbuildMinify,
  esbuildMinifyCss,
  functionBody,
  getEcmaVersion,
  getMinimizerOptionsAt,
  htmlMinifierTerser,
  imageminGenerate,
  imageminMinify,
  imageminNormalizeConfig,
  interpolateSize,
  isDescriptor,
  isPresets,
  jsonMinify,
  lightningCssMinify,
  memoize,
  minifyHtmlNode,
  napiRsImageMinify,
  normalizeMinimizers,
  packageVersion,
  readPreset,
  replaceExtension,
  sharpGenerate,
  sharpMinify,
  svgoMinify,
  swcMinify,
  swcMinifyCss,
  swcMinifyHtml,
  swcMinifyHtmlFragment,
  terserMinify,
  throttleAll,
  uglifyJsMinify,
};
