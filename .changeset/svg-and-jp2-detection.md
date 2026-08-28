---
"minimizer-webpack-plugin": patch
---

read SVG and JPEG 2000 when detecting what format a minimizer wrote, so a plugin that converts an image into SVG is caught rather than writing SVG out under a name claiming a raster format — SVG carries no signature, so leaving it out made "not SVG" and "not recognized" the same answer
