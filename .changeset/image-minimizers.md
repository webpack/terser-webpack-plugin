---
"minimizer-webpack-plugin": minor
---

add built-in image minimizers `sharpMinify`, `svgoMinify` and `imageminMinify` from `image-minimizer-webpack-plugin`, and dispatch the worker pool per asset so a minimizer that cannot use it no longer takes it from the others
