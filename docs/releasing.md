# Local release preparation

The repository can be developed, built and packed entirely locally. No remote repository is required for those operations, and no registry publishing occurs during tests. The only publishable workspace is `packages/meshquilt`.

## Verify and pack locally

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm test:release
pnpm test:packages
pnpm test:workers
pnpm site:test
pnpm build
```

`test:packages` builds the library, packs it and installs that archive in an isolated temporary consumer. It verifies the root, Draco and Worker entrypoints, the included LICENSE, TypeScript declarations and absence of a Three.js dependency. It does not publish to npm.

To keep a local archive:

```bash
pnpm --filter meshquilt pack --pack-destination .tmp/release
```

Run this from the repository root; the archive destination is relative to the terminal's working directory. Keep generated release files outside tracked source.

## Release version guard

Before a release, move all `Unreleased` changes under the target version in `CHANGELOG.md`, and set that version in both the root workspace and the library package. Each release must have a nonempty changelog entry. Then run, for example:

```bash
pnpm release:check v0.1.1
```

This command is read-only. It rejects an incorrect tag, mismatched workspace/package versions, a private/wrong package, unarchived changes and missing release notes. Stable versions use npm tag `latest`; prerelease versions use `next`. Development checks intentionally continue to pass with an `Unreleased` section containing changes; only the release guard blocks publishing that state.

Do not publish `Unreleased` changes under an existing tag. Move them into the target version first.

## Release workflow

`.github/workflows/release.yml` must run from an existing `vX.Y.Z` tag. Running from a branch fails. Publishing a GitHub Release for that tag publishes the registries. A manual run stays a dry run unless `publish` is selected.

The package job confirms the tag belongs to `main`, runs the library checks, writes repository metadata from `GITHUB_REPOSITORY`, and packs two archives. npm receives `meshquilt`. GitHub Packages receives `@<owner>/meshquilt`, because that registry only accepts a scope matching the repository owner. The source package name stays `meshquilt`.

Registry publication uses the `npm-release` environment. npm uses the `NPM_TOKEN` repository secret and requests provenance. GitHub Packages uses `GITHUB_TOKEN`. Neither token is stored in source. Add environment reviewers if a publish should wait for approval.

No workflow run, remote configuration, tagging, or registry publishing happens just by adding these files locally.

## Compatibility and distribution

This is an ESM package. The root import has no runtime dependencies or import-time Worker initialization. It accepts Uint16/Uint32 indices and triangle soup, while codec chunks use Uint32 indices. Three.js remains a private integration example. Keep the MQLT version and format explicit when changing data compatibility.
