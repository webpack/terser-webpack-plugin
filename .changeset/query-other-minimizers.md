---
"minimizer-webpack-plugin": minor
---

read transforms off an asset's name in `napiRsImageMinify` and `svgoMinify` too — the same spellings sharp accepts where the two can do the same thing (`width`, `height`, `fit`, `filter`, `rotate`, `flip`, `flop`, `grayscale`, `invert`, `blur`, `quality`, `lossless`, `speed`), plus `precision`, `multipass`, `pretty` and `indent` for svgo; a transform hands its output back to oxipng or mozjpeg so recompression is not lost, and `rotate=auto` skips the decode when the EXIF asks for nothing
