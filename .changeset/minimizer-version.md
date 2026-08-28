---
"minimizer-webpack-plugin": patch
---

read a minimizer package's version past an `exports` that hides its `package.json` — `sharpMinify`, `svgoMinify` and `imageminMinify` reported no version, so every build hashed the same `0.0.0` and upgrading one of those packages did not invalidate what it had already minified
