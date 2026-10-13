# Contributing

Thanks for improving MeshQuilt. The library splits a `THREE.Mesh` into chunks, compresses those chunks in the browser, and draws them back without opening quantization seams.

## Setup

- Node.js 22
- pnpm 10+

```bash
pnpm install
pnpm demo
```

## Checks before a pull request

```bash
pnpm check
pnpm test
```

`pnpm check` runs Prettier, ESLint, and `tsc --noEmit`. Run `pnpm build` when you change package exports or the demo.

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
