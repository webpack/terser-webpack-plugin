---
"minimizer-webpack-plugin": patch
---

keep every asset's extracted comments when several share a comments file they do not reach in a row, or when another plugin already emitted it; end the worker pool when an asset fails after the pool started; honour an explicit `minimizerOptions.module: false` over the value webpack inferred; and stop a composed source map attributing generated code the input map never covered, or dropping an empty `sourcesContent` entry
