---
"minimizer-webpack-plugin": patch
---

read `as` on an embedded JavaScript body as the built-in minimizers' own `module` option, so a module script is not read as a classic one and the engine is never handed the word
