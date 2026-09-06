/**
 * Which production of a language an embedded body is written in.
 *
 * `as` carries it — a `style=""` arrives as `css` with `as: "block-contents"`,
 * a `<script type=module>` as `javascript` with `as: "module"`. A minimizer
 * whose engine reads that production takes the body as written; the built-in
 * JavaScript ones read `module` themselves, and translate the one production no
 * JavaScript engine parses on its own: an event handler attribute's function
 * body, which is minified as the function it belongs to.
 */

const EVENT_HANDLER = "event-handler";

/**
 * The function a body handed out as an event handler belongs to. Named past any
 * run of `_` the body holds, so nothing in it resolves to the function instead
 * of what it meant; the newline ends a line comment the body may close with.
 * @param {string} body the handler's text
 * @returns {string} the script it is the body of
 */
function asFunction(body) {
  const runs = body.match(/_+/g);
  const longest = runs
    ? runs.reduce((widest, run) => Math.max(widest, run.length), 0)
    : 0;

  return `function ${"_".repeat(longest + 1)}(){${body}\n}`;
}

/**
 * The handler body inside the function a minimizer answered with. `undefined`
 * for an answer that is not that function — one holding anything else, or one
 * that dropped it whole as the unused declaration it is.
 * @param {string | undefined} answered what the minimizer answered
 * @returns {string | undefined} the body, or undefined
 */
function functionBody(answered) {
  if (typeof answered !== "string") return undefined;

  // Trimmed first: an engine may end what it writes with a newline, and a
  // trailing `;` is the declaration's own rather than the body's.
  const written = answered.trim().replace(/;$/, "");
  const opened = written.indexOf("{");

  return opened !== -1 &&
    written.endsWith("}") &&
    /^function\s+[^\s(]+\s*\(\s*\)\s*$/.test(written.slice(0, opened))
    ? written.slice(opened + 1, -1).trim()
    : undefined;
}

module.exports = { EVENT_HANDLER, asFunction, functionBody };
