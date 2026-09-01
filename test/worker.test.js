import { TraceMap, originalPositionFor } from "@jridgewell/trace-mapping";

import { transform } from "../src/minify.js";
import serialize from "../src/serialize-javascript.js";
import { terserMinify } from "../src/utils.js";

// cspell:ignore KAAK
describe("worker", () => {
  it("preserves unmapped regions when composing source maps", async () => {
    const options = {
      name: "bundle.js",
      input: "const value = generated();",
      inputSourceMap: {
        version: 3,
        sources: ["original.js"],
        names: [],
        mappings: "AAAA,K",
      },
      minimizer: {
        implementation: async (input) => ({
          code: Object.values(input)[0],
          map: {
            version: 3,
            sources: ["bundle.js"],
            names: [],
            mappings: "AAAA,KAAK",
          },
        }),
      },
    };
    const workerResult = await transform(serialize(options));
    const position = originalPositionFor(new TraceMap(workerResult.map), {
      line: 1,
      column: 5,
    });

    expect(position.source).toBeNull();
  });

  it('should match snapshot when options.extractComments is "false"', async () => {
    const options = {
      name: "test1.js",
      input:
        "var foo = 1;/* hello */\n// Comment\n/* duplicate */\n/* duplicate */",
      minimizer: {
        implementation: terserMinify,
      },
      extractComments: false,
    };
    const workerResult = await transform(serialize(options));

    expect(workerResult).toMatchSnapshot();
  });

  it('should match snapshot when options.extractComments is "true"', async () => {
    const options = {
      name: "test1.js",
      input:
        "var foo = 1;/* hello */\n// Comment\n/* duplicate */\n/* duplicate */",
      minimizer: {
        implementation: terserMinify,
      },
      extractComments: true,
    };
    const workerResult = await transform(serialize(options));

    expect(workerResult).toMatchSnapshot();
  });

  it("should match snapshot when options.extractComments is RegExp", async () => {
    const options = {
      name: "test1.js",
      input:
        "var foo = 1;/* hello */\n// Comment\n/* duplicate */\n/* duplicate */",
      minimizer: {
        implementation: terserMinify,
      },
      extractComments: /hello/,
    };
    const workerResult = await transform(serialize(options));

    expect(workerResult).toMatchSnapshot();
  });

  it("should match snapshot when options.extractComments is Function", async () => {
    const options = {
      name: "test1.js",
      input:
        "var foo = 1;/* hello */\n// Comment\n/* duplicate */\n/* duplicate */",
      minimizer: {
        implementation: terserMinify,
      },
      extractComments: () => true,
    };
    const workerResult = await transform(serialize(options));

    expect(workerResult).toMatchSnapshot();
  });

  it("should match snapshot when options.extractComments is empty Object", async () => {
    const options = {
      name: "test1.js",
      input:
        "var foo = 1;/* hello */\n// Comment\n/* duplicate */\n/* duplicate */",
      minimizer: {
        implementation: terserMinify,
      },
      extractComments: {},
    };
    const workerResult = await transform(serialize(options));

    expect(workerResult).toMatchSnapshot();
  });

  it('should match snapshot when options.extractComments is Object with "true" value', async () => {
    const options = {
      name: "test1.js",
      input:
        "var foo = 1;/* hello */\n// Comment\n/* duplicate */\n/* duplicate */",
      minimizer: {
        implementation: terserMinify,
      },
      extractComments: {
        condition: true,
      },
    };
    const workerResult = await transform(serialize(options));

    expect(workerResult).toMatchSnapshot();
  });

  it('should match snapshot when options.extractComments is Object with "some" value', async () => {
    const options = {
      name: "test1.js",
      input:
        "var foo = 1;/* hello */\n// Comment\n/* duplicate */\n/* duplicate */",
      minimizer: {
        implementation: terserMinify,
      },
      extractComments: {
        condition: "some",
      },
    };
    const workerResult = await transform(serialize(options));

    expect(workerResult).toMatchSnapshot();
  });

  it('should match snapshot when options.extractComments is Object with "all" value', async () => {
    const options = {
      name: "test1.js",
      input:
        "var foo = 1;/* hello */\n// Comment\n/* duplicate */\n/* duplicate */",
      minimizer: {
        implementation: terserMinify,
      },
      extractComments: {
        condition: "all",
      },
    };
    const workerResult = await transform(serialize(options));

    expect(workerResult).toMatchSnapshot();
  });

  it('should match snapshot when options.extractComments is "all" value', async () => {
    const options = {
      name: "test1.js",
      input:
        "var foo = 1;/* hello */\n// Comment\n/* duplicate */\n/* duplicate */",
      minimizer: {
        implementation: terserMinify,
      },
      extractComments: "all",
    };
    const workerResult = await transform(serialize(options));

    expect(workerResult).toMatchSnapshot();
  });

  it('should match snapshot when options.extractComments is "some" value', async () => {
    const options = {
      name: "test1.js",
      input:
        "var foo = 1;/* hello */\n// Comment\n/* duplicate */\n/* duplicate */",
      minimizer: {
        implementation: terserMinify,
      },
      extractComments: "some",
    };
    const workerResult = await transform(serialize(options));

    expect(workerResult).toMatchSnapshot();
  });

  it("normalizes when minimizerOptions.output.comments is string: all", async () => {
    const options = {
      name: "test2.js",
      input:
        "var foo = 1;/* hello */\n// Comment\n/* duplicate */\n/* duplicate */",
      minimizer: {
        implementation: terserMinify,
        options: {
          output: {
            comments: "all",
          },
        },
      },
    };
    const workerResult = await transform(serialize(options));

    expect(workerResult).toMatchSnapshot();
  });

  it("should match snapshot when minimizerOptions.compress.comments is boolean", async () => {
    const options = {
      name: "test3.js",
      input:
        "var foo = 1;/* hello */\n// Comment\n/* duplicate */\n/* duplicate */",
      minimizer: {
        implementation: terserMinify,
        options: {
          compress: true,
        },
      },
    };
    const workerResult = await transform(serialize(options));

    expect(workerResult).toMatchSnapshot();
  });

  it("should match snapshot when minimizerOptions.compress.comments is object", async () => {
    const options = {
      name: "test3.js",
      input:
        "var foo = 1;/* hello */\n// Comment\n/* duplicate */\n/* duplicate */",
      minimizer: {
        implementation: terserMinify,
        options: {
          compress: {
            passes: 2,
          },
        },
      },
    };
    const workerResult = await transform(serialize(options));

    expect(workerResult).toMatchSnapshot();
  });

  it("should match snapshot when minimizerOptions.output.comments is string: some", async () => {
    const options = {
      name: "test3.js",
      input:
        "var foo = 1;/* hello */\n// Comment\n/* duplicate */\n/* duplicate */",
      minimizer: {
        implementation: terserMinify,
        options: {
          output: {
            comments: "some",
          },
        },
      },
    };
    const workerResult = await transform(serialize(options));

    expect(workerResult).toMatchSnapshot();
  });

  it("should match snapshot when minimizerOptions.extractComments is number", async () => {
    const options = {
      name: "test4.js",
      input:
        "var foo = 1;/* hello */\n// Comment\n/* duplicate */\n/* duplicate */",
      minimizer: {
        implementation: terserMinify,
        options: {
          output: {
            comments: "some",
          },
        },
      },
      extractComments: 1,
    };
    const workerResult = await transform(serialize(options));

    expect(workerResult).toMatchSnapshot();
  });

  it("should match snapshot with extract option set to a single file", async () => {
    const options = {
      name: "test5.js",
      input: "/******/ function hello(a) {console.log(a)}",
      minimizer: {
        implementation: terserMinify,
        options: {
          output: {
            comments: "all",
          },
        },
      },
      extractComments: {
        condition: "should be extracted",
        filename: (file) => file.filename.replace(/(\.\w+)$/, ".license$1"),
        banner: (licenseFile) =>
          `License information can be found in ${licenseFile}`,
      },
    };
    const workerResult = await transform(serialize(options));

    expect(workerResult).toMatchSnapshot();
  });

  it("should match snapshot with options.inputSourceMap", async () => {
    const options = {
      minimizer: {
        implementation: terserMinify,
      },
      name: "test6.js",
      input: "function foo(x) { if (x) { return bar(); not_called1(); } }",
      inputSourceMap: {
        version: 3,
        sources: ["test1.js"],
        names: ["foo", "x", "bar", "not_called1"],
        mappings: "AAAA,QAASA,KAAIC,GACT,GAAIA,EAAG,CACH,MAAOC,MACPC",
      },
    };
    const workerResult = await transform(serialize(options));

    expect(workerResult).toMatchSnapshot();
  });

  it('should match snapshot when options.output.comments is "some"', async () => {
    const options = {
      name: "test1.js",
      input:
        "var foo = 1;/* hello */\n// Comment\n/* duplicate */\n/* duplicate */",
      minimizer: {
        implementation: (item) => item["test1.js"],
        options: {
          output: {
            comments: "some",
          },
        },
      },
    };
    const workerResult = await transform(serialize(options));

    expect(workerResult).toMatchSnapshot();
  });

  it('should match snapshot when minimizerOptions.mangle is "null"', async () => {
    const options = {
      name: "test4.js",
      input:
        "var foo = 1;/* hello */\n// Comment\n/* duplicate */\n/* duplicate */",
      minimizer: {
        implementation: terserMinify,
        options: {
          mangle: null,
        },
      },
    };
    const workerResult = await transform(serialize(options));

    expect(workerResult).toMatchSnapshot();
  });

  it("should match snapshot when minimizerOptions.mangle is boolean", async () => {
    const options = {
      name: "test4.js",
      input:
        "var foo = 1;/* hello */\n// Comment\n/* duplicate */\n/* duplicate */",
      minimizer: {
        implementation: terserMinify,
        options: {
          mangle: true,
        },
      },
    };
    const workerResult = await transform(serialize(options));

    expect(workerResult).toMatchSnapshot();
  });

  it("should match snapshot when minimizerOptions.mangle is object", async () => {
    const options = {
      name: "test4.js",
      input:
        "var foo = 1;/* hello */\n// Comment\n/* duplicate */\n/* duplicate */",
      minimizer: {
        implementation: terserMinify,
        options: {
          mangle: { toplevel: true },
        },
      },
    };
    const workerResult = await transform(serialize(options));

    expect(workerResult).toMatchSnapshot();
  });
});
