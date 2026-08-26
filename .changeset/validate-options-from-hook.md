---
"minimizer-webpack-plugin": minor
---

validate options from webpack's `validate` hook instead of from the constructor, so `validate: false` skips validation, falling back to `schema-utils` on webpack versions without the hook
