import os from "os";
import path from "path";

import { Worker } from "jest-worker";

import MinimizerPlugin from "../src/index";

import {
  compile,
  getCompiler,
  getErrors,
  getWarnings,
  readsAssets,
} from "./helpers";

jest.mock("os", () => {
  const actualOs = jest.requireActual("os");
  const isAvailableParallelism =
    typeof actualOs.availableParallelism !== "undefined";

  const mocked = {
    availableParallelism: isAvailableParallelism ? jest.fn(() => 4) : undefined,
    cpus: jest.fn(() => ({ length: 4 })),
  };

  return { ...actualOs, ...mocked };
});

// Based on https://github.com/facebook/jest/blob/edde20f75665c2b1e3c8937f758902b5cf28a7b4/packages/jest-runner/src/__tests__/test_runner.test.js
let workerTransform;
let workerEnd;

const ENABLE_WORKER_THREADS =
  typeof process.env.ENABLE_WORKER_THREADS !== "undefined"
    ? process.env.ENABLE_WORKER_THREADS === "true"
    : true;

jest.mock("jest-worker", () => ({
  Worker: jest.fn().mockImplementation((workerPath) => ({
    transform: (workerTransform = jest.fn((data) =>
      require(workerPath).transform(data),
    )),
    end: (workerEnd = jest.fn()),
    getStderr: jest.fn(),
    getStdout: jest.fn(),
  })),
}));

const workerPath = require.resolve("../src/minify");

const getParallelism = () => {
  if (typeof os.availableParallelism !== "undefined") {
    return os.availableParallelism();
  }

  return os.cpus().length;
};

describe("parallel option", () => {
  let compiler;

  beforeEach(() => {
    jest.clearAllMocks();

    compiler = getCompiler({
      entry: {
        one: path.resolve(__dirname, "./fixtures/entry.js"),
        two: path.resolve(__dirname, "./fixtures/entry.js"),
        three: path.resolve(__dirname, "./fixtures/entry.js"),
        four: path.resolve(__dirname, "./fixtures/entry.js"),
      },
    });
  });

  it("should match snapshot when a value is not specify", async () => {
    new MinimizerPlugin().apply(compiler);

    const stats = await compile(compiler);

    expect(Worker).toHaveBeenCalledTimes(1);
    expect(Worker).toHaveBeenLastCalledWith(workerPath, {
      enableWorkerThreads: ENABLE_WORKER_THREADS,
      numWorkers: getParallelism() - 1,
    });
    expect(workerTransform).toHaveBeenCalledTimes(
      Object.keys(stats.compilation.assets).length,
    );
    expect(workerEnd).toHaveBeenCalledTimes(1);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "false" value', async () => {
    new MinimizerPlugin({ parallel: false }).apply(compiler);

    const stats = await compile(compiler);

    expect(Worker).not.toHaveBeenCalled();

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "true" value', async () => {
    new MinimizerPlugin({ parallel: true }).apply(compiler);

    const stats = await compile(compiler);

    expect(Worker).toHaveBeenCalledTimes(1);
    expect(Worker).toHaveBeenLastCalledWith(workerPath, {
      enableWorkerThreads: ENABLE_WORKER_THREADS,
      numWorkers: getParallelism() - 1,
    });
    expect(workerTransform).toHaveBeenCalledTimes(
      Object.keys(stats.compilation.assets).length,
    );
    expect(workerEnd).toHaveBeenCalledTimes(1);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "undefined" value', async () => {
    new MinimizerPlugin({ parallel: undefined }).apply(compiler);

    const stats = await compile(compiler);

    expect(Worker).toHaveBeenCalledTimes(1);
    expect(Worker).toHaveBeenLastCalledWith(workerPath, {
      enableWorkerThreads: ENABLE_WORKER_THREADS,
      numWorkers: getParallelism() - 1,
    });
    expect(workerTransform).toHaveBeenCalledTimes(
      Object.keys(stats.compilation.assets).length,
    );
    expect(workerEnd).toHaveBeenCalledTimes(1);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "2" value', async () => {
    new MinimizerPlugin({ parallel: 2 }).apply(compiler);

    const stats = await compile(compiler);

    expect(Worker).toHaveBeenCalledTimes(1);
    expect(Worker).toHaveBeenLastCalledWith(workerPath, {
      enableWorkerThreads: ENABLE_WORKER_THREADS,
      numWorkers: 2,
    });
    expect(workerTransform).toHaveBeenCalledTimes(
      Object.keys(stats.compilation.assets).length,
    );
    expect(workerEnd).toHaveBeenCalledTimes(1);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "true" value when only one file passed', async () => {
    compiler = getCompiler({
      entry: path.resolve(__dirname, "./fixtures/entry.js"),
    });

    new MinimizerPlugin({ parallel: true }).apply(compiler);

    const stats = await compile(compiler);

    expect(Worker).toHaveBeenCalledTimes(1);
    expect(Worker).toHaveBeenLastCalledWith(workerPath, {
      enableWorkerThreads: ENABLE_WORKER_THREADS,
      numWorkers: Math.min(1, os.cpus().length - 1),
    });
    expect(workerTransform).toHaveBeenCalledTimes(
      Object.keys(stats.compilation.assets).length,
    );
    expect(workerEnd).toHaveBeenCalledTimes(1);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "true" value and the number of files is less than the number of cores', async () => {
    const entries = {};

    for (let i = 0; i < os.cpus().length / 2; i++) {
      entries[`entry-${i}`] = path.resolve(__dirname, "./fixtures/entry.js");
    }

    compiler = getCompiler({ entry: entries });

    new MinimizerPlugin({ parallel: true }).apply(compiler);

    const stats = await compile(compiler);

    expect(Worker).toHaveBeenCalledTimes(1);
    expect(Worker).toHaveBeenLastCalledWith(workerPath, {
      enableWorkerThreads: ENABLE_WORKER_THREADS,
      numWorkers: Math.min(Object.keys(entries).length, os.cpus().length - 1),
    });
    expect(workerTransform).toHaveBeenCalledTimes(
      Object.keys(stats.compilation.assets).length,
    );
    expect(workerEnd).toHaveBeenCalledTimes(1);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "true" value and the number of files is same than the number of cores', async () => {
    const entries = {};

    for (let i = 0; i < os.cpus().length; i++) {
      entries[`entry-${i}`] = path.resolve(__dirname, "./fixtures/entry.js");
    }

    compiler = getCompiler({ entry: entries });

    new MinimizerPlugin({ parallel: true }).apply(compiler);

    const stats = await compile(compiler);

    expect(Worker).toHaveBeenCalledTimes(1);
    expect(Worker).toHaveBeenLastCalledWith(workerPath, {
      enableWorkerThreads: ENABLE_WORKER_THREADS,
      numWorkers: Math.min(Object.keys(entries).length, os.cpus().length - 1),
    });
    expect(workerTransform).toHaveBeenCalledTimes(
      Object.keys(stats.compilation.assets).length,
    );
    expect(workerEnd).toHaveBeenCalledTimes(1);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it('should match snapshot for the "true" value and the number of files is more than the number of cores', async () => {
    const entries = {};

    for (let i = 0; i < os.cpus().length * 2; i++) {
      entries[`entry-${i}`] = path.resolve(__dirname, "./fixtures/entry.js");
    }

    compiler = getCompiler({
      entry: {
        one: path.resolve(__dirname, "./fixtures/entry.js"),
        two: path.resolve(__dirname, "./fixtures/entry.js"),
        three: path.resolve(__dirname, "./fixtures/entry.js"),
        four: path.resolve(__dirname, "./fixtures/entry.js"),
        five: path.resolve(__dirname, "./fixtures/entry.js"),
        six: path.resolve(__dirname, "./fixtures/entry.js"),
        seven: path.resolve(__dirname, "./fixtures/entry.js"),
        eight: path.resolve(__dirname, "./fixtures/entry.js"),
      },
    });

    new MinimizerPlugin({ parallel: true }).apply(compiler);

    const stats = await compile(compiler);

    expect(Worker).toHaveBeenCalledTimes(1);
    expect(Worker).toHaveBeenLastCalledWith(workerPath, {
      enableWorkerThreads: ENABLE_WORKER_THREADS,
      numWorkers: Math.min(Object.keys(entries).length, os.cpus().length - 1),
    });
    expect(workerTransform).toHaveBeenCalledTimes(
      Object.keys(stats.compilation.assets).length,
    );
    expect(workerEnd).toHaveBeenCalledTimes(1);

    expect(readsAssets(compiler, stats)).toMatchSnapshot("assets");
    expect(getErrors(stats)).toMatchSnapshot("errors");
    expect(getWarnings(stats)).toMatchSnapshot("warnings");
  });

  it("should end the worker pool when an asset fails after the worker ran", async () => {
    new MinimizerPlugin({
      parallel: true,
      extractComments: {
        condition: "all",
        banner: () => {
          throw new Error("banner failed");
        },
      },
    }).apply(compiler);

    await expect(compile(compiler)).rejects.toThrow("banner failed");

    // Whatever the pool was started for has to be shut down again — this
    // failure used to leave its workers running.
    expect(Worker).toHaveBeenCalledTimes(1);
    expect(workerEnd).toHaveBeenCalledTimes(1);
  });
});
