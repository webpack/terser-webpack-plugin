import path from "path";

import MinimizerPlugin from "../src/index";

import {
  compile,
  getCompiler,
  getErrors,
  getWarnings,
  readAsset,
} from "./helpers";

// A minimizer that claims the asset and marks it, the way every plugin built on
// this one does — used to prove which instance gets there first.
class MarkingMinimizer {
  constructor(banner) {
    this.banner = banner;
  }

  apply(compiler) {
    compiler.hooks.compilation.tap("MarkingMinimizer", (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: "MarkingMinimizer",
          stage:
            compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE,
        },
        (assets) => {
          for (const name of Object.keys(assets)) {
            const { info, source } = compilation.getAsset(name);

            if (info.minimized) {
              continue;
            }

            compilation.updateAsset(
              name,
              new compiler.webpack.sources.RawSource(
                `/* ${this.banner} */${source.source()}`,
              ),
              { minimized: true },
            );
          }
        },
      );
    });
  }
}

describe("stage option", () => {
  let compiler;

  beforeEach(() => {
    compiler = getCompiler({
      entry: { entry: path.resolve(__dirname, "./fixtures/entry.js") },
    });
  });

  it("should minimize at the default stage", async () => {
    new MinimizerPlugin().apply(compiler);
    new MarkingMinimizer("other").apply(compiler);

    const stats = await compile(compiler);

    // Applied first, so it wins the shared stage and the other minimizer skips
    // the asset it marked.
    expect(readAsset("entry.js", compiler, stats)).not.toContain("/* other */");
    expect(getErrors(stats)).toHaveLength(0);
    expect(getWarnings(stats)).toHaveLength(0);
  });

  it("should let earlier stages win when raised", async () => {
    new MinimizerPlugin({
      stage:
        compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE + 1,
    }).apply(compiler);
    new MarkingMinimizer("other").apply(compiler);

    const stats = await compile(compiler);

    // The raised stage runs last, so the other minimizer claims the asset and
    // this one skips it (`info.minimized`) rather than minimizing twice.
    const asset = readAsset("entry.js", compiler, stats);

    expect(asset).toContain("/* other */");
    expect(asset).toContain("\n");
    expect(getErrors(stats)).toHaveLength(0);
    expect(getWarnings(stats)).toHaveLength(0);
  });
});
