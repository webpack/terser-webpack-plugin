import fs from "fs";
import path from "path";

import {
  cleanCssMinify,
  cssnanoMinify,
  cssoMinify,
  esbuildMinify,
  esbuildMinifyCss,
  htmlMinifierTerser,
  imageminMinify,
  jsonMinify,
  lightningCssMinify,
  minifyHtmlNode,
  napiRsImageMinify,
  packageVersion,
  sharpMinify,
  svgoMinify,
  swcMinify,
  swcMinifyCss,
  swcMinifyHtml,
  swcMinifyHtmlFragment,
  terserMinify,
  uglifyJsMinify,
} from "../src/utils";

const MINIMIZERS = {
  cleanCssMinify,
  cssnanoMinify,
  cssoMinify,
  esbuildMinify,
  esbuildMinifyCss,
  htmlMinifierTerser,
  imageminMinify,
  jsonMinify,
  lightningCssMinify,
  minifyHtmlNode,
  napiRsImageMinify,
  sharpMinify,
  svgoMinify,
  swcMinify,
  swcMinifyCss,
  swcMinifyHtml,
  swcMinifyHtmlFragment,
  terserMinify,
  uglifyJsMinify,
};

describe("packageVersion", () => {
  it("should report what a package's own `package.json` says", () => {
    const installed = JSON.parse(
      fs.readFileSync(
        path.resolve(__dirname, "../node_modules/terser/package.json"),
        "utf8",
      ),
    );

    expect(packageVersion("terser")).toBe(installed.version);
  });

  it("should report nothing for a package that is not installed", () => {
    expect(packageVersion("no-such-package-anywhere")).toBeUndefined();
  });

  it("should report nothing when no `package.json` above the entry names it", () => {
    // A core module resolves to its own name, so the walk runs out at the root.
    expect(packageVersion("path")).toBeUndefined();
  });
});

describe("getMinimizerVersion", () => {
  it.each(Object.keys(MINIMIZERS))(
    "should report a version or nothing for %s, never throwing",
    (name) => {
      const version = MINIMIZERS[name].getMinimizerVersion();

      if (typeof version !== "undefined") {
        expect(version).toMatch(/^\d+\.\d+\.\d+/);
      }
    },
  );
});
