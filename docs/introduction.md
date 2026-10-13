# Meet MeshQuilt

MeshQuilt is an array-first TypeScript mesh codec. It splits triangle geometry into smaller pieces, gives those pieces one shared quantization grid, and packs encoded chunks in an MQLT container.

## One package, clear entrypoints

| Import           | Responsibility                                                           |
| ---------------- | ------------------------------------------------------------------------ |
| meshquilt        | Typed geometry, lazy splitting, shared quantization and MQLT read/write. |
| meshquilt/draco  | Injectable Draco encode/decode adapters and a browser Worker pool.       |
| meshquilt/worker | A generated classic Worker asset for browser applications to deploy.     |

The root import has no runtime dependencies. It does not load Draco binaries, require Three.js, or initialize Workers. Draco is optional and injected. The Three.js integration is a tested source example, not a published adapter package.

## One mesh, one grid

Chunk boundaries can copy the same vertex into adjacent chunks. Independent chunk bounding boxes would quantize that vertex differently. MeshQuilt measures one position and one UV volume across the complete input, so identical boundary vertices stay on the same grid.

## What to know first

- Inputs are typed arrays, with optional Uint16Array or Uint32Array indices. Missing indices mean triangle soup.
- Positions and normals use xyz; UVs use uv. Compute smooth normals on the complete mesh before splitting.
- Decoding returns raw independent chunks, ready for your own rendering or processing.
- Model loading, materials, scene transforms and business metadata belong to your application.
- Draco scripts and WASM are supplied separately; Draco uses Apache-2.0 and MeshQuilt uses MIT.
- Whole-buffer output still occupies memory proportional to the model. The live visualization is a geometry preview, not a performance benchmark.

Continue with [Quick start](quick-start.md), the [geometry API](geometry.md), or [Three.js integration](three.md).
