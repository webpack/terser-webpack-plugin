<div align="center">
  <a href="https://github.com/webpack/webpack">
    <img width="200" height="200" src="https://webpack.js.org/assets/icon-square-big.svg">
  </a>
</div>

[![npm][npm]][npm-url]
[![node][node]][node-url]
[![tests][tests]][tests-url]
[![cover][cover]][cover-url]
[![discussion][discussion]][discussion-url]
[![size][size]][size-url]

# minimizer-webpack-plugin

This plugin minifies your assets in a webpack build. It ships with several
built-in minimizers covering JavaScript, JSON, HTML, CSS, and images — pick one
with the [`minify`](#minify) option and target the right files with
[`test`](#test).

JavaScript minimizers:

- [`terser`](https://github.com/terser/terser) — `MinimizerPlugin.terserMinify` (default). The same JavaScript-based minifier that webpack uses out of the box; produces small, well-tested output and supports the full set of `extractComments` modes.
- [`uglify-js`](https://github.com/mishoo/UglifyJS) — `MinimizerPlugin.uglifyJsMinify`. ES5-only minifier, useful when you specifically need UglifyJS-compatible output. Requires `npm install --save-dev uglify-js`.
- [`@swc/core`](https://github.com/swc-project/swc) — `MinimizerPlugin.swcMinify`. A very fast Rust-based JavaScript/TypeScript minifier. Requires `npm install --save-dev @swc/core`.
- [`esbuild`](https://github.com/evanw/esbuild) — `MinimizerPlugin.esbuildMinify`. An extremely fast JS bundler/minifier; legal comments are always preserved (no `extractComments` support). Requires `npm install --save-dev esbuild`.

JSON minimizer:

- `JSON.stringify` — `MinimizerPlugin.jsonMinify`. Built in (no extra dependency); supports `space` and `replacer` options.

HTML minimizers:

- [`html-minifier-terser`](https://github.com/terser/html-minifier-terser) — `MinimizerPlugin.htmlMinifierTerser`. The default HTML minimizer. JavaScript-based, no native dependency. Requires `npm install --save-dev html-minifier-terser`.
- [`@swc/html`](https://github.com/swc-project/swc) — `MinimizerPlugin.swcMinifyHtml` (full HTML documents) and `MinimizerPlugin.swcMinifyHtmlFragment` (HTML fragments, e.g. `<template>` content). Very fast Rust-based platform for the Web. Requires `npm install --save-dev @swc/html`.
- [`@minify-html/node`](https://github.com/wilsonzlin/minify-html) — `MinimizerPlugin.minifyHtmlNode`. A Rust HTML minifier optimised for speed and effectiveness. Requires `npm install --save-dev @minify-html/node`.

CSS minimizers:

- [`cssnano`](https://cssnano.github.io/cssnano/) — `MinimizerPlugin.cssnanoMinify`. The default CSS minimizer. Built on top of [PostCSS](https://postcss.org/). Requires `npm install --save-dev cssnano postcss`.
- [`csso`](https://github.com/css/csso) — `MinimizerPlugin.cssoMinify`. A CSS minifier with structural optimisations. Requires `npm install --save-dev csso`.
- [`clean-css`](https://github.com/clean-css/clean-css) — `MinimizerPlugin.cleanCssMinify`. A widely-used CSS optimiser. Requires `npm install --save-dev clean-css`.
- [`esbuild`](https://github.com/evanw/esbuild) — `MinimizerPlugin.esbuildMinifyCss`. Very fast CSS minification using esbuild's CSS loader. Requires `npm install --save-dev esbuild`.
- [`lightningcss`](https://github.com/parcel-bundler/lightningcss) — `MinimizerPlugin.lightningCssMinify`. A Rust-based CSS parser, transformer, and minifier. Requires `npm install --save-dev lightningcss`.
- [`@swc/css`](https://github.com/swc-project/swc) — `MinimizerPlugin.swcMinifyCss`. A very fast Rust-based CSS minifier. Requires `npm install --save-dev @swc/css`.

Image minimizers:

- [`sharp`](https://github.com/lovell/sharp) — `MinimizerPlugin.sharpMinify`. Re-encodes an image as the format its name already claims (`avif`, `gif`, `heif`, `jp2`, `jpeg`, `png`, `tiff`, `webp`), and can resize, rotate, flip, grayscale, blur or sharpen on the way — from the options or from the asset's own name. Requires `npm install --save-dev sharp`.
- [`svgo`](https://github.com/svg/svgo) — `MinimizerPlugin.svgoMinify`. Minifies SVG, including an `asset/inline` SVG that no `test` can match. Requires `npm install --save-dev svgo`.
- [`imagemin`](https://github.com/imagemin/imagemin) — `MinimizerPlugin.imageminMinify`. Runs the `imagemin` plugins you name. Requires `npm install --save-dev imagemin` plus each plugin.
- [`@napi-rs/image`](https://github.com/Brooooooklyn/Image) — `MinimizerPlugin.napiRsImageMinify`. Rust codecs with no system dependency; recompresses `png` losslessly with oxipng and `jpeg` with mozjpeg, and can resize, turn, mirror, grayscale, invert or blur on the way — from the options or from the asset's own name. Requires `npm install --save-dev @napi-rs/image`.

These only minify — they never change an image's format or name; see
[Images](#images).

All of the non-default minimizers are declared as **optional** peer
dependencies — install only the ones you actually use. You can also stack
multiple `MinimizerPlugin` instances in the same build to handle different
file types with different minimizers (see [Examples](#examples)).

## Getting Started

Webpack v5 comes with the latest `minimizer-webpack-plugin` out of the box.
If you are using Webpack v5 or above and wish to customize the options, you will still need to install `minimizer-webpack-plugin`.
Using Webpack v4, you have to install `terser-webpack-plugin` v4 (`minimizer-webpack-plugin` is only published for Webpack v5+).

To begin, you'll need to install `minimizer-webpack-plugin`:

```console
npm install minimizer-webpack-plugin --save-dev
```

or

```console
yarn add -D minimizer-webpack-plugin
```

or

```console
pnpm add -D minimizer-webpack-plugin
```

Then add the plugin to your `webpack` configuration. For example:

**webpack.config.js**

```js
const MinimizerPlugin = require("minimizer-webpack-plugin");

module.exports = {
  optimization: {
    minimize: true,
    minimizer: [new MinimizerPlugin()],
  },
};
```

Finally, run `webpack` using the method you normally use (e.g., via CLI or an npm script).

## Note about source maps

**Works only with `source-map`, `inline-source-map`, `hidden-source-map` and `nosources-source-map` values for the [`devtool`](https://webpack.js.org/configuration/devtool/) option.**

Why?

- `eval` wraps modules in `eval("string")` and the minimizer does not handle strings.
- `cheap` has no column information and the minimizer generates only a single line, which leaves only a single mapping.

Using supported `devtool` values enable source map generation.

## Options

- **[`test`](#test)**
- **[`include`](#include)**
- **[`exclude`](#exclude)**
- **[`parallel`](#parallel)**
- **[`minify`](#minify)**
- **[`minimizerOptions`](#minimizeroptions)**
- **[`extractComments`](#extractcomments)**

### `test`

Type:

```ts
type test = string | RegExp | (string | RegExp)[];
```

Default: `/\.m?js(\?.*)?$/i`

Test to match files against.

**webpack.config.js**

```js
module.exports = {
  optimization: {
    minimize: true,
    minimizer: [
      new MinimizerPlugin({
        test: /\.js(\?.*)?$/i,
      }),
    ],
  },
};
```

### `include`

Type:

```ts
type include = string | RegExp | (string | RegExp)[];
```

Default: `undefined`

Files to include.

**webpack.config.js**

```js
module.exports = {
  optimization: {
    minimize: true,
    minimizer: [
      new MinimizerPlugin({
        include: /\/includes/,
      }),
    ],
  },
};
```

### `exclude`

Type:

```ts
type exclude = string | RegExp | (string | RegExp)[];
```

Default: `undefined`

Files to exclude.

**webpack.config.js**

```js
module.exports = {
  optimization: {
    minimize: true,
    minimizer: [
      new MinimizerPlugin({
        exclude: /\/excludes/,
      }),
    ],
  },
};
```

### `parallel`

Type:

```ts
type parallel = boolean | number;
```

Default: `true`

Use multi-process parallel running to improve the build speed.

Default number of concurrent runs: `os.cpus().length - 1` or `os.availableParallelism() - 1` (if this function is supported).

> **Note**
>
> Parallelization can speedup your build significantly and is therefore **highly recommended**.

> **Warning**
>
> If you use **Circle CI** or any other environment that doesn't provide the real available count of CPUs then you need to explicitly set up the number of CPUs to avoid `Error: Call retries were exceeded` (see [#143](https://github.com/webpack/minimizer-webpack-plugin/issues/143), [#202](https://github.com/webpack/minimizer-webpack-plugin/issues/202)).

#### `boolean`

Enable/disable multi-process parallel running.

**webpack.config.js**

```js
module.exports = {
  optimization: {
    minimize: true,
    minimizer: [
      new MinimizerPlugin({
        parallel: true,
      }),
    ],
  },
};
```

#### `number`

Enable multi-process parallel running and set number of concurrent runs.

**webpack.config.js**

```js
module.exports = {
  optimization: {
    minimize: true,
    minimizer: [
      new MinimizerPlugin({
        parallel: 4,
      }),
    ],
  },
};
```

### `minify`

Type:

```ts
type minifyFn = (
  input: Record<string, string | Buffer>,
  sourceMap: import("@jridgewell/trace-mapping").SourceMapInput | undefined,
  minifyOptions: {
    module?: boolean | undefined;
    ecma?: import("terser").ECMA | undefined;
  },
  extractComments:
    | boolean
    | "all"
    | "some"
    | RegExp
    | ((
        astNode: any,
        comment: {
          value: string;
          type: "comment1" | "comment2" | "comment3" | "comment4";
          pos: number;
          line: number;
          col: number;
        },
      ) => boolean)
    | {
        condition?:
          | boolean
          | "all"
          | "some"
          | RegExp
          | ((
              astNode: any,
              comment: {
                value: string;
                type: "comment1" | "comment2" | "comment3" | "comment4";
                pos: number;
                line: number;
                col: number;
              },
            ) => boolean)
          | undefined;
        filename?: string | ((fileData: any) => string) | undefined;
        banner?:
          string | boolean | ((commentsFile: string) => string) | undefined;
      }
    | undefined,
) => Promise<{
  code: string;
  map?: import("@jridgewell/trace-mapping").SourceMapInput | undefined;
  errors?: (string | Error)[] | undefined;
  warnings?: (string | Error)[] | undefined;
  extractedComments?: string[] | undefined;
}>;

type minify = minifyFn | minifyFn[];
```

Default: `MinimizerPlugin.terserMinify`

Allows you to override the default minify function.
By default plugin uses [terser](https://github.com/terser/terser) package.
Useful for using and testing unpublished versions or forks.

An array of functions can also be provided. Each minimizer can expose a
`filter(name, info)` helper that decides whether it should run on a given
asset; the plugin dispatches each asset only to the minimizers whose `filter`
accepts it (or runs them all when no filter is set). All built-in minimizers
ship with a `filter` that matches their natural extension, so a single plugin
instance and a single worker pool can handle JS, CSS, HTML and JSON together
without juggling multiple `MinimizerPlugin` instances — just widen `test` to
let those asset types reach the dispatcher:

```js
new MinimizerPlugin({
  test: /\.(?:[cm]?js|css|html?|json)(\?.*)?$/i,
  minify: [
    MinimizerPlugin.terserMinify,
    MinimizerPlugin.cssnanoMinify,
    MinimizerPlugin.htmlMinifierTerser,
    MinimizerPlugin.jsonMinify,
  ],
});
```

When more than one minimizer in the array claims the same asset, the chain
semantic still applies: the output of each accepting minimizer is fed as
input to the next. The [`minimizerOptions`](#minimizeroptions) option may
be an array (index-paired with `minify`) or a single object reused by every
minimizer.

The `test` option always defaults to `/\.[cm]?js(\?.*)?$/i`. When you mix
asset types in a single plugin instance, widen `test` so non-JS assets reach
the dispatcher (for example `test: /\.(?:[cm]?js|css|html?|json)(\?.*)?$/i`).

> **Warning**
>
> **Always use `require` inside `minify` function when `parallel` option enabled**.

#### `function`

**webpack.config.js**

```js
// Can be async
const minify = (input, sourceMap, minimizerOptions, extractsComments) => {
  // The `minimizerOptions` argument contains options from the `minimizerOptions` plugin option
  // You can use `minimizerOptions.myCustomOption`

  // Custom logic for extract comments
  const { map, code } = require("uglify-module") // Or require('./path/to/uglify-module')
    .minify(input, {/* Your options for minification */});

  return { map, code, warnings: [], errors: [], extractedComments: [] };
};

// Used to regenerate `fullhash`/`chunkhash` between different implementation
// Example: you fix a bug in custom minimizer/custom function, but unfortunately webpack doesn't know about it, so you will get the same fullhash/chunkhash
// to avoid this you can provide version of your custom minimizer
// You don't need if you use only `contenthash`
minify.getMinimizerVersion = () => {
  let packageJson;

  try {
    packageJson = require("uglify-module/package.json");
  } catch (error) {
    // Ignore
  }

  return packageJson && packageJson.version;
};

// Restrict the minimizer to the assets it can actually handle. The plugin
// skips assets for which `filter` returns `false` and (when an array of
// minimizers is used) dispatches each asset only to the minimizers that
// accept it. Returning `undefined` is treated as accept.
minify.filter = (name) => /\.[cm]?js(\?.*)?$/i.test(name);

// Declare this when the minimizer reads the asset's bytes rather than its
// text — an image minimizer. Its `input` values then arrive as a `Buffer` and
// its `code` may be one. Only applied when every minimizer an asset is
// dispatched to declares it, since one that does not could not read the bytes.
minify.supportsBinary = () => true;

module.exports = {
  optimization: {
    minimize: true,
    minimizer: [
      new MinimizerPlugin({
        minimizerOptions: {
          myCustomOption: true,
        },
        minify,
      }),
    ],
  },
};
```

#### `array`

If an array of functions is passed to the `minify` option, each asset is
dispatched to the minimizers whose `filter` accepts it. When more than one
minimizer accepts the same asset the output of each is fed as input to the
next one (the chain semantic). The `minimizerOptions` option can be either an
array of option objects (index-paired with `minify`) or a single object that
will be shared by all minimizers. Warnings, errors and extracted comments
from all running minimizers are merged together.

**webpack.config.js**

```js
module.exports = {
  optimization: {
    minimize: true,
    minimizer: [
      new MinimizerPlugin({
        minify: [MinimizerPlugin.terserMinify, MinimizerPlugin.swcMinify],
        // `minimizerOptions` can be an array of options, one per `minify` entry
        minimizerOptions: [
          // Options for `MinimizerPlugin.terserMinify`
          { mangle: false },
          // Options for `MinimizerPlugin.swcMinify`
          {},
        ],
      }),
    ],
  },
};
```

A single plugin instance can also handle multiple asset types — the built-in
minimizers each ship with a `filter` matching their natural extension, so JS,
CSS, HTML and JSON can all be minified by one shared worker pool:

```js
module.exports = {
  optimization: {
    minimize: true,
    minimizer: [
      new MinimizerPlugin({
        // `test` still defaults to JS only, so widen it to catch every
        // asset type you want the dispatcher to consider.
        test: /\.(?:[cm]?js|css|html?|json)(\?.*)?$/i,
        minify: [
          MinimizerPlugin.terserMinify,
          MinimizerPlugin.cssnanoMinify,
          MinimizerPlugin.htmlMinifierTerser,
          MinimizerPlugin.jsonMinify,
        ],
      }),
    ],
  },
};
```

### `minimizerOptions`

Type:

```ts
interface minimizerOptions {
  compress?: boolean | CompressOptions;
  ecma?: ECMA;
  enclose?: boolean | string;
  ie8?: boolean;
  keep_classnames?: boolean | RegExp;
  keep_fnames?: boolean | RegExp;
  mangle?: boolean | MangleOptions;
  module?: boolean;
  nameCache?: object;
  format?: FormatOptions;
  /** @deprecated */
  output?: FormatOptions;
  parse?: ParseOptions;
  safari10?: boolean;
  sourceMap?: boolean | SourceMapOptions;
  toplevel?: boolean;
}

type options = minimizerOptions | minimizerOptions[];
```

Default: [default](https://github.com/terser/terser#minify-options)

Options for the active minimizer. With the default Terser minify, see Terser's
[minify options](https://github.com/terser/terser#minify-options).

When the [`minify`](#minify) option is an array of minimizers, `minimizerOptions`
can also be an array. Each element is passed to the minimizer at the same
index in the `minify` array. If a single object is provided instead, it is
reused for every minimizer.

> **Note**
>
> `terserOptions` is kept as a deprecated alias of `minimizerOptions` for
> backwards compatibility — passing either is equivalent. If both are set,
> `minimizerOptions` wins. Prefer `minimizerOptions` in new code.

**webpack.config.js**

```js
module.exports = {
  optimization: {
    minimize: true,
    minimizer: [
      new MinimizerPlugin({
        minimizerOptions: {
          ecma: undefined,
          parse: {},
          compress: {},
          mangle: true, // Note `mangle.properties` is `false` by default.
          module: false,
          // Deprecated
          output: null,
          format: null,
          toplevel: false,
          nameCache: null,
          ie8: false,
          keep_classnames: undefined,
          keep_fnames: false,
          safari10: false,
        },
      }),
    ],
  },
};
```

### `extractComments`

Type:

```ts
type extractComments =
  | boolean
  | string
  | RegExp
  | ((
      astNode: any,
      comment: {
        value: string;
        type: "comment1" | "comment2" | "comment3" | "comment4";
        pos: number;
        line: number;
        col: number;
      },
    ) => boolean)
  | {
      condition?:
        | boolean
        | "all"
        | "some"
        | RegExp
        | ((
            astNode: any,
            comment: {
              value: string;
              type: "comment1" | "comment2" | "comment3" | "comment4";
              pos: number;
              line: number;
              col: number;
            },
          ) => boolean)
        | undefined;
      filename?: string | ((fileData: any) => string) | undefined;
      banner?:
        string | boolean | ((commentsFile: string) => string) | undefined;
    };
```

Default: `true`

Whether comments shall be extracted to a separate file, (see [details](https://github.com/webpack/webpack/commit/71933e979e51c533b432658d5e37917f9e71595a)).

By default, extract only comments using `/^\**!|@preserve|@license|@cc_on/i` RegExp condition and remove remaining comments.

If the original file is named `foo.js`, then the comments will be stored to `foo.js.LICENSE.txt`.

The `minimizerOptions.format.comments` option specifies whether the comment will be preserved - i.e., it is possible to preserve some comments (e.g. annotations) while extracting others, or even preserve comments that have already been extracted.

#### `boolean`

Enable/disable extracting comments.

**webpack.config.js**

```js
module.exports = {
  optimization: {
    minimize: true,
    minimizer: [
      new MinimizerPlugin({
        extractComments: true,
      }),
    ],
  },
};
```

#### `string`

Extract `all` or `some` (use the `/^\**!|@preserve|@license|@cc_on/i` RegExp) comments.

**webpack.config.js**

```js
module.exports = {
  optimization: {
    minimize: true,
    minimizer: [
      new MinimizerPlugin({
        extractComments: "all",
      }),
    ],
  },
};
```

#### `RegExp`

All comments that match the given expression will be extracted to a separate file.

**webpack.config.js**

```js
module.exports = {
  optimization: {
    minimize: true,
    minimizer: [
      new MinimizerPlugin({
        extractComments: /@extract/i,
      }),
    ],
  },
};
```

#### `function`

All comments that match the given expression will be extracted to a separate file.

**webpack.config.js**

```js
module.exports = {
  optimization: {
    minimize: true,
    minimizer: [
      new MinimizerPlugin({
        extractComments: (astNode, comment) => {
          if (/@extract/i.test(comment.value)) {
            return true;
          }

          return false;
        },
      }),
    ],
  },
};
```

#### `object`

Allows you to customize condition for extracting comments, and specify the extracted file name and banner.

**webpack.config.js**

```js
module.exports = {
  optimization: {
    minimize: true,
    minimizer: [
      new MinimizerPlugin({
        extractComments: {
          condition: /^\**!|@preserve|@license|@cc_on/i,
          filename: (fileData) =>
            // The "fileData" argument contains object with "filename", "basename", "query" and "hash"
            `${fileData.filename}.LICENSE.txt${fileData.query}`,
          banner: (licenseFile) =>
            `License information can be found in ${licenseFile}`,
        },
      }),
    ],
  },
};
```

##### `condition`

Type:

```ts
type condition =
  | boolean
  | "all"
  | "some"
  | RegExp
  | ((
      astNode: any,
      comment: {
        value: string;
        type: "comment1" | "comment2" | "comment3" | "comment4";
        pos: number;
        line: number;
        col: number;
      },
    ) => boolean)
  | undefined;
```

The condition that determines which comments should be extracted.

**webpack.config.js**

```js
module.exports = {
  optimization: {
    minimize: true,
    minimizer: [
      new MinimizerPlugin({
        extractComments: {
          condition: "some",
          filename: (fileData) =>
            // The "fileData" argument contains object with "filename", "basename", "query" and "hash"
            `${fileData.filename}.LICENSE.txt${fileData.query}`,
          banner: (licenseFile) =>
            `License information can be found in ${licenseFile}`,
        },
      }),
    ],
  },
};
```

##### `filename`

Type:

```ts
type filename = string | ((fileData: any) => string) | undefined;
```

Default: `[file].LICENSE.txt[query]`

Available placeholders: `[file]`, `[query]` and `[filebase]` (`[base]` for webpack 5).

The file where the extracted comments will be stored.

Default is to append the suffix `.LICENSE.txt` to the original filename.

> **Warning**
>
> We highly recommend using the `.txt` extension. Using `.js`/`.cjs`/`.mjs` extensions may conflict with existing assets, which leads to broken code.

**webpack.config.js**

```js
module.exports = {
  optimization: {
    minimize: true,
    minimizer: [
      new MinimizerPlugin({
        extractComments: {
          condition: /^\**!|@preserve|@license|@cc_on/i,
          filename: "extracted-comments.js",
          banner: (licenseFile) =>
            `License information can be found in ${licenseFile}`,
        },
      }),
    ],
  },
};
```

##### `banner`

Type:

```ts
type banner = string | boolean | ((commentsFile: string) => string) | undefined;
```

Default: `/*! For license information please see ${commentsFile} */`

The banner text that points to the extracted file and will be added at the top of the original file.

It can be `false` (no banner), a `String`, or a `function<(string) -> String>` that will be called with the filename where the extracted comments have been stored.

The banner will be wrapped in a comment.

**webpack.config.js**

```js
module.exports = {
  optimization: {
    minimize: true,
    minimizer: [
      new MinimizerPlugin({
        extractComments: {
          condition: true,
          filename: (fileData) =>
            // The "fileData" argument contains object with "filename", "basename", "query" and "hash"
            `${fileData.filename}.LICENSE.txt${fileData.query}`,
          banner: (commentsFile) =>
            `My custom banner about license information ${commentsFile}`,
        },
      }),
    ],
  },
};
```

## Embedded source

Source written in one language that reaches the bundle inside another is
minified too, which no asset carries and an asset-level minimizer therefore
never sees. It needs no option (webpack `>= 5.110.0`; older versions reach only
what an asset nests inside itself).

Such source has no filename, so `test` / `include` / `exclude` and each
minimizer's `filter` — all of which match filenames — cannot dispatch it.
**It is dispatched by the language it is written in**, which every minify
function states for itself:

```js
myCssMinifier.getTypes = () => ["css"];
```

The built-ins declare `javascript` (`terserMinify`, `uglifyJsMinify`,
`swcMinify`, `esbuildMinify`), `css` (`cssnanoMinify`, `cssoMinify`,
`cleanCssMinify`, `esbuildMinifyCss`, `lightningCssMinify`, `swcMinifyCss`),
`html` (`htmlMinifierTerser`, `swcMinifyHtml`, `swcMinifyHtmlFragment`,
`minifyHtmlNode`) and `json` (`jsonMinify`); webpack's own `cssMinify` and
`htmlMinify` declare `css` and `html`. A language **no configured minimizer
claims — `svg` out of the box — is emitted exactly as it was written**, and a
custom minify function without `getTypes` is never handed embedded source at
all.

What this reaches:

- CSS and HTML a module embeds in a JavaScript string literal (every
  `exportType` but `link`).
- The text an `asset/source` module embeds, and the payload an `asset/inline`
  module encodes — the payload before it is encoded, so the encoding covers
  what came back.
- What a document or a stylesheet nests inside itself: an inline `<style>`,
  every `style=""`, a `<script>` holding JavaScript or JSON, an `<svg>` subtree,
  the document an `<iframe srcdoc>` holds, and the payload of a `url()` `data:`
  URL. This is how an inline `<script>` is minified by `terser` at all.

A `style=""` arrives as **`css` with `as: "block-contents"`** — the same word
`module.parser.css.as` uses. It holds a block's contents rather than a whole
stylesheet, so a minifier claiming `css` is handed one either way and `as` says
which it is. Ignore it at your peril: parsing a declaration list as a stylesheet
finds no rule and returns nothing.

The nested case needs a minifier that can hand its nested bodies out, which it
also states for itself — webpack's `cssMinify` and `htmlMinify` do:

```js
// The languages this minifier can offer, given the options it will run with.
myHtmlMinifier.getEmbeddedTypes = (minimizerOptions) => ["css", "javascript"];
```

The option is passed only when **the two declarations meet**: if nothing
configured claims a language this minifier could offer, it is never handed one,
and minification is exactly what it always was. When it is, the nested bodies
are reached **in the same parse that prints** — the minifier leaves a marker
where each one goes and the answers are put in their place, so nothing is parsed
twice.

> **Note**
>
> Source a module embeds in JavaScript is minified during code generation,
> before the worker pool is up, so [`parallel`](#parallel) does not apply to it.
> What an asset nests inside itself is minified in the pool with the asset.

## Examples

### Preserve Comments

Extract all legal comments (i.e. `/^\**!|@preserve|@license|@cc_on/i`) and preserve `/@license/i` comments.

**webpack.config.js**

```js
module.exports = {
  optimization: {
    minimize: true,
    minimizer: [
      new MinimizerPlugin({
        minimizerOptions: {
          format: {
            comments: /@license/i,
          },
        },
        extractComments: true,
      }),
    ],
  },
};
```

### Remove Comments

If you want to build without comments, use this config:

**webpack.config.js**

```js
module.exports = {
  optimization: {
    minimize: true,
    minimizer: [
      new MinimizerPlugin({
        minimizerOptions: {
          format: {
            comments: false,
          },
        },
        extractComments: false,
      }),
    ],
  },
};
```

### [`uglify-js`](https://github.com/mishoo/UglifyJS)

[`UglifyJS`](https://github.com/mishoo/UglifyJS) is a JavaScript parser, minifier, compressor and beautifier toolkit.

**webpack.config.js**

```js
module.exports = {
  optimization: {
    minimize: true,
    minimizer: [
      new MinimizerPlugin({
        minify: MinimizerPlugin.uglifyJsMinify,
        // `minimizerOptions` will be passed to `uglify-js`
        // Link to options - https://github.com/mishoo/UglifyJS#minify-options
        minimizerOptions: {},
      }),
    ],
  },
};
```

### [`swc`](https://github.com/swc-project/swc)

[`swc`](https://github.com/swc-project/swc) is a super-fast compiler written in `Rust`, producing widely supported JavaScript from modern standards and TypeScript.

> **Warning**
>
> `extractComments` is supported with `@swc/core >= 1.15.30`.
> Only serializable extract conditions are supported: booleans, `"some"`, `"all"`, string patterns, `RegExp` values without flags, or object conditions that resolve to those forms.
> Function conditions and flagged regular expressions are not supported.

**webpack.config.js**

```js
module.exports = {
  optimization: {
    minimize: true,
    minimizer: [
      new MinimizerPlugin({
        minify: MinimizerPlugin.swcMinify,
        // `minimizerOptions` will be passed to `swc` (`@swc/core`)
        // Link to options - https://swc.rs/docs/config-js-minify
        minimizerOptions: {},
      }),
    ],
  },
};
```

### [`esbuild`](https://github.com/evanw/esbuild)

[`esbuild`](https://github.com/evanw/esbuild) is an extremely fast JavaScript bundler and minifier.

> **Warning**
>
> The `extractComments` option is not supported, and all legal comments (i.e. copyright, licenses and etc) will be preserved.

**webpack.config.js**

```js
module.exports = {
  optimization: {
    minimize: true,
    minimizer: [
      new MinimizerPlugin({
        minify: MinimizerPlugin.esbuildMinify,
        // `minimizerOptions` will be passed to `esbuild`
        // Link to options - https://esbuild.github.io/api/#minify
        // Note: the `minify` options is true by default (and override other `minify*` options), so if you want to disable the `minifyIdentifiers` option (or other `minify*` options) please use:
        // minimizerOptions: {
        //   minify: false,
        //   minifyWhitespace: true,
        //   minifyIdentifiers: false,
        //   minifySyntax: true,
        // },
        minimizerOptions: {},
      }),
    ],
  },
};
```

### JSON

Uses `JSON.stringify()` to minify your JSON files during the build process.

**webpack.config.js**

```js
module.exports = {
  optimization: {
    minimize: true,
    minimizer: [
      // Keeps original terser plugin to minify JS files
      "...",
      // Will minify JSON files (they can come from copy-webpack-plugin or when you are using asset modules)
      new MinimizerPlugin({
        test: /\.json$/,
        minify: MinimizerPlugin.jsonMinify,
        // We are supporting `space` and `replacer` options, you can set them below
        minimizerOptions: {},
      }),
    ],
  },
};
```

### HTML

The plugin can minify HTML assets too. Pick one of the bundled HTML
minimizers and set `test` to match your HTML files.

Available HTML minimizers:

- `MinimizerPlugin.htmlMinifierTerser` — uses [`html-minifier-terser`](https://github.com/terser/html-minifier-terser).
- `MinimizerPlugin.swcMinifyHtml` — uses [`@swc/html`](https://github.com/swc-project/swc) for full HTML documents (with doctype and `<html>`/`<head>`/`<body>` tags).
- `MinimizerPlugin.swcMinifyHtmlFragment` — uses [`@swc/html`](https://github.com/swc-project/swc) for HTML fragments (e.g. content inside `<template></template>` or partial HTML strings).
- `MinimizerPlugin.minifyHtmlNode` — uses [`@minify-html/node`](https://github.com/wilsonzlin/minify-html).

The HTML minimizers are optional peer dependencies — install only the one
you actually use:

```console
npm install --save-dev html-minifier-terser
# or
npm install --save-dev @swc/html
# or
npm install --save-dev @minify-html/node
```

> **Note**
>
> HTML assets typically come from plugins like
> [`copy-webpack-plugin`](https://github.com/webpack-contrib/copy-webpack-plugin),
> [`html-webpack-plugin`](https://github.com/jantimon/html-webpack-plugin),
> or webpack's [asset modules](https://webpack.js.org/guides/asset-modules/).

> **Note**
>
> Whitespace handling differs between tools (defaults):
>
> - `@swc/html` — removes/collapses whitespace only in safe places (around `html`/`body`, inside `<head>`, between `<meta>`/`<script>`/`<link>` etc.).
> - `html-minifier-terser` — always collapses multiple whitespaces to a single space (never removes entirely); configurable via [its options](https://github.com/terser/html-minifier-terser#options-quick-reference).
> - `@minify-html/node` — see [its whitespace docs](https://github.com/wilsonzlin/minify-html#whitespace).

#### `html-minifier-terser`

[`html-minifier-terser`](https://github.com/terser/html-minifier-terser) is a JavaScript-based HTML minifier with no native dependency. It's the default HTML minimizer.

**webpack.config.js**

```js
const MinimizerPlugin = require("minimizer-webpack-plugin");

module.exports = {
  optimization: {
    minimize: true,
    minimizer: [
      // Keeps the default Terser plugin for JS files
      "...",
      new MinimizerPlugin({
        test: /\.html(\?.*)?$/i,
        minify: MinimizerPlugin.htmlMinifierTerser,
        // Options - https://github.com/terser/html-minifier-terser#options-quick-reference
        minimizerOptions: {
          collapseWhitespace: true,
          removeComments: true,
        },
      }),
    ],
  },
};
```

#### `@swc/html` — HTML documents

Use `swcMinifyHtml` for complete HTML documents (i.e. with a doctype and `<html>`/`<head>`/`<body>` tags).

**webpack.config.js**

```js
const MinimizerPlugin = require("minimizer-webpack-plugin");

module.exports = {
  optimization: {
    minimize: true,
    minimizer: [
      "...",
      new MinimizerPlugin({
        test: /\.html(\?.*)?$/i,
        minify: MinimizerPlugin.swcMinifyHtml,
        // Options - https://github.com/swc-project/bindings/blob/main/packages/html/index.ts
        minimizerOptions: {},
      }),
    ],
  },
};
```

#### `@swc/html` — HTML fragments

Use `swcMinifyHtmlFragment` for partial HTML — for example, content of `<template></template>` tags or HTML strings that get injected into another document.

**webpack.config.js**

```js
const MinimizerPlugin = require("minimizer-webpack-plugin");

module.exports = {
  optimization: {
    minimize: true,
    minimizer: [
      "...",
      new MinimizerPlugin({
        test: /\.template\.html$/i,
        minify: MinimizerPlugin.swcMinifyHtmlFragment,
        // Options - https://github.com/swc-project/bindings/blob/main/packages/html/index.ts
        minimizerOptions: {},
      }),
    ],
  },
};
```

> **Note**
>
> The difference between `swcMinifyHtml` and `swcMinifyHtmlFragment` is the
> error reporting — invalid or broken syntax is reported at build time.

#### `@minify-html/node`

[`@minify-html/node`](https://github.com/wilsonzlin/minify-html) is a Rust HTML minifier.

**webpack.config.js**

```js
const Minimizer = require("minimizer-webpack-plugin");

module.exports = {
  optimization: {
    minimize: true,
    minimizer: [
      "...",
      new Minimizer({
        test: /\.html(\?.*)?$/i,
        minify: Minimizer.minifyHtmlNode,
        // Options - https://github.com/wilsonzlin/minify-html#minification
        minimizerOptions: {},
      }),
    ],
  },
};
```

You can also stack multiple `MinimizerPlugin` instances to compress different files with different `minify` functions in the same build (e.g. JS with `terserMinify`, HTML with `htmlMinifierTerser`, JSON with `jsonMinify`).

### CSS

The plugin can minify CSS assets too. Pick one of the bundled CSS
minimizers and set `test` to match your CSS files.

Available CSS minimizers:

- `MinimizerPlugin.cssnanoMinify` — uses [`cssnano`](https://cssnano.github.io/cssnano/) (via [`postcss`](https://postcss.org/)).
- `MinimizerPlugin.cssoMinify` — uses [`csso`](https://github.com/css/csso).
- `MinimizerPlugin.cleanCssMinify` — uses [`clean-css`](https://github.com/clean-css/clean-css).
- `MinimizerPlugin.esbuildMinifyCss` — uses [`esbuild`](https://github.com/evanw/esbuild) with the CSS loader.
- `MinimizerPlugin.lightningCssMinify` — uses [`lightningcss`](https://github.com/parcel-bundler/lightningcss).
- `MinimizerPlugin.swcMinifyCss` — uses [`@swc/css`](https://github.com/swc-project/swc).

The CSS minimizers are optional peer dependencies — install only the ones
you actually use:

```console
npm install --save-dev cssnano postcss
# or
npm install --save-dev csso
# or
npm install --save-dev clean-css
# or
npm install --save-dev esbuild
# or
npm install --save-dev lightningcss
# or
npm install --save-dev @swc/css
```

> **Note**
>
> CSS assets typically come from plugins like
> [`mini-css-extract-plugin`](https://github.com/webpack-contrib/mini-css-extract-plugin)
> or webpack's [asset modules](https://webpack.js.org/guides/asset-modules/).

#### `cssnano`

[`cssnano`](https://cssnano.github.io/cssnano/) is the default CSS minimizer. It runs as a [PostCSS](https://postcss.org/) plugin.

**webpack.config.js**

```js
const MinimizerPlugin = require("minimizer-webpack-plugin");

module.exports = {
  optimization: {
    minimize: true,
    minimizer: [
      // Keeps the default Terser plugin for JS files
      "...",
      new MinimizerPlugin({
        test: /\.css(\?.*)?$/i,
        minify: MinimizerPlugin.cssnanoMinify,
        // Options - https://cssnano.github.io/cssnano/docs/config-file/
        minimizerOptions: {
          preset: "default",
        },
      }),
    ],
  },
};
```

#### `csso`

[`csso`](https://github.com/css/csso) is a CSS minifier with structural optimisations.

**webpack.config.js**

```js
const MinimizerPlugin = require("minimizer-webpack-plugin");

module.exports = {
  optimization: {
    minimize: true,
    minimizer: [
      "...",
      new MinimizerPlugin({
        test: /\.css(\?.*)?$/i,
        minify: MinimizerPlugin.cssoMinify,
        // Options - https://github.com/css/csso#minifysource-options
        minimizerOptions: {},
      }),
    ],
  },
};
```

#### `clean-css`

[`clean-css`](https://github.com/clean-css/clean-css) is a widely-used CSS optimiser.

**webpack.config.js**

```js
const MinimizerPlugin = require("minimizer-webpack-plugin");

module.exports = {
  optimization: {
    minimize: true,
    minimizer: [
      "...",
      new MinimizerPlugin({
        test: /\.css(\?.*)?$/i,
        minify: MinimizerPlugin.cleanCssMinify,
        // Options - https://github.com/clean-css/clean-css#constructor-options
        minimizerOptions: {},
      }),
    ],
  },
};
```

#### `esbuild`

[`esbuild`](https://github.com/evanw/esbuild) ships with a fast CSS minifier (used via its CSS loader).

**webpack.config.js**

```js
const MinimizerPlugin = require("minimizer-webpack-plugin");

module.exports = {
  optimization: {
    minimize: true,
    minimizer: [
      "...",
      new MinimizerPlugin({
        test: /\.css(\?.*)?$/i,
        minify: MinimizerPlugin.esbuildMinifyCss,
        // Options - https://esbuild.github.io/api/#transform-api
        minimizerOptions: {},
      }),
    ],
  },
};
```

#### `lightningcss`

[`lightningcss`](https://github.com/parcel-bundler/lightningcss) is a Rust-based CSS parser, transformer, and minifier.

**webpack.config.js**

```js
const MinimizerPlugin = require("minimizer-webpack-plugin");

module.exports = {
  optimization: {
    minimize: true,
    minimizer: [
      "...",
      new MinimizerPlugin({
        test: /\.css(\?.*)?$/i,
        minify: MinimizerPlugin.lightningCssMinify,
        // Options - https://lightningcss.dev/transpilation.html
        minimizerOptions: {},
      }),
    ],
  },
};
```

#### `@swc/css`

[`@swc/css`](https://github.com/swc-project/swc) is a Rust-based CSS minifier.

**webpack.config.js**

```js
const MinimizerPlugin = require("minimizer-webpack-plugin");

module.exports = {
  optimization: {
    minimize: true,
    minimizer: [
      "...",
      new MinimizerPlugin({
        test: /\.css(\?.*)?$/i,
        minify: MinimizerPlugin.swcMinifyCss,
        // Options - https://github.com/swc-project/bindings/blob/main/packages/css/index.ts
        minimizerOptions: {},
      }),
    ],
  },
};
```

### Images

The plugin can minify image assets too. Pick one of the bundled image
minimizers and set `test` to match your images.

Available image minimizers:

- `MinimizerPlugin.sharpMinify` — uses [`sharp`](https://github.com/lovell/sharp), re-encoding each image as its own format.
- `MinimizerPlugin.svgoMinify` — uses [`svgo`](https://github.com/svg/svgo).
- `MinimizerPlugin.imageminMinify` — uses [`imagemin`](https://github.com/imagemin/imagemin) and the plugins you name.

The image minimizers are optional peer dependencies — install only the ones
you actually use:

```console
npm install --save-dev sharp
# or
npm install --save-dev svgo
# or
npm install --save-dev imagemin imagemin-mozjpeg imagemin-pngquant
```

> **Note**
>
> These minimizers **only minify** — they never change an image's format or
> name. An asset's name is decided during code generation, long before a
> minimizer runs, so a renamed asset would leave the bundle pointing at a URL
> nothing emits. Converting `.png` to `.webp` stays with
> [`image-minimizer-webpack-plugin`](https://github.com/webpack/image-minimizer-webpack-plugin)
> and its `generator` option.

> **Note**
>
> `sharp` and `imagemin` read the asset's bytes rather than its text, so they
> run in the webpack process rather than in the worker pool — they do their own
> threading. Minimizers configured beside them keep the pool.

#### Lossless and lossy

Images are optimized in one of two modes:

1. [Lossless](https://en.wikipedia.org/wiki/Lossless_compression) — the decoded
   pixels come back identical, only the encoding is made smaller.
2. [Lossy](https://en.wikipedia.org/wiki/Lossy_compression) — quality is traded
   for a smaller file.

**Which one you get with no `encodeOptions` at all**, measured by decoding the
output back to pixels and comparing it with the input:

| Format | `sharpMinify` | `napiRsImageMinify` |
| ------ | ------------- | ------------------- |
| `avif` | lossy         | lossy               |
| `gif`  | lossy         | not handled         |
| `jpeg` | lossy         | **lossless**        |
| `png`  | **lossless**  | **lossless**        |
| `tiff` | lossy         | not handled         |
| `webp` | lossy         | lossy               |

So `sharpMinify` is lossy by default everywhere except PNG — it re-encodes at
`sharp`'s own defaults, which are quality settings rather than lossless ones.
`napiRsImageMinify` is lossless by default for both PNG and JPEG, because those
two are repacked in place by oxipng and mozjpeg, rewriting the encoded bytes
rather than decoding to pixels and encoding again.

`svgoMinify` rewrites markup rather than pixels. It is lossless in the sense
that the rendered image is meant to be unchanged, but its default plugin preset
does rewrite paths and drop metadata — see
[`svgo`](https://github.com/svg/svgo#configuration) for which of those to turn
off.

`imageminMinify` is whatever its plugins are. `imagemin-jpegtran`,
`imagemin-optipng` and `imagemin-gifsicle` are lossless; `imagemin-mozjpeg` and
`imagemin-pngquant` are lossy. `imagemin-svgo` can be either.

**Asking `sharpMinify` for lossless output**

```js
new MinimizerPlugin({
  test: /\.(png|jpe?g|webp|avif)(\?.*)?$/i,
  minify: MinimizerPlugin.sharpMinify,
  minimizerOptions: {
    encodeOptions: {
      // https://sharp.pixelplumbing.com/api-output
      jpeg: { quality: 100 },
      webp: { lossless: true },
      avif: { lossless: true },
      // PNG is already lossless at sharp's defaults
      png: {},
    },
  },
});
```

**Asking `napiRsImageMinify` for lossy output**, which is where the savings are:

```js
new MinimizerPlugin({
  test: /\.(png|jpe?g|webp|avif)(\?.*)?$/i,
  minify: MinimizerPlugin.napiRsImageMinify,
  minimizerOptions: {
    encodeOptions: {
      // Anything below 100 re-encodes rather than repacking
      jpeg: { quality: 80 },
      webp: { quality: 80 },
      avif: { quality: 70 },
      // `png` has no quality setting — it is lossless either way
    },
  },
});
```

> **Note**
>
> Lossless does not mean "no smaller". On this repository's own PNG fixture
> `napiRsImageMinify` returns 59% of the original size without touching a
> single pixel, and `sharpMinify` returns 92%.

#### `sharp`

[`sharp`](https://github.com/lovell/sharp) re-encodes each image as the format
its name already claims, so a `.png` stays a PNG. It handles `avif`, `gif`,
`heif`, `jp2`, `jpeg`, `png`, `tiff` and `webp`.

**webpack.config.js**

```js
const MinimizerPlugin = require("minimizer-webpack-plugin");

module.exports = {
  optimization: {
    minimize: true,
    minimizer: [
      // Keeps the default Terser plugin for JS files
      "...",
      new MinimizerPlugin({
        test: /\.(png|jpe?g|webp|avif|tiff?|gif)$/i,
        minify: MinimizerPlugin.sharpMinify,
        minimizerOptions: {
          // Options are keyed by sharp's format name
          // https://sharp.pixelplumbing.com/api-output
          encodeOptions: {
            jpeg: { quality: 80 },
            png: { compressionLevel: 9 },
            webp: { lossless: true },
          },
        },
      }),
    ],
  },
};
```

`sharp` can also transform the image while it re-encodes:

```js
new MinimizerPlugin({
  test: /\.(png|jpe?g)$/i,
  minify: MinimizerPlugin.sharpMinify,
  minimizerOptions: {
    // `enabled` and `unit` ("px" by default, or "percent") are read here;
    // everything else goes to sharp
    // https://sharp.pixelplumbing.com/api-resize
    resize: { width: 800, unit: "px", fit: "inside" },
    // A number of degrees, or "auto" to follow the EXIF orientation
    rotate: "auto",
    flip: false,
    flop: false,
    grayscale: false,
    // A sigma, or true for a fast default
    blur: false,
    sharpen: false,
    encodeOptions: { jpeg: { quality: 80 } },
  },
});
```

Each of these can also be asked for by an asset's own name — see
[Query strings in asset names](#query-strings-in-asset-names).

#### `svgo`

[`svgo`](https://github.com/svg/svgo) minifies SVG. It also reaches an
`asset/inline` SVG — one that becomes a `data:` URI rather than a file — which
carries no asset name for `test` to match; see
[Embedded source](#embedded-source).

**webpack.config.js**

```js
const MinimizerPlugin = require("minimizer-webpack-plugin");

module.exports = {
  optimization: {
    minimize: true,
    minimizer: [
      "...",
      new MinimizerPlugin({
        test: /\.svg(\?.*)?$/i,
        minify: MinimizerPlugin.svgoMinify,
        minimizerOptions: {
          // Options - https://github.com/svg/svgo#configuration
          encodeOptions: {
            multipass: true,
            plugins: ["preset-default"],
          },
        },
      }),
    ],
  },
};
```

#### `imagemin`

[`imagemin`](https://github.com/imagemin/imagemin) runs the plugins you name.
Each is a string — `"mozjpeg"` resolves `imagemin-mozjpeg` — or a
`[name, options]` pair. Install each plugin yourself.

**webpack.config.js**

```js
const MinimizerPlugin = require("minimizer-webpack-plugin");

module.exports = {
  optimization: {
    minimize: true,
    minimizer: [
      "...",
      new MinimizerPlugin({
        test: /\.(png|jpe?g|gif|svg)$/i,
        minify: MinimizerPlugin.imageminMinify,
        minimizerOptions: {
          plugins: [
            "gifsicle",
            "mozjpeg",
            ["pngquant", { quality: [0.6, 0.8] }],
            "svgo",
          ],
        },
      }),
    ],
  },
};
```

> **Note**
>
> A plugin that converts — `imagemin-webp`, `imagemin-avif` — writes a format
> the asset's name does not claim. `imageminMinify` keeps the original and
> warns instead of writing it, since it cannot rename the asset.

#### `@napi-rs/image`

[`@napi-rs/image`](https://github.com/Brooooooklyn/Image) is a set of Rust
codecs shipped as prebuilt binaries, so it needs no system library. It handles
`avif`, `jpeg`, `png` and `webp` — the formats it both reads back reliably and
makes smaller.

Each format is re-encoded as itself, using the codec that does that best:
`png` goes through [oxipng](https://github.com/shssoichiro/oxipng), which
rewrites the container losslessly and leaves the pixels untouched, and `jpeg`
through [mozjpeg](https://github.com/mozilla/mozjpeg). Decoding either to
pixels and re-encoding saves a small fraction as much.

**webpack.config.js**

```js
const MinimizerPlugin = require("minimizer-webpack-plugin");

module.exports = {
  optimization: {
    minimize: true,
    minimizer: [
      "...",
      new MinimizerPlugin({
        test: /\.(png|jpe?g|webp|avif)$/i,
        minify: MinimizerPlugin.napiRsImageMinify,
        minimizerOptions: {
          // Options are keyed by the format's own name
          // https://github.com/Brooooooklyn/Image#usage
          encodeOptions: {
            // `PNGLosslessOptions`
            png: { force: true },
            // `JpegCompressOptions`
            jpeg: { quality: 80 },
            // `AvifConfig`
            avif: { quality: 70, speed: 4 },
            // The quality factor, 0-100
            webp: { quality: 80 },
          },
        },
      }),
    ],
  },
};
```

> **Note**
>
> `png` is recompressed losslessly, so it takes no quality setting. Resizing
> and rotating are not exposed here — use [`sharp`](#sharp) for those.

#### Query strings in asset names

An asset keeps the query and fragment of the request that made it:
`output.assetModuleFilename` is `[hash][ext][query][fragment]` by default, so
`import icon from "./icon.svg?v=2"` is emitted as `<hash>.svg?v=2`.

`test`, `include` and `exclude` are read against both spellings — the whole name
and the name with the query and fragment stripped — so all three of these accept
that asset:

```js
test: /\.svg$/i; // names the file
test: /\.svg(\?.*)?$/i; // names the query form
test: /\?v=2$/; // names the query itself
```

`exclude` rejects on either spelling, so excluding by file name also excludes
the queried asset. Every built-in minimizer's own `filter` reads past the query
in the same way.

**Asking sharp for something from the import.** `sharpMinify` reads what to do
off the asset's name, so one image can be sized, turned or re-encoded where it
is imported rather than in the configuration:

```js
import banner from "./banner.png?width=320&quality=80";
```

| Query                 | Short  | Value                                         | What it does                                 |
| --------------------- | ------ | --------------------------------------------- | -------------------------------------------- |
| `width`               | `w`    | pixels, or `auto`                             | target width                                 |
| `height`              | `h`    | pixels, or `auto`                             | target height                                |
| `unit`                | `u`    | `px` (default) or `percent`                   | how `width` and `height` are read            |
| `fit`                 |        | `cover` (default), `contain`, `fill`, …       | what to do when both dimensions are given    |
| `position`            | `pos`  | `centre` (default), `right top`, `entropy`, … | where to crop from                           |
| `background`          | `bg`   | a colour                                      | what `contain` pads with                     |
| `without-enlargement` |        | flag                                          | never scale the image up                     |
| `rotate`              | `rot`  | degrees, or `auto`                            | turn by an angle, or by the EXIF orientation |
| `flip`                |        | flag                                          | mirror vertically                            |
| `flop`                |        | flag                                          | mirror horizontally                          |
| `grayscale`           | `gray` | flag                                          | drop the colour                              |
| `blur`                |        | sigma, or flag                                | blur                                         |
| `sharpen`             |        | sigma, or flag                                | sharpen                                      |
| `quality`             | `q`    | a number                                      | encode quality                               |
| `lossless`            |        | flag                                          | encode losslessly, where the format has one  |
| `effort`              |        | a number                                      | how hard the encoder tries                   |
| `progressive`         | `prog` | flag                                          | interlace, where the format has it           |

| Import                                        | What comes out                                 |
| --------------------------------------------- | ---------------------------------------------- |
| `./photo.jpg?w=64&h=64&fit=cover&pos=entropy` | a 64x64 thumbnail, cropped to the busiest part |
| `./photo.jpg?width=16&blur&quality=30`        | a tiny blurred placeholder                     |
| `./logo.png?width=50&unit=percent&grayscale`  | half-size and grey                             |

A **flag** is on when it is present — `?flip` — and reads `true`/`1`/`yes` the
same way, `false`/`0`/`no` the other. `greyscale` and `grey` spell `grayscale`,
`auto` on `width` or `height` drops one set in `minimizerOptions`, and a
parameter can be spelled in any case.

Every one of these can also be set in `minimizerOptions`; the name wins where
both say something, being the more specific of the two. `resize: { enabled:
false }` still turns resizing off entirely.

Two rules decide what happens to a value:

- **Its shape is checked here, and anything else is ignored.** An asset's name
  carries queries this plugin never put there, so `?v=2` must not become a
  resize — and neither does `?width=nonsense` or `?flip=maybe`.
- **Whether a well-formed value is one sharp accepts is sharp's to report**, and
  it answers per format: `effort` runs to 6 for webp and 9 for avif, `quality`
  starts at 0 for png and 1 for jpeg, and a colour is whatever it can parse. A
  value outside those fails the build with sharp's own message rather than being
  dropped silently. An option a format has no use for — `?lossless` on a jpeg —
  is simply ignored.

**`napiRsImageMinify` reads the same names**, as far as `@napi-rs/image` goes:
`width`/`w`, `height`/`h`, `fit` (`cover`, `fill`, `inside`), `filter`
(`nearest`, `triangle`, `catmull-rom`, `gaussian`, `lanczos3`), `rotate`/`rot`,
`flip`, `flop`, `grayscale`, `invert`, `blur`, `quality`/`q`, `lossless` and
`speed`. Three differences are worth knowing:

- **`rotate` takes a quarter turn**, not any angle — `90`, `180`, `270`, a
  negative or a multiple of those, or `auto` for the EXIF orientation. napi
  applies one orientation, so mirroring and a turn compose into it (`?flip&flop`
  is a half turn); asking for `auto` alongside an explicit turn warns, because
  only one of them can be applied.
- **Every value is checked here**, rather than left to the library as sharp's
  are. napi rejects an unknown `fit` without naming it, and answers a quality of
  150 by silently writing a _bigger_ file, so a value it would mishandle is
  dropped instead.
- **Transforming costs the repack.** This minimizer's advantage is rewriting
  encoded bytes — oxipng saves 99% of a png where decoding and re-encoding saves
  9% — so when a query makes a transform necessary, its output is handed back to
  the repack rather than replacing it. A `?rotate=auto` on an image whose EXIF
  asks for nothing skips the decode entirely.

**`svgoMinify` reads `precision`** (or `floatPrecision`, 0–10), **`multipass`**,
**`pretty`** and **`indent`**, so one SVG can be laid out readably or coarsened
without a second configuration:

```js
import icon from "./icon.svg?precision=1";
```

**`imageminMinify` reads nothing.** Its options are a list of already-configured
plugins, each with option names of its own, so there is no parameter a query
could set that would mean the same thing twice over.

> **Note**
>
> Two assets whose names differ only by their query would be written to the same
> file, and webpack refuses that. To emit several sizes of one image, give each
> its own file name **and** keep the query on the asset name:
>
> ```js
> module.exports = {
>   output: {
>     assetModuleFilename: (pathData) => {
>       const query = pathData.module.resourceResolveData.query || "";
>       const name = query.replace(/^\?/, "-").replace(/[=&]/g, "-");
>
>       return `[name]${name}[ext][query]`;
>     },
>   },
> };
> ```
>
> Without the trailing `[query]` the size is no longer on the name and nothing
> resizes; without the first half the two sizes collide.

> **Note**
>
> A query cannot pick a **format** here. `?as=webp` is read by
> [`image-minimizer-webpack-plugin`](https://github.com/webpack/image-minimizer-webpack-plugin)'s
> loader, which sees the import before an asset exists and can emit a different
> file for it. Resizing needs no new name, which is why it works here; changing
> the format does, and this plugin runs after names are decided.

#### Images beside everything else

`minify` takes an array, and each minimizer is offered only the assets its own
`filter` accepts, so one plugin instance can cover several languages at once:

```js
const MinimizerPlugin = require("minimizer-webpack-plugin");

module.exports = {
  optimization: {
    minimize: true,
    minimizer: [
      new MinimizerPlugin({
        test: /\.(js|css|svg|png|jpe?g)$/i,
        minify: [
          MinimizerPlugin.terserMinify,
          MinimizerPlugin.cssnanoMinify,
          MinimizerPlugin.svgoMinify,
          MinimizerPlugin.sharpMinify,
        ],
        // One entry per minimizer, in the same order
        minimizerOptions: [
          {},
          {},
          {},
          { encodeOptions: { png: { compressionLevel: 9 } } },
        ],
      }),
    ],
  },
};
```

### Custom Minify Function

Override the default minify function - use `uglify-js` for minification.

**webpack.config.js**

```js
module.exports = {
  optimization: {
    minimize: true,
    minimizer: [
      new MinimizerPlugin({
        minify: (file, sourceMap) => {
          // https://github.com/mishoo/UglifyJS2#minify-options
          const uglifyJsOptions = {/* your `uglify-js` package options */};

          if (sourceMap) {
            uglifyJsOptions.sourceMap = {
              content: sourceMap,
            };
          }

          return require("uglify-js").minify(file, uglifyJsOptions);
        },
      }),
    ],
  },
};
```

### Typescript

With default Terser minify function:

```ts
module.exports = {
  optimization: {
    minimize: true,
    minimizer: [
      new MinimizerPlugin({
        minimizerOptions: {
          compress: true,
        },
      }),
    ],
  },
};
```

With built-in minify functions:

```ts
import { type JsMinifyOptions as SwcOptions } from "@swc/core";
import { type MinifyOptions as SwcCssOptions } from "@swc/css";
import {
  type FragmentOptions as SwcHtmlFragmentOptions,
  type Options as SwcHtmlOptions,
} from "@swc/html";
import { type OptionsOutput as CleanCssOptions } from "clean-css";
import { type Options as CssnanoOptions } from "cssnano";
import { type CompressOptions as CssoOptions } from "csso";
import { type TransformOptions as EsbuildOptions } from "esbuild";
import { type Options as HtmlMinifierTerserOptions } from "html-minifier-terser";
import { type TransformOptions as LightningCssOptions } from "lightningcss";
import { type MinifyOptions as TerserOptions } from "terser";
import { type MinifyOptions as UglifyJSOptions } from "uglify-js";

module.exports = {
  optimization: {
    minimize: true,
    minimizer: [
      new MinimizerPlugin<SwcOptions>({
        minify: MinimizerPlugin.swcMinify,
        minimizerOptions: {
          // `swc` options
        },
      }),
      new MinimizerPlugin<UglifyJSOptions>({
        minify: MinimizerPlugin.uglifyJsMinify,
        minimizerOptions: {
          // `uglif-js` options
        },
      }),
      new MinimizerPlugin<EsbuildOptions>({
        minify: MinimizerPlugin.esbuildMinify,
        minimizerOptions: {
          // `esbuild` options
        },
      }),

      // Alternative usage:
      new MinimizerPlugin<TerserOptions>({
        minify: MinimizerPlugin.terserMinify,
        minimizerOptions: {
          // `terser` options
        },
      }),

      // HTML minimizers
      new MinimizerPlugin<HtmlMinifierTerserOptions>({
        test: /\.html(\?.*)?$/i,
        minify: MinimizerPlugin.htmlMinifierTerser,
        minimizerOptions: {
          // `html-minifier-terser` options
        },
      }),
      new MinimizerPlugin<SwcHtmlOptions>({
        test: /\.html(\?.*)?$/i,
        minify: MinimizerPlugin.swcMinifyHtml,
        minimizerOptions: {
          // `@swc/html` options
        },
      }),
      new MinimizerPlugin<SwcHtmlFragmentOptions>({
        test: /\.template\.html$/i,
        minify: MinimizerPlugin.swcMinifyHtmlFragment,
        minimizerOptions: {
          // `@swc/html` fragment options
        },
      }),

      // CSS minimizers
      new MinimizerPlugin<CssnanoOptions>({
        test: /\.css(\?.*)?$/i,
        minify: MinimizerPlugin.cssnanoMinify,
        minimizerOptions: {
          // `cssnano` options
        },
      }),
      new MinimizerPlugin<CssoOptions>({
        test: /\.css(\?.*)?$/i,
        minify: MinimizerPlugin.cssoMinify,
        minimizerOptions: {
          // `csso` options
        },
      }),
      new MinimizerPlugin<CleanCssOptions>({
        test: /\.css(\?.*)?$/i,
        minify: MinimizerPlugin.cleanCssMinify,
        minimizerOptions: {
          // `clean-css` options
        },
      }),
      new MinimizerPlugin<EsbuildOptions>({
        test: /\.css(\?.*)?$/i,
        minify: MinimizerPlugin.esbuildMinifyCss,
        minimizerOptions: {
          // `esbuild` options (CSS loader)
        },
      }),
      new MinimizerPlugin<LightningCssOptions>({
        test: /\.css(\?.*)?$/i,
        minify: MinimizerPlugin.lightningCssMinify,
        minimizerOptions: {
          // `lightningcss` options
        },
      }),
      new MinimizerPlugin<SwcCssOptions>({
        test: /\.css(\?.*)?$/i,
        minify: MinimizerPlugin.swcMinifyCss,
        minimizerOptions: {
          // `@swc/css` options
        },
      }),
    ],
  },
};
```

## Contributing

We welcome all contributions!
If you're new here, please take a moment to review our contributing guidelines before submitting issues or pull requests.

[CONTRIBUTING](https://github.com/webpack/minimizer-webpack-plugin?tab=contributing-ov-file#contributing)

## License

[MIT](./LICENSE)

[npm]: https://img.shields.io/npm/v/minimizer-webpack-plugin.svg
[npm-url]: https://npmjs.com/package/minimizer-webpack-plugin
[node]: https://img.shields.io/node/v/minimizer-webpack-plugin.svg
[node-url]: https://nodejs.org
[tests]: https://github.com/webpack/minimizer-webpack-plugin/workflows/minimizer-webpack-plugin/badge.svg
[tests-url]: https://github.com/webpack/minimizer-webpack-plugin/actions
[cover]: https://codecov.io/gh/webpack/minimizer-webpack-plugin/branch/main/graph/badge.svg
[cover-url]: https://codecov.io/gh/webpack/minimizer-webpack-plugin
[discussion]: https://img.shields.io/github/discussions/webpack/webpack
[discussion-url]: https://github.com/webpack/webpack/discussions
[size]: https://packagephobia.now.sh/badge?p=minimizer-webpack-plugin
[size-url]: https://packagephobia.now.sh/result?p=minimizer-webpack-plugin
