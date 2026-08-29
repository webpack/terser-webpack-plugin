export type Task<T> = () => Promise<T>;
export type QueryParameter = {
  spellings: string[];
  group: string;
  name: string;
  read: (value: string) => EXPECTED_ANY;
};
export type FunctionReturning<T> = () => T;
export type ExtractCommentsOptions =
  import("./index.js").ExtractCommentsOptions;
export type ExtractCommentsFunction =
  import("./index.js").ExtractCommentsFunction;
export type ExtractCommentsCondition =
  import("./index.js").ExtractCommentsCondition;
export type Input = import("./index.js").Input;
export type MinimizedResult = import("./index.js").MinimizedResult;
export type CustomOptions = import("./index.js").CustomOptions;
export type RawSourceMap = import("./index.js").RawSourceMap;
export type EXPECTED_OBJECT = import("./index.js").EXPECTED_OBJECT;
export type EXPECTED_ANY = import("./index.js").EXPECTED_ANY;
export type ExtractedComments = string[];
/**
 * A bag of parameters: whatever a table's `name`s are, read off a query or set
 * in `minimizerOptions`.
 */
export type QueryValues = {
  [name: string]: EXPECTED_ANY;
};
/**
 * Minify CSS using `clean-css`.
 * @param {Input} input input
 * @param {RawSourceMap=} sourceMap source map
 * @param {CustomOptions=} minimizerOptions options
 * @returns {Promise<MinimizedResult>} minimized result
 */
export function cleanCssMinify(
  input: Input,
  sourceMap?: RawSourceMap | undefined,
  minimizerOptions?: CustomOptions | undefined,
): Promise<MinimizedResult>;
export namespace cleanCssMinify {
  /**
   * @returns {string | undefined} the minimizer version
   */
  function getMinimizerVersion(): string | undefined;
  /**
   * @returns {boolean | undefined} true if worker threads are supported
   */
  function supportsWorkerThreads(): boolean | undefined;
  /**
   * The language this minifies, for a caller dispatching source that carries
   * no filename of its own.
   * @returns {string[]} the languages
   */
  function getTypes(): string[];
  /**
   * @param {string} name asset name
   * @returns {boolean} true if `name` looks like a CSS file
   */
  function filter(name: string): boolean;
}
/**
 * Minify CSS using `cssnano` (via `postcss`).
 * @param {Input} input input
 * @param {RawSourceMap=} sourceMap source map
 * @param {CustomOptions=} minimizerOptions options
 * @returns {Promise<MinimizedResult>} minimized result
 */
export function cssnanoMinify(
  input: Input,
  sourceMap?: RawSourceMap | undefined,
  minimizerOptions?: CustomOptions | undefined,
): Promise<MinimizedResult>;
export namespace cssnanoMinify {
  /**
   * @returns {string | undefined} the minimizer version
   */
  function getMinimizerVersion(): string | undefined;
  /**
   * @returns {boolean | undefined} true if worker threads are supported
   */
  function supportsWorkerThreads(): boolean | undefined;
  /**
   * The language this minifies, for a caller dispatching source that carries
   * no filename of its own.
   * @returns {string[]} the languages
   */
  function getTypes(): string[];
  /**
   * @param {string} name asset name
   * @returns {boolean} true if `name` looks like a CSS file
   */
  function filter(name: string): boolean;
}
/**
 * Minify CSS using `csso`.
 * @param {Input} input input
 * @param {RawSourceMap=} sourceMap source map
 * @param {CustomOptions=} minimizerOptions options
 * @returns {Promise<MinimizedResult>} minimized result
 */
export function cssoMinify(
  input: Input,
  sourceMap?: RawSourceMap | undefined,
  minimizerOptions?: CustomOptions | undefined,
): Promise<MinimizedResult>;
export namespace cssoMinify {
  /**
   * @returns {string | undefined} the minimizer version
   */
  function getMinimizerVersion(): string | undefined;
  /**
   * @returns {boolean | undefined} true if worker threads are supported
   */
  function supportsWorkerThreads(): boolean | undefined;
  /**
   * The language this minifies, for a caller dispatching source that carries
   * no filename of its own.
   * @returns {string[]} the languages
   */
  function getTypes(): string[];
  /**
   * @param {string} name asset name
   * @returns {boolean} true if `name` looks like a CSS file
   */
  function filter(name: string): boolean;
}
/**
 * @param {Input} input input
 * @param {RawSourceMap=} sourceMap source map
 * @param {CustomOptions=} minimizerOptions options
 * @returns {Promise<MinimizedResult>} minimized result
 */
export function esbuildMinify(
  input: Input,
  sourceMap?: RawSourceMap | undefined,
  minimizerOptions?: CustomOptions | undefined,
): Promise<MinimizedResult>;
export namespace esbuildMinify {
  /**
   * @returns {string | undefined} the minimizer version
   */
  function getMinimizerVersion(): string | undefined;
  /**
   * @returns {boolean | undefined} true if worker thread is supported, false otherwise
   */
  function supportsWorkerThreads(): boolean | undefined;
  /**
   * The language this minifies, for a caller dispatching source that carries
   * no filename of its own.
   * @returns {string[]} the languages
   */
  function getTypes(): string[];
  /**
   * @param {string} name asset name
   * @returns {boolean} true if `name` looks like a JavaScript file
   */
  function filter(name: string): boolean;
}
/**
 * Minify CSS using `esbuild` (with the CSS loader).
 * @param {Input} input input
 * @param {RawSourceMap=} sourceMap source map
 * @param {CustomOptions=} minimizerOptions options
 * @returns {Promise<MinimizedResult>} minimized result
 */
export function esbuildMinifyCss(
  input: Input,
  sourceMap?: RawSourceMap | undefined,
  minimizerOptions?: CustomOptions | undefined,
): Promise<MinimizedResult>;
export namespace esbuildMinifyCss {
  /**
   * @returns {string | undefined} the minimizer version
   */
  function getMinimizerVersion(): string | undefined;
  /**
   * @returns {boolean | undefined} false because `esbuild` is a native binding
   */
  function supportsWorkerThreads(): boolean | undefined;
  /**
   * The language this minifies, for a caller dispatching source that carries
   * no filename of its own.
   * @returns {string[]} the languages
   */
  function getTypes(): string[];
  /**
   * @param {string} name asset name
   * @returns {boolean} true if `name` looks like a CSS file
   */
  function filter(name: string): boolean;
}
/**
 * Map a webpack `output.environment` configuration to the highest
 * ECMAScript version that the target is known to support. Returns `5`
 * when no ES2015+ features are flagged.
 * @param {NonNullable<NonNullable<import("webpack").Configuration["output"]>["environment"]>} environment environment
 * @returns {number} ecma version (5, 2015, 2017 or 2020)
 */
export function getEcmaVersion(
  environment: NonNullable<
    NonNullable<import("webpack").Configuration["output"]>["environment"]
  >,
): number;
/**
 * The options entry belonging to one minimizer: an array is parallel to the
 * implementations, a single object is shared by all of them.
 * @param {EXPECTED_ANY} minimizerOptions the options as configured
 * @param {number} index index into the implementations
 * @returns {EXPECTED_OBJECT} its options
 */
export function getMinimizerOptionsAt(
  minimizerOptions: EXPECTED_ANY,
  index: number,
): EXPECTED_OBJECT;
/**
 * Minify HTML using `html-minifier-terser`.
 * @param {Input} input input
 * @param {RawSourceMap=} sourceMap source map (ignored for HTML)
 * @param {CustomOptions=} minimizerOptions options
 * @returns {Promise<MinimizedResult>} minimized result
 */
export function htmlMinifierTerser(
  input: Input,
  sourceMap?: RawSourceMap | undefined,
  minimizerOptions?: CustomOptions | undefined,
): Promise<MinimizedResult>;
export namespace htmlMinifierTerser {
  /**
   * @returns {string | undefined} the minimizer version
   */
  function getMinimizerVersion(): string | undefined;
  /**
   * @returns {boolean | undefined} true if worker threads are supported
   */
  function supportsWorkerThreads(): boolean | undefined;
  /**
   * The language this minifies, for a caller dispatching source that carries
   * no filename of its own.
   * @returns {string[]} the languages
   */
  function getTypes(): string[];
  /**
   * @param {string} name asset name
   * @returns {boolean} true if `name` looks like an HTML file
   */
  function filter(name: string): boolean;
}
/**
 * Minify an image using `imagemin` and the plugins named in the options.
 * @param {Input} input input
 * @param {RawSourceMap=} sourceMap source map (ignored for images)
 * @param {CustomOptions=} minimizerOptions options
 * @returns {Promise<MinimizedResult>} minimized result
 */
export function imageminMinify(
  input: Input,
  sourceMap?: RawSourceMap | undefined,
  minimizerOptions?: CustomOptions | undefined,
): Promise<MinimizedResult>;
export namespace imageminMinify {
  /**
   * @returns {string | undefined} the minimizer version
   */
  function getMinimizerVersion(): string | undefined;
  /**
   * The asset reaches this one as bytes rather than as text.
   * @returns {boolean} true, images are binary
   */
  function supportsBinary(): boolean;
  /**
   * Its plugins shell out to native binaries of their own, and its input cannot
   * cross the worker boundary as text, so it stays in process.
   * @returns {boolean} false
   */
  function supportsWorker(): boolean;
  /**
   * @returns {boolean} false
   */
  function supportsWorkerThreads(): boolean;
  /**
   * @param {string} name asset name
   * @returns {boolean} true if `name` looks like an image
   */
  function filter(name: string): boolean;
}
/**
 * Resolve the `plugins` entry of an `imagemin` configuration to the plugin
 * functions it names, importing each one.
 * @param {EXPECTED_OBJECT=} imageminConfig imagemin configuration
 * @returns {Promise<EXPECTED_OBJECT>} the configuration with resolved plugins
 */
export function imageminNormalizeConfig(
  imageminConfig?: EXPECTED_OBJECT | undefined,
): Promise<EXPECTED_OBJECT>;
/**
 * @param {Input} input input
 * @param {RawSourceMap=} sourceMap source map
 * @param {CustomOptions=} minimizerOptions options
 * @returns {Promise<MinimizedResult>} minimized result
 */
export function jsonMinify(
  input: Input,
  sourceMap?: RawSourceMap | undefined,
  minimizerOptions?: CustomOptions | undefined,
): Promise<MinimizedResult>;
export namespace jsonMinify {
  function getMinimizerVersion(): string;
  function supportsWorker(): boolean;
  function supportsWorkerThreads(): boolean;
  /**
   * The language this minifies, for a caller dispatching source that carries
   * no filename of its own.
   * @returns {string[]} the languages
   */
  function getTypes(): string[];
  /**
   * @param {string} name asset name
   * @returns {boolean} true if `name` looks like a JSON file
   */
  function filter(name: string): boolean;
}
/**
 * Minify CSS using `lightningcss`.
 * @param {Input} input input
 * @param {RawSourceMap=} sourceMap source map
 * @param {CustomOptions=} minimizerOptions options
 * @returns {Promise<MinimizedResult>} minimized result
 */
export function lightningCssMinify(
  input: Input,
  sourceMap?: RawSourceMap | undefined,
  minimizerOptions?: CustomOptions | undefined,
): Promise<MinimizedResult>;
export namespace lightningCssMinify {
  /**
   * @returns {string | undefined} the minimizer version
   */
  function getMinimizerVersion(): string | undefined;
  /**
   * @returns {boolean | undefined} false because `lightningcss` is a native binding
   */
  function supportsWorkerThreads(): boolean | undefined;
  /**
   * The language this minifies, for a caller dispatching source that carries
   * no filename of its own.
   * @returns {string[]} the languages
   */
  function getTypes(): string[];
  /**
   * @param {string} name asset name
   * @returns {boolean} true if `name` looks like a CSS file
   */
  function filter(name: string): boolean;
}
/**
 * @template T
 * @typedef {() => T} FunctionReturning
 */
/**
 * @template T
 * @param {FunctionReturning<T>} fn memorized function
 * @returns {FunctionReturning<T>} new function
 */
export function memoize<T>(fn: FunctionReturning<T>): FunctionReturning<T>;
/**
 * Minify HTML using `@minify-html/node`.
 * @param {Input} input input
 * @param {RawSourceMap=} sourceMap source map (ignored for HTML)
 * @param {CustomOptions=} minimizerOptions options
 * @returns {Promise<MinimizedResult>} minimized result
 */
export function minifyHtmlNode(
  input: Input,
  sourceMap?: RawSourceMap | undefined,
  minimizerOptions?: CustomOptions | undefined,
): Promise<MinimizedResult>;
export namespace minifyHtmlNode {
  /**
   * @returns {string | undefined} the minimizer version
   */
  function getMinimizerVersion(): string | undefined;
  /**
   * @returns {boolean | undefined} false because `@minify-html/node` is a native binding
   */
  function supportsWorkerThreads(): boolean | undefined;
  /**
   * The language this minifies, for a caller dispatching source that carries
   * no filename of its own.
   * @returns {string[]} the languages
   */
  function getTypes(): string[];
  /**
   * @param {string} name asset name
   * @returns {boolean} true if `name` looks like an HTML file
   */
  function filter(name: string): boolean;
}
/**
 * Minify an image using `@napi-rs/image`, re-encoding it as the format its name
 * already claims.
 * @param {Input} input input
 * @param {RawSourceMap=} sourceMap source map (ignored for images)
 * @param {CustomOptions=} minimizerOptions options
 * @returns {Promise<MinimizedResult>} minimized result
 */
export function napiRsImageMinify(
  input: Input,
  sourceMap?: RawSourceMap | undefined,
  minimizerOptions?: CustomOptions | undefined,
): Promise<MinimizedResult>;
export namespace napiRsImageMinify {
  /**
   * @returns {string | undefined} the minimizer version
   */
  function getMinimizerVersion(): string | undefined;
  /**
   * The asset reaches this one as bytes rather than as text.
   * @returns {boolean} true, images are binary
   */
  function supportsBinary(): boolean;
  /**
   * A native addon whose input cannot cross the worker boundary as text, so it
   * stays in process; its own codecs thread underneath.
   * @returns {boolean} false
   */
  function supportsWorker(): boolean;
  /**
   * @returns {boolean} false
   */
  function supportsWorkerThreads(): boolean;
  /**
   * @param {string} name asset name
   * @returns {boolean} true if `@napi-rs/image` can re-encode `name` as its own format
   */
  function filter(name: string): boolean;
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
export function packageVersion(name: string): string | undefined;
/**
 * Replace a name's extension, keeping any query and fragment: the request that
 * asked for the conversion is still part of what the asset is named after.
 * @param {string} name asset name
 * @param {string} extension the new extension, without a dot
 * @returns {string} the renamed asset
 */
export function replaceExtension(name: string, extension: string): string;
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
export function sharpGenerate(
  input: Input,
  sourceMap?: RawSourceMap | undefined,
  minimizerOptions?: CustomOptions | undefined,
): Promise<MinimizedResult>;
export namespace sharpGenerate {
  /**
   * @returns {string | undefined} the minimizer version
   */
  function getMinimizerVersion(): string | undefined;
  /**
   * @returns {boolean} true, images are binary
   */
  function supportsBinary(): boolean;
  /**
   * @returns {boolean} false, sharp stays in process
   */
  function supportsWorker(): boolean;
  /**
   * @returns {boolean} false
   */
  function supportsWorkerThreads(): boolean;
  /**
   * @param {string} name asset name
   * @returns {boolean} true if sharp can read `name`
   */
  function filter(name: string): boolean;
}
/**
 * Minify an image using `sharp`, re-encoding it as its own format.
 * @param {Input} input input
 * @param {RawSourceMap=} sourceMap source map (ignored for images)
 * @param {CustomOptions=} minimizerOptions options
 * @returns {Promise<MinimizedResult>} minimized result
 */
export function sharpMinify(
  input: Input,
  sourceMap?: RawSourceMap | undefined,
  minimizerOptions?: CustomOptions | undefined,
): Promise<MinimizedResult>;
export namespace sharpMinify {
  /**
   * @returns {string | undefined} the minimizer version
   */
  function getMinimizerVersion(): string | undefined;
  /**
   * The asset reaches this one as bytes rather than as text.
   * @returns {boolean} true, images are binary
   */
  function supportsBinary(): boolean;
  /**
   * sharp runs its own thread pool over native code, and its input cannot cross
   * the worker boundary as text, so it stays in process.
   * @returns {boolean} false
   */
  function supportsWorker(): boolean;
  /**
   * @returns {boolean} false
   */
  function supportsWorkerThreads(): boolean;
  /**
   * @param {string} name asset name
   * @returns {boolean} true if sharp can re-encode `name` as its own format
   */
  function filter(name: string): boolean;
}
/**
 * Minify an SVG using `svgo`.
 * @param {Input} input input
 * @param {RawSourceMap=} sourceMap source map (ignored for SVG)
 * @param {CustomOptions=} minimizerOptions options
 * @returns {Promise<MinimizedResult>} minimized result
 */
export function svgoMinify(
  input: Input,
  sourceMap?: RawSourceMap | undefined,
  minimizerOptions?: CustomOptions | undefined,
): Promise<MinimizedResult>;
export namespace svgoMinify {
  /**
   * @returns {string | undefined} the minimizer version
   */
  function getMinimizerVersion(): string | undefined;
  /**
   * @returns {boolean} true
   */
  function supportsWorkerThreads(): boolean;
  /**
   * The language this minifies, for a caller dispatching source that carries
   * no filename of its own — an `asset/inline` SVG reaches this and no asset.
   * @returns {string[]} the languages
   */
  function getTypes(): string[];
  /**
   * @param {string} name asset name
   * @returns {boolean} true if `name` looks like an SVG file
   */
  function filter(name: string): boolean;
}
/**
 * @param {Input} input input
 * @param {RawSourceMap=} sourceMap source map
 * @param {CustomOptions=} minimizerOptions options
 * @param {ExtractCommentsOptions=} extractComments extract comments option
 * @returns {Promise<MinimizedResult>} minimized result
 */
export function swcMinify(
  input: Input,
  sourceMap?: RawSourceMap | undefined,
  minimizerOptions?: CustomOptions | undefined,
  extractComments?: ExtractCommentsOptions | undefined,
): Promise<MinimizedResult>;
export namespace swcMinify {
  /**
   * @returns {string | undefined} the minimizer version
   */
  function getMinimizerVersion(): string | undefined;
  /**
   * @returns {boolean | undefined} true if worker thread is supported, false otherwise
   */
  function supportsWorkerThreads(): boolean | undefined;
  /**
   * The language this minifies, for a caller dispatching source that carries
   * no filename of its own.
   * @returns {string[]} the languages
   */
  function getTypes(): string[];
  /**
   * @param {string} name asset name
   * @returns {boolean} true if `name` looks like a JavaScript file
   */
  function filter(name: string): boolean;
}
/**
 * Minify CSS using `@swc/css`.
 * @param {Input} input input
 * @param {RawSourceMap=} sourceMap source map
 * @param {CustomOptions=} minimizerOptions options
 * @returns {Promise<MinimizedResult>} minimized result
 */
export function swcMinifyCss(
  input: Input,
  sourceMap?: RawSourceMap | undefined,
  minimizerOptions?: CustomOptions | undefined,
): Promise<MinimizedResult>;
export namespace swcMinifyCss {
  /**
   * @returns {string | undefined} the minimizer version
   */
  function getMinimizerVersion(): string | undefined;
  /**
   * @returns {boolean | undefined} false because `@swc/css` is a native binding
   */
  function supportsWorkerThreads(): boolean | undefined;
  /**
   * The language this minifies, for a caller dispatching source that carries
   * no filename of its own.
   * @returns {string[]} the languages
   */
  function getTypes(): string[];
  /**
   * @param {string} name asset name
   * @returns {boolean} true if `name` looks like a CSS file
   */
  function filter(name: string): boolean;
}
/**
 * Minify a complete HTML document using `@swc/html`.
 * @param {Input} input input
 * @param {RawSourceMap=} sourceMap source map (ignored for HTML)
 * @param {CustomOptions=} minimizerOptions options
 * @returns {Promise<MinimizedResult>} minimized result
 */
export function swcMinifyHtml(
  input: Input,
  sourceMap?: RawSourceMap | undefined,
  minimizerOptions?: CustomOptions | undefined,
): Promise<MinimizedResult>;
export namespace swcMinifyHtml {
  /**
   * @returns {string | undefined} the minimizer version
   */
  function getMinimizerVersion(): string | undefined;
  /**
   * @returns {boolean | undefined} false because `@swc/html` is a native binding
   */
  function supportsWorkerThreads(): boolean | undefined;
  /**
   * The language this minifies, for a caller dispatching source that carries
   * no filename of its own.
   * @returns {string[]} the languages
   */
  function getTypes(): string[];
  /**
   * @param {string} name asset name
   * @returns {boolean} true if `name` looks like an HTML file
   */
  function filter(name: string): boolean;
}
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
export function swcMinifyHtmlFragment(
  input: Input,
  sourceMap?: RawSourceMap | undefined,
  minimizerOptions?: CustomOptions | undefined,
): Promise<MinimizedResult>;
export namespace swcMinifyHtmlFragment {
  /**
   * @returns {string | undefined} the minimizer version
   */
  function getMinimizerVersion(): string | undefined;
  /**
   * @returns {boolean | undefined} false because `@swc/html` is a native binding
   */
  function supportsWorkerThreads(): boolean | undefined;
  /**
   * The language this minifies, for a caller dispatching source that carries
   * no filename of its own.
   * @returns {string[]} the languages
   */
  function getTypes(): string[];
  /**
   * @param {string} name asset name
   * @returns {boolean} true if `name` looks like an HTML file
   */
  function filter(name: string): boolean;
}
/**
 * @param {Input} input input
 * @param {RawSourceMap=} sourceMap source map
 * @param {CustomOptions=} minimizerOptions options
 * @param {ExtractCommentsOptions=} extractComments extract comments option
 * @returns {Promise<MinimizedResult>} minimized result
 */
export function terserMinify(
  input: Input,
  sourceMap?: RawSourceMap | undefined,
  minimizerOptions?: CustomOptions | undefined,
  extractComments?: ExtractCommentsOptions | undefined,
): Promise<MinimizedResult>;
export namespace terserMinify {
  /**
   * @returns {string | undefined} the minimizer version
   */
  function getMinimizerVersion(): string | undefined;
  /**
   * @returns {boolean | undefined} true if worker thread is supported, false otherwise
   */
  function supportsWorkerThreads(): boolean | undefined;
  /**
   * The language this minifies, for a caller dispatching source that carries
   * no filename of its own.
   * @returns {string[]} the languages
   */
  function getTypes(): string[];
  /**
   * @param {string} name asset name
   * @returns {boolean} true if `name` looks like a JavaScript file
   */
  function filter(name: string): boolean;
}
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
export function throttleAll<T>(limit: number, tasks: Task<T>[]): Promise<T[]>;
/**
 * @param {Input} input input
 * @param {RawSourceMap=} sourceMap source map
 * @param {CustomOptions=} minimizerOptions options
 * @param {ExtractCommentsOptions=} extractComments extract comments option
 * @returns {Promise<MinimizedResult>} minimized result
 */
export function uglifyJsMinify(
  input: Input,
  sourceMap?: RawSourceMap | undefined,
  minimizerOptions?: CustomOptions | undefined,
  extractComments?: ExtractCommentsOptions | undefined,
): Promise<MinimizedResult>;
export namespace uglifyJsMinify {
  /**
   * @returns {string | undefined} the minimizer version
   */
  function getMinimizerVersion(): string | undefined;
  /**
   * @returns {boolean | undefined} true if worker thread is supported, false otherwise
   */
  function supportsWorkerThreads(): boolean | undefined;
  /**
   * The language this minifies, for a caller dispatching source that carries
   * no filename of its own.
   * @returns {string[]} the languages
   */
  function getTypes(): string[];
  /**
   * @param {string} name asset name
   * @returns {boolean} true if `name` looks like a JavaScript file
   */
  function filter(name: string): boolean;
}
