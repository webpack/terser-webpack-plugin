---
"minimizer-webpack-plugin": patch
---

invalidate the persistent cache when `generate` or `generatorOptions` change, so a restored module no longer keeps the previous generator's bytes and name
