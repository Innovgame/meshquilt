# Changelog

This file records changes that users can see. Versions follow repository tags, for example `v0.1.0`.

## Unreleased

- Add Chunks / Whole mesh display modes to the website playground. Render one merged Mesh with a uniform material while retaining UVs, normals, duplicate seam vertices, stored chunk statistics, and export settings; no topology welding is performed.
- Turn the website's Live geometry preview into a local STL/OBJ/GLB/MQLT playground with real chunk/precision controls, cancellable Worker encoding and decoding, MQLT downloads, and original/decoded comparison. Preserve model coordinates and imported chunk boundaries; bundle Draco assets locally for Pages subpaths.
- Remove the duplicate demo application and consolidate Three.js guidance in the bilingual docs. Run library browser checks without a website server and reuse built artifacts in CI. Retain deprecated quantization helpers in an isolated compatibility module.
- Combine geometry validation with shared-volume preparation, scan attributes once, and skip unused bounds for explicit volumes. Keep standalone validation and remove the extra full validation in the Three.js encoding example.
- Add standard Vitest/TypeScript geometry benchmarks and Playwright Worker/responsiveness measurements sharing fixtures; remove the standalone Worker integration runner.
- Speed up nonindexed splitting, indexed vertex remapping and attribute copies; avoid duplicate full validation and use optional Draco bulk decode APIs with portable fallback.
- Add whole-pipeline `encodeDracoInWorker` with explicit input ownership transfer, typed progress and cancellation for large browser workloads.

- Add release tag/version/changelog guards and a manual dry-run-by-default npm workflow with GitHub-derived metadata and optional trusted publishing.

- Consolidate publication into `meshquilt`, `meshquilt/draco` and the `meshquilt/worker` asset. Move Three.js conversion and its tests into a private source example; the library has no runtime or peer dependencies.
- Accept Uint16Array, Uint32Array and nonindexed geometry inputs. Normalize codec/output indices to Uint32 per chunk and add typed encode/decode progress events.
- Reorganize internal geometry/quantization/container/codec/runtime modules and migrate documentation, website, examples and consumer checks while preserving MQLT v1.

- End queued and active Worker jobs on disposal, cancellation, timeout or runtime failure; clean up partial startup and share one typed encoder implementation between main thread and Workers.
- Produce geometry chunks lazily during encoding, stop scheduling on the first failure, and add opt-in zero-copy compressed payload decoding.
- Reject non-finite geometry and invalid MQLT metadata; normalize shared quantization to header float32 precision.
- Support minimum-version interleaved Three.js attributes and custom local matrices; reject unsupported materials, deformation data and partial draw ranges before encoding.
- Emit native ESM-compatible package imports and verify packed exports/declarations, real Draco round trips and browser Workers.
- Upgrade third-party dependencies to current stable versions, including TypeScript 7 compilation, Vite 8, Vitest 5, React 19.3 and Three.js 0.186; retain the TypeScript 6 API for ESLint compatibility and Three.js 0.160 as a test fixture.

## 0.1.0

- Split an indexed triangle mesh into chunks and pack the compressed pieces in an `MQLT` container.
- Quantize positions and UVs against one volume for the whole mesh, so chunk boundaries stay on the same grid.
- Read a `THREE.Mesh` and draw decoded chunks as separate children of a `Group`.
- Encode and decode a chunk with an injected Draco module. A worker pool keeps each encoder instance on its own thread.
