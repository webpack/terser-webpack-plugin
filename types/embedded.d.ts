export type EXPECTED_ANY = import("./index.js").EXPECTED_ANY;
export type EXPECTED_OBJECT = import("./index.js").EXPECTED_OBJECT;
export type EmbeddedSource = import("./index.js").EmbeddedSource;
export type RenderedEmbeddedSource =
  import("./index.js").RenderedEmbeddedSource;
export type MinimizedResult = import("./index.js").MinimizedResult;
export type MinimizeFunctionHelpers =
  import("./index.js").MinimizeFunctionHelpers;
export type RawSourceMap = import("./index.js").RawSourceMap;
export type BasicMinimizerImplementation<T> =
  import("./index.js").BasicMinimizerImplementation<T>;
export type InternalOptions<T> = import("./index.js").InternalOptions<T>;
export type MinimizerImplementation<T> =
  import("./index.js").MinimizerImplementation<T>;
export type MinimizerOptions<T> = import("./index.js").MinimizerOptions<T>;
export type Minimizer = BasicMinimizerImplementation<EXPECTED_ANY> &
  MinimizeFunctionHelpers;
export type EmbeddedMinimizerOptions<T> = {
  /**
   * every configured minimizer, in order
   */
  implementations: Minimizer[];
  /**
   * their options, an array parallel to `implementations` when it is one
   */
  minimizerOptions: MinimizerOptions<T>;
  /**
   * runs one minification, in a worker when the pool is up
   */
  run: (options: InternalOptions<T>) => Promise<MinimizedResult>;
};
/**
 * @template T
 * @typedef {object} EmbeddedMinimizerOptions
 * @property {Minimizer[]} implementations every configured minimizer, in order
 * @property {MinimizerOptions<T>} minimizerOptions their options, an array parallel to `implementations` when it is one
 * @property {(options: InternalOptions<T>) => Promise<MinimizedResult>} run runs one minification, in a worker when the pool is up
 */
/**
 * Dispatches source by the language it is written in rather than by an asset
 * name, so text that never becomes an asset — CSS or HTML inside a JavaScript
 * string literal, an `asset/source` file, a `data:` payload, an inline
 * `<style>` or `<script>` — reaches the minimizers that claim its language.
 *
 * Every language is claimed by declaration (`getTypes`) rather than inferred
 * from a filename, so what is supported is a fact a caller can read, and a
 * language nothing claims is left exactly as it was written.
 * @template T
 */
export class EmbeddedMinimizer<T> {
  /**
   * @template T
   * @param {InternalOptions<T>} options what to minify
   * @param {EXPECTED_OBJECT} overlay extra options for the minimizers that read them
   * @returns {InternalOptions<T>} the same options, with the overlay applied
   */
  static withOverlay<T_1>(
    options: InternalOptions<T_1>,
    overlay: EXPECTED_OBJECT,
  ): InternalOptions<T_1>;
  /**
   * @param {EmbeddedMinimizerOptions<T>} options options
   */
  constructor({
    implementations,
    minimizerOptions,
    run,
  }: EmbeddedMinimizerOptions<T>);
  implementations: Minimizer[];
  minimizerOptions: import("./index.js").MinimizerOptions<T>;
  run: (options: InternalOptions<T>) => Promise<MinimizedResult>;
  /**
   * Every language some configured minimizer claims — what this plugin can
   * be asked for at all.
   * @type {Set<string>}
   */
  types: Set<string>;
  /**
   * The minimizers claiming `type`, in configuration order.
   * @param {string} type the language to minify
   * @returns {number[]} indices into `implementations`
   */
  match(type: string): number[];
  /**
   * The minimizer entry one dispatch hands to `minify`.
   * @param {number[]} matched indices the language dispatched to
   * @returns {{ implementation: MinimizerImplementation<T>, options: MinimizerOptions<T> }} the minimizer entry
   */
  minimizerFor(matched: number[]): {
    implementation: MinimizerImplementation<T>;
    options: MinimizerOptions<T>;
  };
  /**
   * The languages this run could both be offered and do something with. Empty
   * means the collecting pass would only ever be told about bodies nothing here
   * minifies, so it is not worth running.
   * @param {InternalOptions<T>} options what to minify
   * @returns {string[]} the languages
   */
  reachableTypes(options: InternalOptions<T>): string[];
  /**
   * Minify one input, reaching whatever it embeds first — but only where some
   * configured minimizer claims a language this input could offer. Otherwise
   * the collecting pass would run for bodies nothing here can minify, so it is
   * skipped and this is one plain minification.
   *
   * When it does run: the minifier reports what is nested inside, each body
   * goes to whichever minimizer claims its language, and the answers are handed
   * to the pass that emits. Nothing nested — the common case — still costs one
   * pass, since the collecting pass emits exactly what an untapped one does.
   * @param {InternalOptions<T>} options what to minify
   * @returns {Promise<MinimizedResult>} the result
   */
  minify(options: InternalOptions<T>): Promise<MinimizedResult>;
  /**
   * Minify every nested body a minimizer claims the language of. A body no
   * minimizer claims is left out rather than handed back unchanged, so the
   * minifier that emits falls back to whatever built-in it has for it.
   * @param {string} host name of what embeds them
   * @param {EmbeddedSource[]} sources the nested bodies
   * @returns {Promise<{ embeddedSources: RenderedEmbeddedSource[], errors: (Error | string)[], warnings: (Error | string)[] }>} what each was minified to, and what was reported over them
   */
  render(
    host: string,
    sources: EmbeddedSource[],
  ): Promise<{
    embeddedSources: RenderedEmbeddedSource[];
    errors: (Error | string)[];
    warnings: (Error | string)[];
  }>;
}
/**
 * The languages a minimizer says it can hand out from inside what it minifies,
 * through the `collectEmbeddedSource` / `embeddedSources` passes. Empty for one
 * that does not read them, and for one whose options turn them off.
 * @param {Minimizer} implementation minimizer
 * @param {EXPECTED_OBJECT} minimizerOptions the options it will run with
 * @returns {string[]} the languages
 */
export function embeddedTypesOf(
  implementation: Minimizer,
  minimizerOptions: EXPECTED_OBJECT,
): string[];
/** @typedef {import("./index.js").EXPECTED_ANY} EXPECTED_ANY */
/** @typedef {import("./index.js").EXPECTED_OBJECT} EXPECTED_OBJECT */
/** @typedef {import("./index.js").EmbeddedSource} EmbeddedSource */
/** @typedef {import("./index.js").RenderedEmbeddedSource} RenderedEmbeddedSource */
/** @typedef {import("./index.js").MinimizedResult} MinimizedResult */
/** @typedef {import("./index.js").MinimizeFunctionHelpers} MinimizeFunctionHelpers */
/** @typedef {import("./index.js").RawSourceMap} RawSourceMap */
/**
 * @template T
 * @typedef {import("./index.js").BasicMinimizerImplementation<T>} BasicMinimizerImplementation
 */
/**
 * @template T
 * @typedef {import("./index.js").InternalOptions<T>} InternalOptions
 */
/**
 * @template T
 * @typedef {import("./index.js").MinimizerImplementation<T>} MinimizerImplementation
 */
/**
 * @template T
 * @typedef {import("./index.js").MinimizerOptions<T>} MinimizerOptions
 */
/**
 * @typedef {BasicMinimizerImplementation<EXPECTED_ANY> & MinimizeFunctionHelpers} Minimizer
 */
/**
 * The languages a minimizer says it minifies. One that says nothing takes no
 * embedded source: there is no filename to guess from, and guessing is what
 * this ability exists to replace.
 * @param {Minimizer} implementation minimizer
 * @returns {string[]} the languages
 */
export function typesOf(implementation: Minimizer): string[];
