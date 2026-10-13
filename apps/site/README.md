# MeshQuilt website

The independent project website for GitHub Pages. Built with React 19, Vite 8, Tailwind CSS 4, shadcn-style Radix components, Lucide, and Three.js.

## Development

From the repository root:

```bash
pnpm install
pnpm site
pnpm site:build
pnpm site:preview
pnpm --filter @meshquilt/site exec playwright install chromium
pnpm site:test
```

English is the default. Language and theme persist locally. API guides live in `docs/`, Chinese translations in `docs/zh/`; `src/lib/docs.ts` maps both sets into the website. The contribution guide and changelog are imported from their canonical root files. Update both languages when APIs change. Version comes from the published library's package metadata. Examples use array-first `meshquilt` and `meshquilt/draco`; Three.js is used only to render the preview and in the private integration example.

The homepage explains shared quantization, whole-pipeline Workers, chunk pools and direct encoding. Its execution guide shows thread placement and input ownership; the default code example preserves input buffers with `transferInput: false`. `#/execution` and `#/performance` link directly to these sections.

The performance comparison is a fixed local measurement snapshot from `docs/performance.md`, not a browser benchmark. It switches between indexed geometry and triangle soup and compares encoding time, main-thread timer delay and encoder WASM capacity separately. Update the source snapshot, date and sampling conditions when the canonical benchmark documentation changes. The preparation note describes Vitest preprocessing savings, not total Draco encoding gains. Homepage-specific layout styles live in `src/pages/home.css`.

Live geometry is a local mesh playground. Its default indexed torus knot has 7,200 triangles split into 16 chunks of at most 450 triangles. Select **Import model** or drop an STL, OBJ, GLB, or `.mqlt` file onto the preview. Static GLB meshes are merged after applying node transforms; the camera scales only the rendering copy, so exports retain model coordinates. Materials, textures, colors, scene hierarchy, and animations are not stored in MQLT. GLBs must be self-contained and have uncompressed triangle geometry; skinning, morph targets, animation, and instancing are unsupported. For mixed attributes, normals/UVs are retained only when every mesh has them; missing normals are computed for rendering only.

Choose triangles per chunk and position precision; normal/UV precision lives in the advanced section. Normal export precision is capped at 24 bits to avoid high-bit octahedral arithmetic failures in Draco 1.5.7; position/UV settings support up to 30 bits. Imported files still display their original stored bit counts. **Encode & download** uses `encodeDracoInWorker`, which runs the library's `encodeGeometry` pipeline, and downloads a Draco-backed MQLT container. **Preview encoded result** decodes those exact bytes and enables original/decoded comparison. Downloaded MQLT files can also be imported directly; their stored chunk boundaries and quantization bits are retained in the preview. Re-encoding uses the current settings. Changing a model or setting invalidates previous export/comparison results. The displayed size ratio compares MQLT bytes with typed geometry buffers, not the input file's size. Quantization is lossy; the grid step uses model units and the timing describes this operation, not a benchmark.

Parsing, splitting, and decoding run in a cancellable site Worker; encoding uses the library's classic Worker without detaching preview inputs. The playground caps imports at 100 MiB, two million triangles, six million vertices, and 1,000 preview chunks. Failed imports retain the last model. WebGL failure has a readable fallback. Automatic rotation is opt-in, respects reduced motion, and pauses when the preview is outside the viewport or the tab is hidden.

Use **Chunks / Whole mesh** to inspect either independently colored chunks or one merged Mesh with a uniform preview material. Whole mode sets separation to zero and disables its slider; returning to chunks starts at zero separation. Mode switches preserve the camera and remain available for imported MQLT and original/decoded comparison. Stored chunk statistics and encoding settings remain independent of the display mode. The whole Mesh uses the already merged geometry, preserves UVs and existing normals, and keeps duplicate seam vertices without welding. Missing normals are computed on the displayed geometry only; this does not reconstruct cross-chunk vertex sharing or guarantee smooth shading across every boundary. Textures are not displayed by the uniform preview material.

## GitHub Pages

1. Push this repository to GitHub with a `main` branch.
2. In **Settings → Pages → Build and deployment**, set **Source** to **GitHub Actions**.
3. The `GitHub Pages` workflow runs desktop/mobile browser and accessibility checks, builds on pull requests, and deploys on pushes to `main` or manual runs. Approve the `github-pages` environment if your repository requires it.

The build derives the repository URL and project subpath from GitHub's environment. It also supports user/organization repositories named `*.github.io`, which use `/`. Hash routes make docs refreshable on Pages without a server rewrite or custom 404 script.

For a custom domain, configure it in GitHub Pages, add `public/CNAME` with your domain, and set repository Actions variable `SITE_BASE` to `/`.

Set Actions variable `VITE_SITE_URL` to your full custom URL for canonical and social metadata. By default, metadata uses the repository's `github.io` URL. The site includes a 1200×630 PNG sharing image with its editable SVG source.

## Local configuration

Optional `apps/site/.env.local`:

```dotenv
VITE_REPOSITORY_URL=https://github.com/your-org/meshquilt
SITE_BASE=/meshquilt/
VITE_SITE_URL=https://your-org.github.io/meshquilt/
```

An unset repository URL uses GitHub repository search during local development. No fabricated repository owner is embedded in the site. To preview a project-path build, open `/meshquilt/` on the preview server, not `/`.

Fonts are bundled locally. The only external navigation is to GitHub; the preview has no external model, Draco, or CDN dependency. The Vite codec plugin serves and emits pinned Draco 1.5.7 encoder/decoder JS and WASM plus a freshly built library Worker under `assets/codec/`, respecting the site's base path. Codec resources load only when used. The website owns its Draco dependency; the publishable library remains dependency-free. Draco's Apache-2.0 license and decoder modification notice are included in `public/draco-license.txt`. Static identity assets live in `public/`. Accessible Radix dialog, tabs, and slider primitives are customized through the website's token system; `components.json` supports the shadcn CLI.

## Validation

```bash
pnpm check
pnpm test
pnpm site:build
pnpm site:test
```

Check the homepage and docs at desktop and mobile widths, language/theme switches, search (`Ctrl/Cmd+K`), code copying, keyboard navigation, and a production build under the repository subpath before shipping.

This Playwright configuration covers the website only. Library Worker tests and browser benchmarks use `packages/meshquilt/playwright.config.ts` and intercepted assets, with no website server dependency.
