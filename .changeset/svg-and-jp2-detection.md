---
"minimizer-webpack-plugin": patch
---

fix what the image minimizers read a format as: SVG and JPEG 2000 are now detected, so a plugin converting an image into SVG is caught rather than writing SVG out under a name claiming a raster format; a PNG is walked chunk by chunk, so a comment mentioning `acTL` no longer makes a still image animated and a colour profile containing `IDAT` no longer hides a real one; and `sharpMinify` no longer offers to minify `raw` assets, which it could only fail on
