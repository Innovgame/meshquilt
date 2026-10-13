# Contributing

Thanks for improving MeshQuilt. The library splits a `THREE.Mesh` into chunks, compresses those chunks in the browser, and draws them back without opening quantization seams.

## Setup

- Node.js 22.12+, 24+ or 26+
- pnpm 10.33.0

```bash
pnpm install
pnpm demo
```

## Checks before a pull request

```bash
pnpm check
pnpm test
pnpm test:packages
```

`pnpm check` runs Prettier, ESLint, and `tsc --noEmit`. Run `pnpm build` when you change package exports or the demo.

Builds and type checks use TypeScript 7 through the `typescript-compiler` alias. Root `typescript` intentionally provides the 6.0 API needed by the current typescript-eslint. The `three-min` alias is pinned to 0.160.0 for compatibility tests; other direct dependencies track current stable versions. See [runtime notes](docs/runtime-and-memory.md).

`pnpm test:packages` builds and packs all three libraries, installs them in a temporary consumer, and checks native ESM exports and NodeNext declarations. For changes to Draco or its Worker protocol, also run:

```bash
pnpm --filter @meshquilt/draco exec playwright install chromium
pnpm test:workers
```

Edit `packages/draco/src/worker.ts` and the shared encoder source, then rebuild. The checked-in `worker/encode.worker.js` is generated; its source is linted and type checked. Keep its public export a classic Worker asset.

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
2. Set the same version in the root `package.json` and in every publishable package under `packages/`.
3. Commit those changes.
4. Wait until CI passes for that commit.
5. Tag and push the tag:

```bash
git tag v0.1.1
git push origin v0.1.1
```

Before the first publish, add a `repository` field to each publishable package. Package publish should reject a tag that does not match those package versions.

## Reporting issues

- Defects: [bug report](.github/ISSUE_TEMPLATE/bug_report.md)
- New capability: [feature request](.github/ISSUE_TEMPLATE/feature_request.md)
- Vulnerabilities: [SECURITY.md](SECURITY.md). Do not open a public issue.
