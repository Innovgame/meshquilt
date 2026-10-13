# Changelog

This file records changes that users can see. Versions follow repository tags, for example `v0.1.0`.

## Unreleased

## 0.2.0

- Publish one package: `meshquilt`, `meshquilt/draco`, and `meshquilt/worker`. Three.js is no longer a published adapter. MQLT v1 is unchanged.
- Accept Uint16, Uint32, and nonindexed geometry. Encode and decode report progress.
- Add `mergeGeometry` and `encodeDracoInWorker`.
- Cancel active Worker jobs on disposal, timeout, or failure.
- The website can import STL, OBJ, GLB, and MQLT, then compare the decoded mesh.

## 0.1.0

- Split an indexed triangle mesh into chunks and pack the compressed pieces in an `MQLT` container.
- Quantize positions and UVs against one volume for the whole mesh, so chunk boundaries stay on the same grid.
- Read a `THREE.Mesh` and draw decoded chunks as separate children of a `Group`.
- Encode and decode a chunk with an injected Draco module. A worker pool keeps each encoder instance on its own thread.
