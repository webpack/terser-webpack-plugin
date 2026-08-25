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
const typesOf = (implementation) =>
  typeof implementation.getTypes === "function"
    ? implementation.getTypes() || []
    : [];

/**
 * The languages a minimizer says it can hand out from inside what it minifies,
 * through the `collectEmbeddedSource` / `embeddedSources` passes. Empty for one
 * that does not read them, and for one whose options turn them off.
 * @param {Minimizer} implementation minimizer
 * @param {EXPECTED_OBJECT} minimizerOptions the options it will run with
 * @returns {string[]} the languages
 */
const embeddedTypesOf = (implementation, minimizerOptions) =>
  typeof implementation.getEmbeddedTypes === "function"
    ? implementation.getEmbeddedTypes(minimizerOptions) || []
    : [];

/**
 * The options entry belonging to one minimizer: an array is parallel to the
 * implementations, a single object is shared by all of them.
 * @param {EXPECTED_ANY} source the `minimizerOptions` as configured
 * @param {number} index index into the implementations
 * @returns {EXPECTED_OBJECT} its options
 */
const optionsAt = (source, index) =>
  Array.isArray(source) ? source[index] || {} : source || {};

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
class EmbeddedMinimizer {
  /**
   * @param {EmbeddedMinimizerOptions<T>} options options
   */
  constructor({ implementations, minimizerOptions, run }) {
    this.implementations = implementations;
    this.minimizerOptions = minimizerOptions;
    this.run = run;
    /**
     * Every language some configured minimizer claims — what this plugin can
     * be asked for at all.
     * @type {Set<string>}
     */
    this.types = new Set();

    for (const implementation of implementations) {
      for (const type of typesOf(implementation)) {
        this.types.add(type);
      }
    }
  }

  /**
   * The minimizers claiming `type`, in configuration order.
   * @param {string} type the language to minify
   * @returns {number[]} indices into `implementations`
   */
  match(type) {
    const matched = [];

    for (let i = 0; i < this.implementations.length; i++) {
      if (typesOf(this.implementations[i]).includes(type)) {
        matched.push(i);
      }
    }

    return matched;
  }

  /**
   * The minimizer entry one dispatch hands to `minify`.
   * @param {number[]} matched indices the language dispatched to
   * @returns {{ implementation: MinimizerImplementation<T>, options: MinimizerOptions<T> }} the minimizer entry
   */
  minimizerFor(matched) {
    return {
      implementation:
        /** @type {MinimizerImplementation<T>} */
        (
          /** @type {unknown} */
          (matched.map((i) => this.implementations[i]))
        ),
      options:
        /** @type {MinimizerOptions<T>} */
        (
          /** @type {unknown} */
          (matched.map((i) => optionsAt(this.minimizerOptions, i)))
        ),
    };
  }

  /**
   * The languages this run could both be offered and do something with. Empty
   * means the collecting pass would only ever be told about bodies nothing here
   * minifies, so it is not worth running.
   * @param {InternalOptions<T>} options what to minify
   * @returns {string[]} the languages
   */
  reachableTypes(options) {
    const { implementation } = options.minimizer;
    const implementations = Array.isArray(implementation)
      ? implementation
      : [implementation];
    const reachable = new Set();

    for (let i = 0; i < implementations.length; i++) {
      for (const type of embeddedTypesOf(
        /** @type {Minimizer} */ (implementations[i]),
        optionsAt(options.minimizer.options, i),
      )) {
        if (this.types.has(type)) {
          reachable.add(type);
        }
      }
    }

    return [...reachable];
  }

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
  async minify(options) {
    if (this.reachableTypes(options).length === 0) {
      return this.run(options);
    }

    const collected = await this.run(
      EmbeddedMinimizer.withOverlay(options, { collectEmbeddedSource: true }),
    );

    if (!collected.embeddedSources || collected.embeddedSources.length === 0) {
      return collected;
    }

    const { embeddedSources, errors, warnings } = await this.render(
      options.name,
      collected.embeddedSources,
    );
    // Everything nested was declined, so the collecting pass already emitted
    // what a second one would.
    const result =
      embeddedSources.length === 0
        ? collected
        : await this.run(
            EmbeddedMinimizer.withOverlay(options, { embeddedSources }),
          );

    // What went wrong inside belongs to what embeds it: there is no asset of
    // its own for it to be reported against.
    if (errors.length === 0 && warnings.length === 0) {
      return result;
    }

    return {
      ...result,
      errors: [...(result.errors || []), ...errors],
      warnings: [...(result.warnings || []), ...warnings],
    };
  }

  /**
   * Minify every nested body a minimizer claims the language of. A body no
   * minimizer claims is left out rather than handed back unchanged, so the
   * minifier that emits falls back to whatever built-in it has for it.
   * @param {string} host name of what embeds them
   * @param {EmbeddedSource[]} sources the nested bodies
   * @returns {Promise<{ embeddedSources: RenderedEmbeddedSource[], errors: (Error | string)[], warnings: (Error | string)[] }>} what each was minified to, and what was reported over them
   */
  async render(host, sources) {
    /** @type {(Error | string)[]} */
    const errors = [];
    /** @type {(Error | string)[]} */
    const warnings = [];
    const rendered = await Promise.all(
      sources.map(async ({ type, source }) => {
        const matched = this.match(type);

        if (matched.length === 0) {
          return undefined;
        }

        const result = await this.minify({
          name: host,
          input: source,
          inputSourceMap: undefined,
          extractComments: false,
          minimizer: this.minimizerFor(matched),
        });

        if (result.errors) {
          errors.push(...result.errors);
        }

        if (result.warnings) {
          warnings.push(...result.warnings);
        }

        // A nested body that failed keeps the text it was written with, which
        // is what leaving it out of the answers spells.
        if (
          (result.errors && result.errors.length > 0) ||
          typeof result.code !== "string"
        ) {
          return undefined;
        }

        return { type, source, rendered: result.code };
      }),
    );

    return {
      embeddedSources:
        /** @type {RenderedEmbeddedSource[]} */
        (rendered.filter((entry) => typeof entry !== "undefined")),
      errors,
      warnings,
    };
  }

  /**
   * @template T
   * @param {InternalOptions<T>} options what to minify
   * @param {EXPECTED_OBJECT} overlay extra options for the minimizers that read them
   * @returns {InternalOptions<T>} the same options, with the overlay applied
   */
  static withOverlay(options, overlay) {
    const { implementation } = options.minimizer;
    const implementations = Array.isArray(implementation)
      ? implementation
      : [implementation];
    const source = options.minimizer.options;

    return {
      ...options,
      minimizer: {
        implementation,
        options:
          /** @type {MinimizerOptions<T>} */
          (
            /** @type {unknown} */
            (
              implementations.map((currentImplementation, i) => {
                const entry = optionsAt(source, i);

                return typeof (
                  /** @type {Minimizer} */ (currentImplementation)
                    .getEmbeddedTypes
                ) === "function"
                  ? { ...entry, ...overlay }
                  : entry;
              })
            )
          ),
      },
    };
  }
}

module.exports = { EmbeddedMinimizer, embeddedTypesOf, typesOf };
