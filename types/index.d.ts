export = TerserPlugin;
/**
 * @template [T=import("terser").MinifyOptions]
 */
declare class TerserPlugin<T = import("terser").MinifyOptions> {
  /**
   * @private
   * @param {unknown} input Input to check
   * @returns {boolean} Whether input is a source map
   */
  private static isSourceMap;
  /**
   * @private
   * @param {unknown} warning warning
   * @param {string} file file
   * @returns {Error} built warning
   */
  private static buildWarning;
  /**
   * @private
   * @param {Error | ErrorObject | string} error error
   * @param {string} file file
   * @param {TraceMap=} sourceMap source map
   * @param {Compilation["requestShortener"]=} requestShortener request shortener
   * @returns {Error} built error
   */
  private static buildError;
  /**
   * @private
   * @param {Parallel} parallel value of the `parallel` option
   * @returns {number} number of cores for parallelism
   */
  private static getAvailableNumberOfCores;
  /**
   * @param {BasePluginOptions & DefinedDefaultMinimizerAndOptions<T>=} options options
   */
  constructor(
    options?:
      | (BasePluginOptions & DefinedDefaultMinimizerAndOptions<T>)
      | undefined,
  );
  /**
   * @private
   * @type {InternalPluginOptions<T>}
   */
  private options;
  /**
   * @private
   * @param {Compiler} compiler compiler
   * @param {Compilation} compilation compilation
   * @param {Record<string, import("webpack").sources.Source>} assets assets
   * @param {{ availableNumberOfCores: number }} optimizeOptions optimize options
   * @returns {Promise<void>}
   */
  private optimize;
  /**
   * Minify one source a module embeds in another language's output — CSS or
   * HTML reaching the bundle inside a JavaScript string literal, an
   * `asset/source` file's text, an `asset/inline` payload. No asset carries
   * this text, so there is no filename to dispatch by: it goes to whichever
   * minimizer declares `info.type` among the languages it minifies.
   * @private
   * @param {Compiler} compiler compiler
   * @param {Compilation} compilation compilation
   * @param {EmbeddedMinimizer<T>} embedded the embedded-source dispatcher
   * @param {import("webpack").sources.Source} variesOn everything the minified answer varies on beyond the source itself
   * @param {import("webpack").sources.Source} source the embedded source
   * @param {EmbeddedSourceInfo} info what it is and where it is going
   * @returns {Promise<import("webpack").sources.Source>} the minified source, or the original
   */
  private renderEmbeddedSource;
  /**
   * @param {Compiler} compiler compiler
   * @returns {void}
   */
  apply(compiler: Compiler): void;
}
declare namespace TerserPlugin {
  export {
    terserMinify,
    uglifyJsMinify,
    swcMinify,
    esbuildMinify,
    jsonMinify,
    htmlMinifierTerser,
    swcMinifyHtml,
    swcMinifyHtmlFragment,
    minifyHtmlNode,
    cssnanoMinify,
    cssoMinify,
    cleanCssMinify,
    esbuildMinifyCss,
    lightningCssMinify,
    swcMinifyCss,
    Schema,
    Compiler,
    Compilation,
    Asset,
    AssetInfo,
    TemplatePath,
    JestWorker,
    RawSourceMap,
    TraceMap,
    Rule,
    Rules,
    EXPECTED_ANY,
    EXPECTED_OBJECT,
    ExtractCommentsFunction,
    ExtractCommentsCondition,
    ExtractCommentsFilename,
    ExtractCommentsBanner,
    ExtractCommentsObject,
    ExtractCommentsOptions,
    ErrorObject,
    EmbeddedSourceInfo,
    EmbeddedSourceHooks,
    EmbeddedSource,
    RenderedEmbeddedSource,
    MinimizedResult,
    Input,
    CustomOptions,
    InferDefaultType,
    MinimizerOptions,
    BasicMinimizerImplementation,
    MinimizeFunctionHelpers,
    MinimizerImplementation,
    InternalOptions,
    MinimizerWorker,
    Parallel,
    BasePluginOptions,
    DefinedDefaultMinimizerAndOptions,
    InternalPluginOptions,
  };
}
import { terserMinify } from "./utils";
import { uglifyJsMinify } from "./utils";
import { swcMinify } from "./utils";
import { esbuildMinify } from "./utils";
import { jsonMinify } from "./utils";
import { htmlMinifierTerser } from "./utils";
import { swcMinifyHtml } from "./utils";
import { swcMinifyHtmlFragment } from "./utils";
import { minifyHtmlNode } from "./utils";
import { cssnanoMinify } from "./utils";
import { cssoMinify } from "./utils";
import { cleanCssMinify } from "./utils";
import { esbuildMinifyCss } from "./utils";
import { lightningCssMinify } from "./utils";
import { swcMinifyCss } from "./utils";
type Schema = import("schema-utils/declarations/validate").Schema;
type Compiler = import("webpack").Compiler;
type Compilation = import("webpack").Compilation;
type Asset = import("webpack").Asset;
type AssetInfo = import("webpack").AssetInfo;
type TemplatePath = import("webpack").TemplatePath;
type JestWorker = import("jest-worker").Worker;
type RawSourceMap = import("@jridgewell/trace-mapping").EncodedSourceMap & {
  sources: string[];
  sourcesContent?: string[];
  file: string;
};
type TraceMap = import("@jridgewell/trace-mapping").TraceMap;
type Rule = RegExp | string;
type Rules = Rule[] | Rule;
type EXPECTED_ANY = any;
type EXPECTED_OBJECT = object;
type ExtractCommentsFunction = (
  astNode: EXPECTED_ANY,
  comment: {
    value: string;
    type: "comment1" | "comment2" | "comment3" | "comment4";
    pos: number;
    line: number;
    col: number;
  },
) => boolean;
type ExtractCommentsCondition =
  | boolean
  | "all"
  | "some"
  | RegExp
  | ExtractCommentsFunction;
type ExtractCommentsFilename = TemplatePath;
type ExtractCommentsBanner =
  | boolean
  | string
  | ((commentsFile: string) => string);
type ExtractCommentsObject = {
  /**
   * condition which comments need to be expected
   */
  condition?: ExtractCommentsCondition | undefined;
  /**
   * filename for extracted comments
   */
  filename?: ExtractCommentsFilename | undefined;
  /**
   * banner in filename for extracted comments
   */
  banner?: ExtractCommentsBanner | undefined;
};
type ExtractCommentsOptions = ExtractCommentsCondition | ExtractCommentsObject;
type ErrorObject = {
  /**
   * message
   */
  message: string;
  /**
   * line number
   */
  line?: number | undefined;
  /**
   * column number
   */
  column?: number | undefined;
  /**
   * error stack trace
   */
  stack?: string | undefined;
};
/**
 * What one embedded source is and where it is going, as
 * `renderEmbeddedSource` describes it.
 */
type EmbeddedSourceInfo = {
  /**
   * the embedded source's language, e.g. `"css"`
   */
  type: string;
  /**
   * the language of the output it is embedded in
   */
  hostType: string;
  /**
   * the module being generated
   */
  module: import("webpack").Module;
};
/**
 * The two hooks webpack >= 5.110 adds. Declared here rather than read off
 * `Compilation`: the plugin supports webpack `^5.1.0`, whose types have
 * neither, and it does nothing at all where they are absent.
 */
type EmbeddedSourceHooks = {
  /**
   * offers each embedded source before it is embedded
   */
  renderEmbeddedSource?:
    | {
        tapPromise: (
          name: string,
          fn: (
            source: import("webpack").sources.Source,
            info: EmbeddedSourceInfo,
          ) => Promise<import("webpack").sources.Source>,
        ) => void;
      }
    | undefined;
  /**
   * hashes what a `renderEmbeddedSource` tap varies on
   */
  embeddedSourceHash?:
    | {
        tap: (
          name: string,
          fn: (
            module: import("webpack").Module,
            hash: {
              update: (data: string) => void;
            },
          ) => void,
        ) => void;
      }
    | undefined;
};
/**
 * One body written in another language that the minified source embeds — an
 * inline `<style>` or `<script>`, an `<svg>` subtree, a `data:` payload.
 */
type EmbeddedSource = {
  /**
   * the body's language, e.g. `"css"` / `"javascript"` / `"svg"`
   */
  type: string;
  /**
   * the body as it was written
   */
  source: string;
};
type RenderedEmbeddedSource = EmbeddedSource & {
  rendered: string;
};
type MinimizedResult = {
  /**
   * code
   */
  code?: string | undefined;
  /**
   * source map
   */
  map?: RawSourceMap | undefined;
  /**
   * errors
   */
  errors?: (Error | string)[] | undefined;
  /**
   * warnings
   */
  warnings?: (Error | string)[] | undefined;
  /**
   * extracted comments
   */
  extractedComments?: string[] | undefined;
  /**
   * what the source embeds, when the minimizer was asked to collect it
   */
  embeddedSources?: EmbeddedSource[] | undefined;
};
type Input = {
  [file: string]: string;
};
type CustomOptions = {
  [key: string]: EXPECTED_ANY;
};
type InferDefaultType<T> = T extends infer U ? U : CustomOptions;
type MinimizerOptions<T> = T extends EXPECTED_ANY[]
  ? { [P in keyof T]?: T[P] & InferDefaultType<T[P]> }
  : T & InferDefaultType<T>;
type BasicMinimizerImplementation<T> = (
  input: Input,
  sourceMap: RawSourceMap | undefined,
  minifyOptions: MinimizerOptions<T>,
  extractComments: ExtractCommentsOptions | undefined,
) => Promise<MinimizedResult> | MinimizedResult;
type MinimizeFunctionHelpers = {
  /**
   * function that returns version of minimizer
   */
  getMinimizerVersion?: (() => string | undefined) | undefined;
  /**
   * true when minimizer support worker threads, otherwise false
   */
  supportsWorkerThreads?: (() => boolean | undefined) | undefined;
  /**
   * true when minimizer support worker, otherwise false
   */
  supportsWorker?: (() => boolean | undefined) | undefined;
  /**
   * return true when the minimizer supports the asset, otherwise false. When an array of minimizers is configured, each asset is dispatched only to the minimizers whose `filter` accepts it. Assets rejected by every minimizer in the array are skipped entirely.
   */
  filter?:
    | ((name: string, info?: AssetInfo) => boolean | undefined)
    | undefined;
  /**
   * the languages this minimizer minifies, e.g. `["css"]`. Source that carries no filename — what a module embeds in another language's output — is dispatched by this rather than by `test` / `filter`, and a minimizer that declares nothing is never handed any
   */
  getTypes?: (() => string[] | undefined) | undefined;
  /**
   * the languages this minimizer can hand out from inside what it minifies, through the `collectEmbeddedSource` / `embeddedSources` options. Empty (or absent) means it nests nothing a caller can reach, and the collecting pass is not run
   */
  getEmbeddedTypes?:
    | ((minimizerOptions?: EXPECTED_OBJECT) => string[] | undefined)
    | undefined;
};
type MinimizerImplementation<T> = T extends EXPECTED_ANY[]
  ? {
      [P in keyof T]: BasicMinimizerImplementation<T[P]> &
        MinimizeFunctionHelpers;
    }
  : BasicMinimizerImplementation<T> & MinimizeFunctionHelpers;
type InternalOptions<T> = {
  /**
   * name
   */
  name: string;
  /**
   * input
   */
  input: string;
  /**
   * input source map
   */
  inputSourceMap: RawSourceMap | undefined;
  /**
   * extract comments option
   */
  extractComments: ExtractCommentsOptions | undefined;
  /**
   * minimizer
   */
  minimizer: {
    implementation: MinimizerImplementation<T>;
    options: MinimizerOptions<T>;
  };
  /**
   * true when code is a EC module, otherwise false
   */
  module?: boolean | undefined;
  /**
   * ecma version
   */
  ecma?: (number | string) | undefined;
};
type MinimizerWorker<T> = JestWorker & {
  transform: (options: string) => Promise<MinimizedResult>;
  minify: (options: InternalOptions<T>) => Promise<MinimizedResult>;
};
type Parallel = undefined | boolean | number;
type BasePluginOptions = {
  /**
   * test rule
   */
  test?: Rules | undefined;
  /**
   * include rile
   */
  include?: Rules | undefined;
  /**
   * exclude rule
   */
  exclude?: Rules | undefined;
  /**
   * extract comments options
   */
  extractComments?: ExtractCommentsOptions | undefined;
  /**
   * parallel option
   */
  parallel?: Parallel | undefined;
  /**
   * minify source one language embeds in another (default: true)
   */
  minifyEmbedded?: boolean | undefined;
};
type DefinedDefaultMinimizerAndOptions<T> =
  T extends import("terser").MinifyOptions
    ? {
        minify?: MinimizerImplementation<T> | undefined;
        minimizerOptions?: MinimizerOptions<T> | undefined;
        terserOptions?: MinimizerOptions<T> | undefined;
      }
    : {
        minify: MinimizerImplementation<T>;
        minimizerOptions?: MinimizerOptions<T> | undefined;
        terserOptions?: MinimizerOptions<T> | undefined;
      };
type InternalPluginOptions<T> = BasePluginOptions & {
  minimizer: {
    implementation: MinimizerImplementation<T>;
    options: MinimizerOptions<T>;
  };
};
