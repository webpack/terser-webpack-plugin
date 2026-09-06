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
export const EVENT_HANDLER: "event-handler";
/**
 * The function a body handed out as an event handler belongs to. Named past any
 * run of `_` the body holds, so nothing in it resolves to the function instead
 * of what it meant; the newline ends a line comment the body may close with.
 * @param {string} body the handler's text
 * @returns {string} the script it is the body of
 */
export function asFunction(body: string): string;
/**
 * The handler body inside the function a minimizer answered with. `undefined`
 * for an answer that is not that function — one holding anything else, or one
 * that dropped it whole as the unused declaration it is.
 * @param {string | undefined} answered what the minimizer answered
 * @returns {string | undefined} the body, or undefined
 */
export function functionBody(answered: string | undefined): string | undefined;
