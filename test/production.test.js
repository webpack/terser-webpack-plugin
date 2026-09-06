import { EVENT_HANDLER, asFunction, functionBody } from "../src/production";

describe("EVENT_HANDLER", () => {
  it("is the word the caller hands a function body over with", () => {
    expect(EVENT_HANDLER).toBe("event-handler");
  });
});

describe("asFunction", () => {
  it("makes the body a whole script an engine can read", () => {
    expect(asFunction("return  false")).toBe("function _(){return  false\n}");
  });

  it("names the function past any run of `_` the body holds", () => {
    // A body naming the same binding would resolve to the function around it
    // rather than to what it meant.
    expect(asFunction("_( __ )")).toBe("function ___(){_( __ )\n}");
    expect(asFunction("f(_____)")).toBe("function ______(){f(_____)\n}");
  });

  it("ends a line comment the body closes with", () => {
    // Without the newline the brace closing the function would be inside the
    // comment, and nothing could parse what it was handed.
    expect(asFunction("f( 1 ) // done")).toBe("function _(){f( 1 ) // done\n}");
  });
});

describe("functionBody", () => {
  it("reads the body back out of the function", () => {
    expect(functionBody("function _(){f(1)}")).toBe("f(1)");
    expect(functionBody("function ___ ( ) { f(1) }")).toBe("f(1)");
  });

  it("reads one an engine ended with a newline or a `;`", () => {
    // `esbuild` writes the newline, and a declaration may be printed with the
    // semicolon that never belonged to the body.
    expect(functionBody("function _(){return!1}\n")).toBe("return!1");
    expect(functionBody("function _(){return!1};")).toBe("return!1");
  });

  it("declines an answer that is not that one function", () => {
    // Text around it, a second statement, and the empty answer a minimizer
    // dropping an unused declaration gives.
    expect(functionBody("f(1)")).toBeUndefined();
    expect(functionBody("function _(){f(1)}g()")).toBeUndefined();
    expect(functionBody("g();function _(){f(1)}")).toBeUndefined();
    expect(functionBody("")).toBeUndefined();
    expect(functionBody("function (){f(1)}")).toBeUndefined();
    expect(functionBody("function _(a){f(a)}")).toBeUndefined();
  });

  it("declines an answer that is not text at all", () => {
    expect(functionBody(undefined)).toBeUndefined();
  });
});
