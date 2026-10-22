# LiquidGlass 1.0.3

Vendored from the official [`@ybouane/liquidglass@1.0.3` npm package](https://www.npmjs.com/package/@ybouane/liquidglass/v/1.0.3), maintained at [ybouane/liquidglass](https://github.com/ybouane/liquidglass). Imported on 2026-10-15.

`index.js` is based on the complete published `dist/index.js` bundle, including the WebGL renderer, shaders, capture pipeline, and bundled `html-to-image`. The five `.d.ts` files retain the public entry point's complete declaration graph. Final `sourceMappingURL` comments were removed; source maps are not included. The local runtime patches below are also reflected in `LiquidGlass.d.ts` where applicable. Import through `index.js`; the other files provide types only.

Local patches applied on 2026-10-18:

- Add an optional synchronous `beforeRender` initialization hook, invoked inside the render loop's error boundary before size checks, content refreshes, and drawing. The site uses it to synchronize proxy geometry in the same animation frame as rendering.
- Preserve fractional device-pixel origins in `_getPixelRect()` for continuous background sampling. Canvas backing dimensions remain rounded integers; media, captured content, and previously rendered glass all use the same fractional coordinate space.

Shader code, optical parameters, blur passes, and composition order are unchanged.

The npm package runs `patch-package` in `postinstall` but lists it only as a development dependency. A normal rebuild fails because that executable is absent. Vendoring the published browser bundle avoids adding an unrelated install-time dependency tree and requires no runtime dependencies or external CDN.

SHA-256 for the runtime:

| File | SHA-256 |
| --- | --- |
| Original npm `dist/index.js` (103,827 bytes) | `9630e5af0e9c27c3a88a2c4a7096a4f5e0f12e92afc6333f1552835dcc399bed` |
| Initial vendored `index.js`, source-map comment removed (103,793 bytes) | `91e7af06e606f82c6c0f2ca9049db013c0beddeda4ff130ede23970c6c46e029` |
| Locally patched `index.js` (104,009 bytes) | `3087d87cb56aa76717521a845ce5f6440bc2e273bc2376424aff69e9feb1263b` |

Both upstream projects declare MIT licensing; notices and terms are preserved in [LICENSE](./LICENSE). LiquidGlass supplies no copyright notice in its npm artifact, so none has been invented. Its [upstream lockfile](https://github.com/ybouane/liquidglass/blob/main/package-lock.json) resolves `html-to-image` to 1.11.13; the dependency's copyright notice was verified against its [versioned official LICENSE](https://github.com/bubkoo/html-to-image/blob/v1.11.13/LICENSE).

For updates, inspect the upstream release and license notices, replace the complete bundle and declaration graph, review and reapply any still-needed local patches above, record new hashes, and verify rendering and the production build. Keep site-specific lifecycle and layout adaptations in `src/scripts/liquid-glass.ts`.
