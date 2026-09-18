# Third-party components

This build bundles the components listed below. Each one keeps its own
licence; the notices here are provided in addition to `LICENSE` and `NOTICE`,
not instead of them. No original attribution has been removed.

## Application

- **FlowRun** — https://github.com/sacode387/FlowRun
  Apache License 2.0, Copyright 2021 SaCode (Sakib Hadziavdic).
  Full text in `LICENSE`. This build is a modified version; see `NOTICE`.
- **Scala 3 and Scala.js runtime** — Apache License 2.0,
  Copyright EPFL and Lightbend, Inc.
  Compiled into `scripts/compiled/main.js`.

## Bundled libraries (`vendor/`)

| Component | Version | Licence | Files |
|---|---|---|---|
| [D3](https://d3js.org) — Copyright 2010–2023 Mike Bostock | 7.9.0 | ISC | `vendor/d3.min.js` |
| [d3-graphviz](https://github.com/magjac/d3-graphviz) — Copyright Magnus Jacobsson | — | BSD-3-Clause | `vendor/d3-graphviz.min.js` |
| [@hpcc-js/wasm](https://github.com/hpcc-systems/hpcc-js-wasm) (bundles [Graphviz](https://graphviz.org)) | — | Apache-2.0 (Graphviz: EPL-1.0) | `vendor/graphviz.umd.js` |
| [PrismJS](https://prismjs.com) — Copyright Lea Verou | 1.27.0 | MIT | `vendor/prism.js`, `vendor/prism.css` |
| [Toastify JS](https://github.com/apvarun/toastify-js) — Copyright Varun A P | 1.12.0 | MIT | `vendor/toastify-js.js`, `vendor/toastify.min.css` |
| [reCoding File Picker](https://recoding.cloud/js/recoding-file-picker.js) — reCoding platform, adapted for Bearer-token access | — | as published by reCoding | `vendor/recoding-file-picker.js` |
| [Material Icons](https://fonts.google.com/icons) — Copyright Google Inc. | — | Apache-2.0 | `vendor/materialicons.woff2`, `vendor/material-icons.css` |

The application icon (`icona.svg`, `favicon.ico`, `icona-*.png`) was drawn for
this project and is covered by `LICENSE`.
