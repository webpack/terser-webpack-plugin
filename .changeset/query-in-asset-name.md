---
"minimizer-webpack-plugin": patch
---

match `test`, `include` and `exclude` against the asset name without its query and fragment as well as with them, so a rule written as `/\.png$/` still accepts assets whose emitted name carries one — `output.assetModuleFilename` is `[hash][ext][query][fragment]` by default, so it usually does
