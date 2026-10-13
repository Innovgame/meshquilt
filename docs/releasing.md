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

## Optional GitHub release workflow

The checked-in `npm release` workflow is run manually. Select an existing `vX.Y.Z` tag in **Use workflow from**; that tag must already contain the workflow. Running from a branch fails with an explanation. This keeps the workflow source commit and npm provenance aligned with the packaged release. The `publish` checkbox defaults to false. The package job confirms the tag belongs to `main`, runs library/package/Worker checks, validates release notes and produces a downloadable npm archive. It then runs `npm publish --dry-run`, without writing to the registry.

Repository metadata is generated from GitHub's real `GITHUB_REPOSITORY` only inside that release checkout. The source package intentionally has no invented repository/homepage/bugs URLs while it remains local. `release:check --prepare` explicitly writes metadata and requires the actual owner/repository; normal local checks never do this.

For a future actual publish, configure the `meshquilt` npm package's trusted publisher with the GitHub owner/repository, workflow filename `release.yml`, and environment `npm-release`. Enable environment reviewers if you want an approval before publishing. The publish job uses OIDC, publishes the already verified archive and requests provenance. It does not use an npm token stored in source. The registry must already have the trusted publishing relationship configured; first publication or ownership setup may need to be completed separately on npm.

The workflow uses Node.js 24, whose supported npm version must support trusted publishing. npm publish is executed only when `publish` is selected. No workflow run, remote configuration, tagging or npm publishing is performed by adding these files locally.

## Compatibility and distribution

This is an ESM package. The root import has no runtime dependencies or import-time Worker initialization. It accepts Uint16/Uint32 indices and triangle soup, while codec chunks use Uint32 indices. Three.js remains a private integration example. Keep the MQLT version and format explicit when changing data compatibility.
