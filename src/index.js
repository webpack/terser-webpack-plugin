const os = require("os");
const path = require("path");

const { minify } = require("./minify");
const {
  cleanCssMinify,
  cssnanoMinify,
  cssoMinify,
  esbuildMinify,
  esbuildMinifyCss,
  getEcmaVersion,
  getMinimizerOptionsAt,
  htmlMinifierTerser,
  imageminMinify,
  imageminNormalizeConfig,
  jsonMinify,
  lightningCssMinify,
  memoize,
  minifyHtmlNode,
  napiRsImageMinify,
  sharpMinify,
  svgoMinify,
  swcMinify,
  swcMinifyCss,
  swcMinifyHtml,
  swcMinifyHtmlFragment,
  terserMinify,
  throttleAll,
  uglifyJsMinify,
} = require("./utils");

/** @typedef {import("schema-utils/declarations/validate").Schema} Schema */
/** @typedef {import("webpack").Compiler} Compiler */
/** @typedef {import("webpack").Compilation} Compilation */
/** @typedef {import("webpack").Asset} Asset */
/** @typedef {import("webpack").AssetInfo} AssetInfo */
/** @typedef {import("webpack").TemplatePath} TemplatePath */
/** @typedef {import("jest-worker").Worker} JestWorker */
/** @typedef {import("@jridgewell/trace-mapping").EncodedSourceMap & { sources: string[], sourcesContent?: string[], file: string }} RawSourceMap */
/** @typedef {import("@jridgewell/trace-mapping").TraceMap} TraceMap */

/** @typedef {RegExp | string} Rule */
/** @typedef {Rule[] | Rule} Rules */

// eslint-disable-next-line jsdoc/reject-any-type
/** @typedef {any} EXPECTED_ANY */
// eslint-disable-next-line jsdoc/require-property
/** @typedef {object} EXPECTED_OBJECT */

/**
 * @callback ExtractCommentsFunction
 * @param {EXPECTED_ANY} astNode ast Node
 * @param {{ value: string, type: "comment1" | "comment2" | "comment3" | "comment4", pos: number, line: number, col: number }} comment comment node
 * @returns {boolean} true when need to extract comment, otherwise false
 */

/**
 * @typedef {boolean | "all" | "some" | RegExp | ExtractCommentsFunction} ExtractCommentsCondition
 */

/**
 * @typedef {TemplatePath} ExtractCommentsFilename
 */

/**
 * @typedef {boolean | string | ((commentsFile: string) => string)} ExtractCommentsBanner
 */

/**
 * @typedef {object} ExtractCommentsObject
 * @property {ExtractCommentsCondition=} condition condition which comments need to be expected
 * @property {ExtractCommentsFilename=} filename filename for extracted comments
 * @property {ExtractCommentsBanner=} banner banner in filename for extracted comments
 */

/**
 * @typedef {ExtractCommentsCondition | ExtractCommentsObject} ExtractCommentsOptions
 */

/**
 * @typedef {object} ErrorObject
 * @property {string} message message
 * @property {number=} line line number
 * @property {number=} column column number
 * @property {string=} stack error stack trace
 */

/**
 * What one embedded source is and where it is going, as
 * `renderEmbeddedSource` describes it.
 * @typedef {object} EmbeddedSourceInfo
 * @property {string} type the embedded source's language, e.g. `"css"`
 * @property {string} hostType the language of the output it is embedded in
 * @property {import("webpack").Module} module the module being generated
 */

/**
 * The two hooks webpack >= 5.110 adds. Declared here rather than read off
 * `Compilation`: the plugin supports webpack `^5.1.0`, whose types have
 * neither, and it does nothing at all where they are absent.
 * @typedef {object} EmbeddedSourceHooks
 * @property {{ tapPromise: (name: string, fn: (source: import("webpack").sources.Source, info: EmbeddedSourceInfo) => Promise<import("webpack").sources.Source>) => void }=} renderEmbeddedSource offers each embedded source before it is embedded
 * @property {{ tap: (name: string, fn: (module: import("webpack").Module, hash: { update: (data: string) => void }) => void) => void }=} embeddedSourceHash hashes what a `renderEmbeddedSource` tap varies on
 */

/**
 * @typedef {object} MinimizedResult
 * @property {(string | Buffer)=} code code — a `Buffer` from a minimizer that declares `supportsBinary`
 * @property {RawSourceMap=} map source map
 * @property {(Error | string)[]=} errors errors
 * @property {(Error | string)[]=} warnings warnings
 * @property {string[]=} extractedComments extracted comments
 */

/**
 * @typedef {{ [file: string]: string | Buffer }} Input
 */

/**
 * @typedef {{ [key: string]: EXPECTED_ANY }} CustomOptions
 */

/**
 * @template T
 * @typedef {T extends infer U ? U : CustomOptions} InferDefaultType
 */

/**
 * @template T
 * @typedef {T extends EXPECTED_ANY[] ? { [P in keyof T]?: T[P] & InferDefaultType<T[P]> } : T & InferDefaultType<T>} MinimizerOptions
 */

/**
 * @template T
 * @callback BasicMinimizerImplementation
 * @param {Input} input
 * @param {RawSourceMap | undefined} sourceMap
 * @param {MinimizerOptions<T>} minifyOptions
 * @param {ExtractCommentsOptions | undefined} extractComments
 * @returns {Promise<MinimizedResult> | MinimizedResult}
 */

/**
 * @typedef {object} MinimizeFunctionHelpers
 * @property {() => string | undefined=} getMinimizerVersion function that returns version of minimizer
 * @property {() => boolean | undefined=} supportsWorkerThreads true when minimizer support worker threads, otherwise false
 * @property {() => boolean | undefined=} supportsWorker true when minimizer support worker, otherwise false
 * @property {() => boolean | undefined=} supportsBinary true when the minimizer takes the asset's bytes rather than its text — an image minimizer. Its input reaches it as a `Buffer` and its `code` may be one. Only when every minimizer an asset is dispatched to declares it, since one that does not could not read the bytes
 * @property {(name: string, info?: AssetInfo) => boolean | undefined=} filter return true when the minimizer supports the asset, otherwise false. When an array of minimizers is configured, each asset is dispatched only to the minimizers whose `filter` accepts it. Assets rejected by every minimizer in the array are skipped entirely.
 * @property {() => string[] | undefined=} getTypes the languages this minimizer minifies, e.g. `["css"]`. Source that carries no filename — what a module embeds in another language's output — is dispatched by this rather than by `test` / `filter`, and a minimizer that declares nothing is never handed any
 * @property {(minimizerOptions?: EXPECTED_OBJECT) => string[] | undefined=} getEmbeddedTypes the languages this minimizer can hand out from inside what it minifies, through the `renderEmbeddedSource` option. Empty (or absent) means it nests nothing a caller can reach, and the option is not passed
 */

/**
 * @template T
 * @typedef {T extends EXPECTED_ANY[] ? { [P in keyof T]: BasicMinimizerImplementation<T[P]> & MinimizeFunctionHelpers } : BasicMinimizerImplementation<T> & MinimizeFunctionHelpers} MinimizerImplementation
 */

/**
 * @template T
 * @typedef {object} InternalOptions
 * @property {string} name name
 * @property {string | Buffer} input input — bytes for a minimizer that declares `supportsBinary`
 * @property {RawSourceMap | undefined} inputSourceMap input source map
 * @property {ExtractCommentsOptions | undefined} extractComments extract comments option
 * @property {{ implementation: MinimizerImplementation<T>, options: MinimizerOptions<T> }} minimizer minimizer
 * @property {{ implementation: MinimizerImplementation<T>, options: MinimizerOptions<T>, claims: string[][], offers: string[][], at: number[] }=} embedded every configured minimizer, for source one language embeds in another: it carries no filename, so `minimizer` — which holds only what this asset's name matched — is not the set to dispatch it across. `claims` is the languages each minifies and `offers` the languages each can hand out, both as data and both parallel to `implementation`, since a minify function reaches a worker as source and carries none of its properties; `at` says which of them `minimizer` holds. Absent when no nested language is reachable at all
 * @property {boolean=} module true when code is a EC module, otherwise false
 * @property {number | string=} ecma ecma version
 */

/**
 * @template T
 * @typedef {JestWorker & { transform: (options: string) => Promise<MinimizedResult>, minify: (options: InternalOptions<T>) => Promise<MinimizedResult> }} MinimizerWorker
 */

/**
 * @typedef {undefined | boolean | number} Parallel
 */

/**
 * @typedef {object} BasePluginOptions
 * @property {Rules=} test test rule
 * @property {Rules=} include include rile
 * @property {Rules=} exclude exclude rule
 * @property {ExtractCommentsOptions=} extractComments extract comments options
 * @property {Parallel=} parallel parallel option
 */

/**
 * @template T
 * @typedef {T extends import("terser").MinifyOptions ? { minify?: MinimizerImplementation<T> | undefined, minimizerOptions?: MinimizerOptions<T> | undefined, terserOptions?: MinimizerOptions<T> | undefined } : { minify: MinimizerImplementation<T>, minimizerOptions?: MinimizerOptions<T> | undefined, terserOptions?: MinimizerOptions<T> | undefined }} DefinedDefaultMinimizerAndOptions
 */

/**
 * @template T
 * @typedef {BasePluginOptions & { minimizer: { implementation: MinimizerImplementation<T>, options: MinimizerOptions<T> } }} InternalPluginOptions
 */

const VALIDATION_CONFIGURATION = {
  name: "Terser Plugin",
  baseDataPath: "options",
};

const getTraceMapping = memoize(() => require("@jridgewell/trace-mapping"));
const getSerializeJavascript = memoize(() => require("./serialize-javascript"));

/**
 * @template [T=import("terser").MinifyOptions]
 */
class TerserPlugin {
  /**
   * @param {BasePluginOptions & DefinedDefaultMinimizerAndOptions<T>=} options options
   */
  constructor(options) {
    // Kept for `apply()`, which is where validation runs now: webpack owns when
    // it happens, and skips it entirely for `validate: false`.
    /**
     * @private
     * @type {BasePluginOptions & DefinedDefaultMinimizerAndOptions<T>}
     */
    this.rawOptions =
      /** @type {BasePluginOptions & DefinedDefaultMinimizerAndOptions<T>} */
      (options || {});

    // TODO handle json and etc in the next major release
    // TODO make `minimizer` option instead `minify` and `terserOptions` in the next major release, also rename `terserMinify` to `terserMinimize`
    const {
      minify = /** @type {MinimizerImplementation<T>} */ (
        /** @type {unknown} */ (terserMinify)
      ),
      minimizerOptions,
      terserOptions,
      test = /\.[cm]?js(\?.*)?$/i,
      extractComments = true,
      parallel = true,
      include,
      exclude,
    } = this.rawOptions;

    // `terserOptions` is a deprecated alias of `minimizerOptions`; prefer the
    // new name when both are provided.
    const resolvedMinimizerOptions =
      /** @type {MinimizerOptions<T>} */
      (
        typeof minimizerOptions !== "undefined"
          ? minimizerOptions
          : terserOptions || {}
      );

    /**
     * @private
     * @type {InternalPluginOptions<T>}
     */
    this.options = {
      test,
      extractComments,
      parallel,
      include,
      exclude,
      minimizer: {
        implementation: minify,
        options: resolvedMinimizerOptions,
      },
    };
  }

  /**
   * @private
   * @param {unknown} input Input to check
   * @returns {boolean} Whether input is a source map
   */
  static isSourceMap(input) {
    // All required options for `new TraceMap(...options)`
    // https://github.com/jridgewell/trace-mapping#usage
    return Boolean(
      input &&
      typeof input === "object" &&
      input !== null &&
      "version" in input &&
      "sources" in input &&
      Array.isArray(input.sources) &&
      "mappings" in input &&
      typeof input.mappings === "string",
    );
  }

  /**
   * @private
   * @param {unknown} warning warning
   * @param {string} file file
   * @returns {Error} built warning
   */
  static buildWarning(warning, file) {
    /**
     * @type {Error & { hideStack: true, file: string }}
     */
    // @ts-expect-error
    const builtWarning = new Error(warning.toString());

    builtWarning.name = "Warning";
    builtWarning.hideStack = true;
    builtWarning.file = file;

    return builtWarning;
  }

  /**
   * @private
   * @param {Error | ErrorObject | string} error error
   * @param {string} file file
   * @param {TraceMap=} sourceMap source map
   * @param {Compilation["requestShortener"]=} requestShortener request shortener
   * @returns {Error} built error
   */
  static buildError(error, file, sourceMap, requestShortener) {
    /**
     * @type {Error & { file?: string }}
     */
    let builtError;

    if (typeof error === "string") {
      builtError = new Error(`${file} from Terser plugin\n${error}`);
      builtError.file = file;

      return builtError;
    }

    if (/** @type {ErrorObject} */ (error).line) {
      const { line, column } =
        /** @type {ErrorObject & { line: number, column: number }} */ (error);
      const original =
        sourceMap &&
        getTraceMapping().originalPositionFor(sourceMap, {
          line,
          column,
        });

      if (original && original.source && requestShortener) {
        builtError = new Error(
          `${file} from Terser plugin\n${
            error.message
          } [${requestShortener.shorten(original.source)}:${original.line},${
            original.column
          }][${file}:${line},${column}]${
            error.stack
              ? `\n${error.stack.split("\n").slice(1).join("\n")}`
              : ""
          }`,
        );
        builtError.file = file;

        return builtError;
      }

      builtError = new Error(
        `${file} from Terser plugin\n${error.message} [${file}:${line},${
          column
        }]${
          error.stack ? `\n${error.stack.split("\n").slice(1).join("\n")}` : ""
        }`,
      );
      builtError.file = file;

      return builtError;
    }

    if (error.stack) {
      builtError = new Error(
        `${file} from Terser plugin\n${
          typeof error.message !== "undefined" ? error.message : ""
        }\n${error.stack}`,
      );
      builtError.file = file;

      return builtError;
    }

    builtError = new Error(`${file} from Terser plugin\n${error.message}`);
    builtError.file = file;

    return builtError;
  }

  /**
   * @private
   * @param {Parallel} parallel value of the `parallel` option
   * @returns {number} number of cores for parallelism
   */
  static getAvailableNumberOfCores(parallel) {
    // In some cases cpus() returns undefined
    // https://github.com/nodejs/node/issues/19022
    const cpus =
      // eslint-disable-next-line n/no-unsupported-features/node-builtins
      typeof os.availableParallelism === "function"
        ? // eslint-disable-next-line n/no-unsupported-features/node-builtins
          { length: os.availableParallelism() }
        : os.cpus() || { length: 1 };

    return parallel === true || typeof parallel === "undefined"
      ? cpus.length - 1
      : Math.min(parallel || 0, cpus.length - 1);
  }

  /**
   * @private
   * @param {Compiler} compiler compiler
   * @param {Compilation} compilation compilation
   * @param {Record<string, import("webpack").sources.Source>} assets assets
   * @param {{ availableNumberOfCores: number }} optimizeOptions optimize options
   * @returns {Promise<void>}
   */
  async optimize(compiler, compilation, assets, optimizeOptions) {
    const cache = compilation.getCache("TerserWebpackPlugin");
    let numberOfAssets = 0;

    const { matchPart } = compiler.webpack.ModuleFilenameHelpers;
    /**
     * Whether `test`, `include` and `exclude` accept an asset.
     *
     * An asset name carries the query and fragment of the request that made it
     * — `output.assetModuleFilename` is `[hash][ext][query][fragment]` by
     * default — so `test: /\.png$/` would match none of them. Both spellings
     * are offered: a rule naming the file accepts it whatever it carries, and
     * one naming the query still works.
     * @param {string} name asset name
     * @returns {boolean} true when the asset is to be minified
     */
    const matchesName = (name) => {
      const bare = name.replace(/[?#].*$/, "");
      const { test, include, exclude } = this.options;

      if (test && !matchPart(name, test) && !matchPart(bare, test)) {
        return false;
      }

      if (include && !matchPart(name, include) && !matchPart(bare, include)) {
        return false;
      }

      // Rejecting on either spelling, so naming the file excludes it whatever
      // it carries and naming the query still excludes it.
      return !(
        exclude &&
        (matchPart(name, exclude) || matchPart(bare, exclude))
      );
    };

    // Normalize the implementation list to an array so dispatch and the
    // worker-pool capability checks below can iterate uniformly. The
    // original shape on `this.options.minimizer.implementation` is preserved
    // for chunk hashing.
    const implementations = Array.isArray(this.options.minimizer.implementation)
      ? this.options.minimizer.implementation
      : [this.options.minimizer.implementation];

    /**
     * Collect the indices of minimizers whose `filter` accepts `name`.
     * Filters returning `undefined` are treated as accept (matches the
     * convention used by `supportsWorkerThreads`).
     * @param {string} name asset name
     * @param {AssetInfo} info asset info
     * @returns {number[]} indices into `implementations` that accept the asset
     */
    const matchingMinimizers = (name, info) => {
      const matched = [];

      for (let i = 0; i < implementations.length; i++) {
        const impl = implementations[i];

        if (
          typeof impl.filter !== "function" ||
          // eslint-disable-next-line unicorn/no-array-method-this-argument
          impl.filter(name, info) !== false
        ) {
          matched.push(i);
        }
      }

      return matched;
    };
    /** @type {Map<string, number[]>} */
    const matchedByName = new Map();

    const assetsForMinify = await Promise.all(
      Object.keys(assets)
        .filter((name) => {
          const { info } = /** @type {Asset} */ (compilation.getAsset(name));

          if (
            // Skip double minimize assets from child compilation
            info.minimized ||
            // Skip minimizing for extracted comments assets
            info.extractedComments
          ) {
            return false;
          }

          if (!matchesName(name)) {
            return false;
          }

          // Compute the matching minimizers once and carry the result to the
          // per-asset task via `matchedByName` so the regexes don't run again.
          const matched = matchingMinimizers(name, info);

          if (matched.length === 0) {
            return false;
          }

          matchedByName.set(name, matched);

          return true;
        })
        .map(async (name) => {
          const { info, source } = /** @type {Asset} */ (
            compilation.getAsset(name)
          );

          const eTag = cache.getLazyHashedEtag(source);
          const cacheItem = cache.getItemCache(name, eTag);
          const output = await cacheItem.getPromise();

          if (!output) {
            numberOfAssets += 1;
          }

          return {
            name,
            info,
            inputSource: source,
            output,
            cacheItem,
            matched: /** @type {number[]} */ (matchedByName.get(name)),
          };
        }),
    );

    if (assetsForMinify.length === 0) {
      return;
    }

    /** @type {undefined | (() => MinimizerWorker<T>)} */
    let getWorker;
    /** @type {undefined | MinimizerWorker<T>} */
    let initializedWorker;
    /** @type {undefined | number} */
    let numberOfWorkers;

    // Per implementation rather than over all of them: an asset is dispatched
    // only to the minimizers its name matched, so one that cannot run in a
    // worker — an image minimizer, whose bytes have no way across — must not
    // take the pool away from the JavaScript ones configured beside it.
    const workerCapable = implementations.map(
      (impl) =>
        typeof impl.supportsWorker === "undefined" ||
        (typeof impl.supportsWorker === "function" && impl.supportsWorker()),
    );
    const binaryCapable = implementations.map(
      (impl) =>
        typeof impl.supportsBinary === "function" && impl.supportsBinary(),
    );
    const needCreateWorker =
      optimizeOptions.availableNumberOfCores > 0 &&
      workerCapable.includes(true);

    if (needCreateWorker) {
      // Do not create unnecessary workers when the number of files is less than the available cores, it saves memory
      numberOfWorkers = Math.min(
        numberOfAssets,
        optimizeOptions.availableNumberOfCores,
      );

      getWorker = () => {
        if (initializedWorker) {
          return initializedWorker;
        }

        const { Worker } = require("jest-worker");

        initializedWorker =
          /** @type {MinimizerWorker<T>} */
          (
            new Worker(require.resolve("./minify"), {
              numWorkers: numberOfWorkers,
              // Only what can reach the pool decides how it is run.
              enableWorkerThreads: implementations.every(
                (impl, i) =>
                  !workerCapable[i] ||
                  typeof impl.supportsWorkerThreads === "undefined" ||
                  impl.supportsWorkerThreads() !== false,
              ),
            })
          );

        // https://github.com/facebook/jest/issues/8872#issuecomment-524822081
        const workerStdout = initializedWorker.getStdout();

        if (workerStdout) {
          workerStdout.on("data", (chunk) => process.stdout.write(chunk));
        }

        const workerStderr = initializedWorker.getStderr();

        if (workerStderr) {
          workerStderr.on("data", (chunk) => process.stderr.write(chunk));
        }

        return initializedWorker;
      };
    }

    const { SourceMapSource, ConcatSource, RawSource } =
      compiler.webpack.sources;

    /**
     * @param {InternalOptions<T>} options what to minify
     * @param {number[]} matched indices of the minimizers this asset is dispatched to
     * @returns {Promise<MinimizedResult>} the result
     */
    const run = (options, matched) =>
      getWorker && matched.every((i) => workerCapable[i])
        ? getWorker().transform(getSerializeJavascript()(options))
        : minify(options);

    /** @typedef {{ extractedCommentsSource: import("webpack").sources.RawSource, commentsFilename: string }} ExtractedCommentsInfo */
    /** @type {Map<string, ExtractedCommentsInfo>} */
    const allExtractedComments = new Map();
    const scheduledTasks = [];

    for (const asset of assetsForMinify) {
      scheduledTasks.push(async () => {
        const { name, inputSource, info, cacheItem, matched } = asset;
        let { output } = asset;

        if (!output) {
          let input;
          /** @type {RawSourceMap | undefined} */
          let inputSourceMap;

          const { source: sourceFromInputSource, map } =
            inputSource.sourceAndMap();

          input = sourceFromInputSource;

          if (map) {
            if (!TerserPlugin.isSourceMap(map)) {
              compilation.warnings.push(
                new Error(`${name} contains invalid source map`),
              );
            } else {
              inputSourceMap = /** @type {RawSourceMap} */ (map);
            }
          }

          // Only a minimizer that says it reads bytes gets them: every other
          // one is handed the text it has always been handed.
          if (
            Buffer.isBuffer(input) &&
            !matched.every((i) => binaryCapable[i])
          ) {
            input = input.toString();
          }

          // Dispatch to only the minimizers whose `filter` accepted this
          // asset (computed once when collecting `assetsForMinify`).
          // `minify.js` already normalizes a single implementation into a
          // one-element array, so we always hand it the matching subset.
          // Options are sliced as references — `minify.js` overlays
          // `module`/`ecma` without mutating the caller's object.
          const assetImplementation =
            /** @type {MinimizerImplementation<T>} */
            (matched.map((i) => implementations[i]));
          const sourceOptions = this.options.minimizer.options;
          const assetMinimizerOptions =
            /** @type {MinimizerOptions<T>} */
            (
              Array.isArray(sourceOptions)
                ? matched.map((i) => sourceOptions[i] || {})
                : sourceOptions
            );

          /**
           * @type {InternalOptions<T>}
           */
          const options = {
            name,
            input,
            inputSourceMap,
            minimizer: {
              implementation: assetImplementation,
              options: assetMinimizerOptions,
            },
            extractComments: this.options.extractComments,
            embedded: this.embeddedMinimizer(matched),
          };

          if (typeof info.javascriptModule !== "undefined") {
            options.module = info.javascriptModule;
          } else if (/\.mjs(\?.*)?$/i.test(name)) {
            options.module = true;
          } else if (/\.cjs(\?.*)?$/i.test(name)) {
            options.module = false;
          }

          options.ecma = getEcmaVersion(compiler.options.output.environment);

          try {
            output = await run(options, matched);
          } catch (error) {
            const hasSourceMap =
              inputSourceMap && TerserPlugin.isSourceMap(inputSourceMap);

            compilation.errors.push(
              TerserPlugin.buildError(
                /** @type {Error | ErrorObject | string} */
                (error),
                name,
                hasSourceMap
                  ? new (getTraceMapping().TraceMap)(
                      /** @type {RawSourceMap} */
                      (inputSourceMap),
                    )
                  : undefined,

                hasSourceMap ? compilation.requestShortener : undefined,
              ),
            );

            return;
          }

          if (typeof output.code === "undefined") {
            compilation.errors.push(
              new Error(
                `${name} from Terser plugin\nMinimizer doesn't return result`,
              ),
            );
          }

          if (output.warnings && output.warnings.length > 0) {
            output.warnings = output.warnings.map(
              /**
               * @param {Error | string} item a warning
               * @returns {Error} built warning with extra info
               */
              (item) => TerserPlugin.buildWarning(item, name),
            );
          }

          if (output.errors && output.errors.length > 0) {
            const hasSourceMap =
              inputSourceMap && TerserPlugin.isSourceMap(inputSourceMap);

            output.errors = output.errors.map(
              /**
               * @param {Error | string} item an error
               * @returns {Error} built error with extra info
               */
              (item) =>
                TerserPlugin.buildError(
                  item,
                  name,
                  hasSourceMap
                    ? new (getTraceMapping().TraceMap)(
                        /** @type {RawSourceMap} */
                        (inputSourceMap),
                      )
                    : undefined,

                  hasSourceMap ? compilation.requestShortener : undefined,
                ),
            );
          }

          let shebang;

          // Custom functions can return `undefined` or `null` when the
          // minimizer only produced warnings, errors or extracted comments
          if (typeof output.code !== "undefined" && output.code !== null) {
            if (
              /** @type {ExtractCommentsObject} */
              (this.options.extractComments).banner !== false &&
              output.extractedComments &&
              output.extractedComments.length > 0 &&
              typeof output.code === "string" &&
              output.code.startsWith("#!")
            ) {
              const firstNewlinePosition = output.code.indexOf("\n");

              shebang = output.code.slice(0, Math.max(0, firstNewlinePosition));
              output.code = output.code.slice(
                Math.max(0, firstNewlinePosition + 1),
              );
            }

            if (output.map) {
              output.source = new SourceMapSource(
                output.code,
                name,
                output.map,
                input,
                /** @type {RawSourceMap} */
                (inputSourceMap),
                true,
              );
            } else {
              output.source = new RawSource(output.code);
            }
          }

          if (output.extractedComments && output.extractedComments.length > 0) {
            const commentsFilename =
              /** @type {ExtractCommentsObject} */
              (this.options.extractComments).filename ||
              "[file].LICENSE.txt[query]";

            let query = "";
            let filename = name;

            const querySplit = filename.indexOf("?");

            if (querySplit >= 0) {
              query = filename.slice(querySplit);
              filename = filename.slice(0, querySplit);
            }

            const lastSlashIndex = filename.lastIndexOf("/");
            const basename =
              lastSlashIndex === -1
                ? filename
                : filename.slice(lastSlashIndex + 1);
            const data = { filename, basename, query };

            output.commentsFilename = compilation.getPath(
              commentsFilename,
              data,
            );

            // Banner only applies when we have a new source to prepend to
            if (
              output.source &&
              /** @type {ExtractCommentsObject} */
              (this.options.extractComments).banner !== false
            ) {
              let banner =
                /** @type {ExtractCommentsObject} */
                (this.options.extractComments).banner ||
                `For license information please see ${path
                  .relative(path.dirname(name), output.commentsFilename)
                  .replace(/\\/g, "/")}`;

              if (typeof banner === "function") {
                banner = banner(output.commentsFilename);
              }

              if (banner) {
                output.source = new ConcatSource(
                  shebang ? `${shebang}\n` : "",
                  `/*! ${banner} */\n`,
                  output.source,
                );
              }
            }

            const extractedCommentsString = output.extractedComments
              .sort()
              .join("\n\n");

            output.extractedCommentsSource = new RawSource(
              `${extractedCommentsString}\n`,
            );
          }

          await cacheItem.storePromise({
            source: output.source,
            errors: output.errors,
            warnings: output.warnings,
            commentsFilename: output.commentsFilename,
            extractedCommentsSource: output.extractedCommentsSource,
          });
        }

        if (output.warnings && output.warnings.length > 0) {
          for (const warning of output.warnings) {
            compilation.warnings.push(warning);
          }
        }

        if (output.errors && output.errors.length > 0) {
          for (const error of output.errors) {
            compilation.errors.push(error);
          }
        }

        // Emit extracted comments file even if the main asset was not
        // rewritten (some minimizers only produce comments / warnings / errors)
        if (output.extractedCommentsSource) {
          allExtractedComments.set(name, {
            extractedCommentsSource: output.extractedCommentsSource,
            commentsFilename: /** @type {string} */ (output.commentsFilename),
          });
        }

        if (!output.source) {
          return;
        }

        /** @type {AssetInfo} */
        const newInfo = { minimized: true };

        if (output.extractedCommentsSource) {
          newInfo.related = {
            license: /** @type {string} */ (output.commentsFilename),
          };
        }

        compilation.updateAsset(name, output.source, newInfo);
      });
    }

    // Without the pool the work runs here, so the same bound applies: a
    // minimizer that holds a whole image in memory is not one to start once
    // per asset at the same moment.
    const limit =
      getWorker && numberOfAssets > 0
        ? /** @type {number} */ (numberOfWorkers)
        : optimizeOptions.availableNumberOfCores > 0
          ? Math.min(
              scheduledTasks.length,
              optimizeOptions.availableNumberOfCores,
            )
          : scheduledTasks.length;
    await throttleAll(limit, scheduledTasks);

    if (initializedWorker) {
      await initializedWorker.end();
    }

    /** @typedef {{ source: import("webpack").sources.Source, commentsFilename: string, from: string }} ExtractedCommentsInfoWithFrom */
    await [...allExtractedComments].sort().reduce(
      /**
       * @param {Promise<unknown>} previousPromise previous result
       * @param {[string, ExtractedCommentsInfo]} extractedComments extracted comments
       * @returns {Promise<ExtractedCommentsInfoWithFrom>} extract comments with info
       */
      async (previousPromise, [from, value]) => {
        let previous =
          /** @type {ExtractedCommentsInfoWithFrom | undefined} * */ (
            await previousPromise
          );
        const { commentsFilename, extractedCommentsSource } = value;

        if (!previous || previous.commentsFilename !== commentsFilename) {
          const existingAsset = compilation.getAsset(commentsFilename);

          previous = existingAsset
            ? {
                source: existingAsset.source,
                commentsFilename,
                from: commentsFilename,
              }
            : undefined;
        }

        if (previous) {
          const { from: previousFrom, source: prevSource } = previous;
          const mergedName = `${previousFrom}|${from}`;
          const name = `${commentsFilename}|${mergedName}`;
          const eTag = [prevSource, extractedCommentsSource]
            .map((item) => cache.getLazyHashedEtag(item))
            .reduce((previousValue, currentValue) =>
              cache.mergeEtags(previousValue, currentValue),
            );

          let source = await cache.getPromise(name, eTag);

          if (!source) {
            source = new ConcatSource(
              [
                ...new Set([
                  .../** @type {string} */ (prevSource.source()).split("\n\n"),
                  .../** @type {string} */ (
                    extractedCommentsSource.source()
                  ).split("\n\n"),
                ]),
              ].join("\n\n"),
            );

            await cache.storePromise(name, eTag, source);
          }

          compilation.updateAsset(commentsFilename, source);

          return { source, commentsFilename, from: mergedName };
        }

        compilation.emitAsset(commentsFilename, extractedCommentsSource, {
          extractedComments: true,
        });

        return { source: extractedCommentsSource, commentsFilename, from };
      },
      /** @type {Promise<unknown>} */ (Promise.resolve()),
    );
  }

  /**
   * Every configured minimizer, in order. The `minify` option takes one or an
   * array; embedded source is dispatched across all of them either way.
   * @private
   * @returns {(BasicMinimizerImplementation<EXPECTED_ANY> & MinimizeFunctionHelpers)[]} the minimizers
   */
  minimizers() {
    const { implementation } = this.options.minimizer;

    return /** @type {(BasicMinimizerImplementation<EXPECTED_ANY> & MinimizeFunctionHelpers)[]} */ (
      /** @type {unknown} */ (
        Array.isArray(implementation) ? implementation : [implementation]
      )
    );
  }

  /**
   * Every configured minimizer and its options, for dispatching source one
   * language embeds in another. The asset's own entry holds only what its
   * filename matched, and a language's minimizer need not be among them — a
   * `.css` asset embedding an `<svg>` reaches an SVG minifier that claims no
   * asset at all.
   * @private
   * @param {number[]} matched indices of the minimizers this input's own entry holds
   * @returns {{ implementation: MinimizerImplementation<T>, options: MinimizerOptions<T>, claims: string[][], offers: string[][], at: number[] } | undefined} every configured minimizer, or undefined when nothing nested could be reached
   */
  embeddedMinimizer(matched) {
    const minimizers = this.minimizers();
    // What each declares travels as data, not on the function: a minify function
    // reaches a worker as its source, which carries none of its properties.
    const claims = minimizers.map((minimizer) =>
      typeof minimizer.getTypes === "function"
        ? minimizer.getTypes() || []
        : [],
    );
    const offers = minimizers.map((minimizer, i) => {
      const { getEmbeddedTypes } = minimizer;

      return typeof getEmbeddedTypes === "function"
        ? getEmbeddedTypes(
            getMinimizerOptionsAt(this.options.minimizer.options, i),
          ) || []
        : [];
    });

    // Both declarations have to meet, or offering a body would only ever reach
    // one with nowhere to go.
    if (
      !matched.some((i) =>
        offers[i].some((type) =>
          claims.some((claimed) => claimed.includes(type)),
        ),
      )
    ) {
      return undefined;
    }

    return {
      implementation:
        /** @type {MinimizerImplementation<T>} */
        (/** @type {unknown} */ (minimizers)),
      options:
        /** @type {MinimizerOptions<T>} */
        (
          /** @type {unknown} */
          (
            minimizers.map((_, i) =>
              getMinimizerOptionsAt(this.options.minimizer.options, i),
            )
          )
        ),
      claims,
      offers,
      // Which of them this input's own entry holds, so the languages it can
      // offer are read off the same arrays after a round trip through a worker.
      at: matched,
    };
  }

  /**
   * Minify one source a module embeds in another language's output — CSS or
   * HTML reaching the bundle inside a JavaScript string literal, an
   * `asset/source` file's text, an `asset/inline` payload. No asset carries
   * this text, so there is no filename to dispatch by: it goes to whichever
   * minimizer declares `info.type` among the languages it minifies.
   * @private
   * @param {Compiler} compiler compiler
   * @param {Compilation} compilation compilation
   * @param {import("webpack").sources.Source} variesOn everything the minified answer varies on beyond the source itself
   * @param {import("webpack").sources.Source} source the embedded source
   * @param {EmbeddedSourceInfo} info what it is and where it is going
   * @returns {Promise<import("webpack").sources.Source>} the minified source, or the original
   */
  async renderEmbeddedSource(compiler, compilation, variesOn, source, info) {
    const { type, hostType, module } = info;
    const minimizers = this.minimizers();
    const matched = [];

    // A minimizer that declares nothing takes no embedded source: such source
    // carries no filename to guess from, and guessing is what `getTypes`
    // replaces.
    for (let i = 0; i < minimizers.length; i++) {
      const { getTypes } = minimizers[i];

      if (typeof getTypes === "function" && (getTypes() || []).includes(type)) {
        matched.push(i);
      }
    }

    if (matched.length === 0) {
      return source;
    }

    const name = module.nameForCondition() || module.identifier();

    const cache = compilation.getCache("TerserWebpackPlugin|embeddedSource");
    // The minimizers and their options are in the etag, not just the source:
    // this cache outlives the build, so an entry stored under one set of
    // options must not answer for another.
    const cacheItem = cache.getItemCache(
      `${name}|${type}|${hostType}`,
      cache.mergeEtags(
        cache.getLazyHashedEtag(source),
        cache.getLazyHashedEtag(variesOn),
      ),
    );
    let output =
      /** @type {{ source: import("webpack").sources.Source, errors?: (Error | string)[], warnings?: (Error | string)[] } | undefined} */
      (await cacheItem.getPromise());

    if (!output) {
      const { source: sourceFromInputSource, map } = source.sourceAndMap();
      const input = Buffer.isBuffer(sourceFromInputSource)
        ? sourceFromInputSource.toString()
        : sourceFromInputSource;
      const inputSourceMap =
        map && TerserPlugin.isSourceMap(map)
          ? /** @type {RawSourceMap} */ (map)
          : undefined;

      /** @type {MinimizedResult} */
      let result;

      try {
        // Code generation runs before the worker pool is up, so this one is in
        // process. What it embeds in turn is reached by `minify` itself.
        result = await minify({
          name,
          input,
          inputSourceMap,
          // There is no asset to hang a banner on, and no filename to point
          // it at, so comments stay where the minimizer's own defaults keep
          // them.
          extractComments: false,
          minimizer: {
            implementation:
              /** @type {MinimizerImplementation<T>} */
              (/** @type {unknown} */ (matched.map((i) => minimizers[i]))),
            options:
              /** @type {MinimizerOptions<T>} */
              (
                /** @type {unknown} */
                (
                  matched.map((i) =>
                    getMinimizerOptionsAt(this.options.minimizer.options, i),
                  )
                )
              ),
          },
          embedded: this.embeddedMinimizer(matched),
          ecma: getEcmaVersion(
            /** @type {NonNullable<NonNullable<import("webpack").Configuration["output"]>["environment"]>} */
            (compiler.options.output.environment),
          ),
        });
      } catch (error) {
        compilation.errors.push(
          TerserPlugin.buildError(
            /** @type {Error | ErrorObject | string} */ (error),
            name,
          ),
        );

        return source;
      }

      const { RawSource, SourceMapSource } = compiler.webpack.sources;
      // A map is asked for only when the input carried one: the generator
      // embedding this inlines a new one as a data URI, which costs more than
      // minifying saves.
      const minified =
        typeof result.code === "string"
          ? inputSourceMap && result.map
            ? new SourceMapSource(
                result.code,
                name,
                /** @type {RawSourceMap} */ (result.map),
                /** @type {string} */ (input),
                inputSourceMap,
                true,
              )
            : new RawSource(result.code)
          : source;

      output = {
        source: minified,
        errors: (result.errors || []).map((item) =>
          TerserPlugin.buildError(
            /** @type {Error | ErrorObject | string} */ (item),
            name,
          ),
        ),
        warnings: (result.warnings || []).map((item) =>
          TerserPlugin.buildWarning(item, name),
        ),
      };

      await cacheItem.storePromise(output);
    }

    for (const error of /** @type {Error[]} */ (output.errors || [])) {
      compilation.errors.push(error);
    }

    for (const warning of /** @type {Error[]} */ (output.warnings || [])) {
      compilation.warnings.push(warning);
    }

    return output.source;
  }

  /**
   * Validates the options the plugin was constructed with.
   * @private
   * @param {Compiler} compiler compiler
   * @returns {void}
   */
  validateOptions(compiler) {
    if (typeof compiler.validate === "function") {
      compiler.validate(
        () => /** @type {Schema} */ (require("./options.json")),
        this.rawOptions,
        VALIDATION_CONFIGURATION,
      );

      return;
    }

    // TODO remove in the next major release, when webpack >= 5.106 is the
    // minimum and `compiler.validate` is always there.
    const { validate } = require("schema-utils");

    validate(
      /** @type {Schema} */ (require("./options.json")),
      this.rawOptions,
      VALIDATION_CONFIGURATION,
    );
  }

  /**
   * @param {Compiler} compiler compiler
   * @returns {void}
   */
  apply(compiler) {
    const pluginName = this.constructor.name;

    let validated = false;
    const validateOptions = () => {
      if (validated) {
        return;
      }

      validated = true;
      this.validateOptions(compiler);
    };

    if (compiler.hooks.validate) {
      compiler.hooks.validate.tap(pluginName, validateOptions);
    }

    // TODO remove in the next major release, once every supported webpack calls
    // `validate` after it applies `optimization.minimizer`. Until then that hook
    // reaches this plugin only where it sits in `plugins`, and webpack < 5.106
    // has no such hook at all; `initialize` runs after either placement.
    compiler.hooks.initialize.tap(pluginName, validateOptions);

    const availableNumberOfCores = TerserPlugin.getAvailableNumberOfCores(
      this.options.parallel,
    );

    compiler.hooks.compilation.tap(pluginName, (compilation) => {
      const hooks =
        compiler.webpack.javascript.JavascriptModulesPlugin.getCompilationHooks(
          compilation,
        );
      /**
       * @param {BasicMinimizerImplementation<EXPECTED_ANY> & MinimizeFunctionHelpers} impl implementation
       * @returns {string} minimizer version or "0.0.0"
       */
      const getVersion = (impl) =>
        typeof impl.getMinimizerVersion !== "undefined"
          ? impl.getMinimizerVersion() || "0.0.0"
          : "0.0.0";
      const data = getSerializeJavascript()({
        minimizer: Array.isArray(this.options.minimizer.implementation)
          ? this.options.minimizer.implementation.map(getVersion)
          : getVersion(
              /** @type {BasicMinimizerImplementation<EXPECTED_ANY> & MinimizeFunctionHelpers} */
              (this.options.minimizer.implementation),
            ),
        options: this.options.minimizer.options,
      });

      hooks.chunkHash.tap(pluginName, (chunk, hash) => {
        hash.update("TerserPlugin");
        hash.update(data);
      });

      // Added in webpack 5.110: source one language embeds in another, which no
      // asset carries and `processAssets` therefore never sees.
      const embeddedHooks =
        /** @type {EmbeddedSourceHooks} */
        (/** @type {unknown} */ (compilation.hooks));

      if (
        embeddedHooks.renderEmbeddedSource &&
        embeddedHooks.embeddedSourceHash
      ) {
        // Wrapped once so the etag it yields is computed once per build.
        const variesOn = new compiler.webpack.sources.RawSource(data);

        embeddedHooks.renderEmbeddedSource.tapPromise(
          pluginName,
          (source, info) =>
            this.renderEmbeddedSource(
              compiler,
              compilation,
              variesOn,
              source,
              info,
            ),
        );
        // Module hashes are taken before code generation, so what this tap
        // varies on cannot reach the code generation cache key on its own.
        embeddedHooks.embeddedSourceHash.tap(pluginName, (module, hash) => {
          hash.update("TerserPlugin");
          hash.update(data);
        });
      }

      compilation.hooks.processAssets.tapPromise(
        {
          name: pluginName,
          stage:
            compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE,
          additionalAssets: true,
        },
        (assets) =>
          this.optimize(compiler, compilation, assets, {
            availableNumberOfCores,
          }),
      );

      compilation.hooks.statsPrinter.tap(pluginName, (stats) => {
        stats.hooks.print
          .for("asset.info.minimized")
          .tap(
            "minimizer-webpack-plugin",
            (minimized, { green, formatFlag }) =>
              minimized
                ? /** @type {(text: string) => string} */ (green)(
                    /** @type {(flag: string) => string} */ (formatFlag)(
                      "minimized",
                    ),
                  )
                : "",
          );
      });
    });
  }
}

TerserPlugin.terserMinify = terserMinify;
TerserPlugin.uglifyJsMinify = uglifyJsMinify;
TerserPlugin.swcMinify = swcMinify;
TerserPlugin.esbuildMinify = esbuildMinify;
TerserPlugin.jsonMinify = jsonMinify;
TerserPlugin.htmlMinifierTerser = htmlMinifierTerser;
TerserPlugin.swcMinifyHtml = swcMinifyHtml;
TerserPlugin.swcMinifyHtmlFragment = swcMinifyHtmlFragment;
TerserPlugin.minifyHtmlNode = minifyHtmlNode;
TerserPlugin.cssnanoMinify = cssnanoMinify;
TerserPlugin.cssoMinify = cssoMinify;
TerserPlugin.cleanCssMinify = cleanCssMinify;
TerserPlugin.esbuildMinifyCss = esbuildMinifyCss;
TerserPlugin.lightningCssMinify = lightningCssMinify;
TerserPlugin.swcMinifyCss = swcMinifyCss;
TerserPlugin.imageminMinify = imageminMinify;
TerserPlugin.imageminNormalizeConfig = imageminNormalizeConfig;
TerserPlugin.napiRsImageMinify = napiRsImageMinify;
TerserPlugin.sharpMinify = sharpMinify;
TerserPlugin.svgoMinify = svgoMinify;

module.exports = TerserPlugin;
