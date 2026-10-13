# Changelog

This file records changes that users can see. Versions follow repository tags, for example `v0.1.0`.

## Unreleased

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
