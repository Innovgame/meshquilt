# Changelog

This file records changes that users can see. Versions follow repository tags, for example `v0.1.0`.

## Unreleased

## 0.1.0

- Split an indexed triangle mesh into chunks and pack the compressed pieces in an `MQLT` container.
- Quantize positions and UVs against one volume for the whole mesh, so chunk boundaries stay on the same grid.
- Read a `THREE.Mesh` and draw decoded chunks as separate children of a `Group`.
- Encode and decode a chunk with an injected Draco module. A worker pool keeps each encoder instance on its own thread.
