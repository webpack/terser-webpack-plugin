---
"minimizer-webpack-plugin": minor
---

read `width`, `height` and `unit` off an asset's name in `sharpMinify`, so `import banner from "./banner.png?width=320"` resizes that image — `w`/`h`/`u` are accepted as short forms, `auto` drops a configured dimension, and the query overrides `minimizerOptions.resize`
