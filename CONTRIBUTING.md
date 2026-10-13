# Contributing

Thanks for improving MeshQuilt. The array-first TypeScript library splits triangle geometry, compresses independent chunks, and keeps shared vertices on one quantization grid. Rendering integration belongs to private examples.

## Setup

- Node.js 22.12+, 24+ or 26+
- pnpm 10.33.0

```bash
pnpm install
pnpm site
```

## Checks before a pull request

```bash
pnpm check
pnpm test
pnpm test:packages
pnpm test:release
```

`pnpm check` runs Prettier, ESLint, and `tsc --noEmit`. Run `pnpm build` when you change package exports or the website.

Builds and type checks use TypeScript 7 through the `typescript-compiler` alias. Root `typescript` intentionally provides the 6.0 API needed by the current typescript-eslint. The `three-min` alias is pinned to 0.160.0 for compatibility tests; other direct dependencies track current stable versions. See [runtime notes](docs/runtime-and-memory.md).

`pnpm test:packages` builds and packs the single `meshquilt` library, installs it in a temporary consumer without Three.js, and checks root/Draco/Worker exports, native ESM imports and NodeNext declarations. For changes to Draco or its Worker protocol, also run:

```bash
pnpm --filter meshquilt exec playwright install chromium
pnpm test:workers
```

The library's Playwright configuration is `packages/meshquilt/playwright.config.ts`. Its shared fixture fulfills browser, Worker and WASM requests directly; it needs no website build or HTTP server. The website keeps its own Pages/subpath configuration.

CI runs `pnpm build` once, then `pnpm test:packages:built` and `pnpm test:workers:built` reuse those artifacts. Use these commands only after building the current source; normal `test:packages` and `test:workers` prepare their own artifacts. `prepack` still builds for regular package consumers.

Edit `packages/meshquilt/src/runtime/worker.ts` and the shared encoder source, then rebuild. The checked-in `worker/encode.worker.js` is generated; its source is linted and type checked. Keep its public export a classic Worker asset.

## Performance benchmarks

Run `pnpm bench` through Vitest for geometry/codec stages, and `pnpm bench:browser` through the existing Playwright config for UI responsiveness and WASM capacity. Keep benchmark fixtures in TypeScript and reuse them across runners. Worker integration tests share the same Playwright asset fixture. Timing thresholds are not part of normal CI. See [benchmark methods](docs/performance.md).

## Website development

Run `pnpm site` to start the independent React website. See [website setup](apps/site/README.md) for the design, content, and Pages configuration. When changing website behavior, install Chromium once and run the browser checks:

```bash
pnpm --filter @meshquilt/site exec playwright install chromium
pnpm site:test
```

The browser suite checks desktop/mobile layouts, document routes under a Pages subpath, keyboard controls, search, language/theme persistence, code copying, WebGL fallback, and accessibility. Keep Chinese translations aligned with their source Markdown.

## Commits

Use a short English conventional commit, such as `fix:`, `feat:`, `docs:`, or `ci:`. Say what a user can observe.

## Releases

Releases are cut from `main` with a `v*` tag. Do not keep a long-lived release branch.

1. Move the `Unreleased` notes in [CHANGELOG.md](CHANGELOG.md) under the new version heading, for example `## 0.1.1`.
2. Set the same version in the root workspace `package.json` and in `packages/meshquilt/package.json`, the only publishable package.
3. Commit those changes.
4. Wait until CI passes for that commit.
5. Tag and push the tag:

```bash
git tag v0.1.1
git push origin v0.1.1
```

Run `pnpm release:check vX.Y.Z` before tagging: it validates the exact package/workspace version, empty Unreleased section and the version's release notes. `examples/three` is private and is never published. See [local release preparation](docs/releasing.md) for packing, metadata and the manual dry-run-by-default release workflow. Keep real repository metadata unset until a remote is selected; GitHub release packaging derives it from the actual repository.

## Reporting issues

- Defects: [bug report](.github/ISSUE_TEMPLATE/bug_report.md)
- New capability: [feature request](.github/ISSUE_TEMPLATE/feature_request.md)
- Vulnerabilities: [SECURITY.md](SECURITY.md). Do not open a public issue.
