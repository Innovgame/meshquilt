# MeshQuilt

[English](README.md) | [简体中文](README.zh-CN.md)

Chunk a `THREE.Mesh` in the browser, compress the pieces in parallel, and draw them back without cracking the seams.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Version `0.1.0`. Changes are in [CHANGELOG.md](CHANGELOG.md).

3MF, glTF, and STL stay outside this library. Load those files into a `THREE.Mesh`, then pass the mesh here.

## Packages

| Package            | Role                                                                           |
| ------------------ | ------------------------------------------------------------------------------ |
| `@meshquilt/core`  | Split chunks, shared quantization, `MQLT` container. No three.js and no Draco. |
| `@meshquilt/three` | Read a `THREE.Mesh` and draw decoded chunks as a `Group`.                      |
| `@meshquilt/draco` | Draco encode and decode adapters, plus a worker pool.                          |
| `@meshquilt/demo`  | Browser page for the split and the seam check.                                 |
| `@meshquilt/site`  | Independent project website and searchable documentation for GitHub Pages.     |

## Quick start

```bash
pnpm install
pnpm demo
```

```ts
import { decodeMesh, encodeMesh } from "@meshquilt/three";
import { createDracoChunkEncoder, decodeDracoChunk } from "@meshquilt/draco";

const encoderModule = await DracoEncoderModule({});
const buffer = await encodeMesh(mesh, {
    maxTriangles: 100_000,
    encodeChunk: createDracoChunkEncoder(encoderModule)
});

const group = await decodeMesh(buffer, (bytes) => decodeDracoChunk(decoderModule, bytes), mesh);
mesh.parent?.add(group);
```

`createDracoChunkEncoder` must not run concurrently on one Draco module. For parallel encoding, use `createDracoWorkerPool` and keep the pool at 2 to 4 workers. Each worker holds one chunk and one wasm heap.

## What it does

- Splits an indexed triangle mesh into chunks so the encoder never sees the whole vertex buffer at once.
- Measures one position volume and one UV volume for the source mesh. Every chunk quantizes against those volumes.
- Leaves normals on Draco's octahedral grid. The same bit count keeps identical unit normals aligned across chunks.
- Packs chunk bytes in a small `MQLT` container. The container does not require Draco. The Draco adapter is one encoder you can pass in.
- Returns decoded chunks as separate meshes. It does not weld them back into one buffer.

## Limits

- The source mesh has one material. Split multi-material groups before encoding.
- Bake skinned, instanced and morph-target meshes to static geometry. Extract partial draw ranges before encoding.
- UV item size is 2. Normal and position item size is 3.
- Smooth normals must be computed on the complete mesh before the split. Per-chunk normals turn the cut into a hard edge.
- A bit count of `0` skips quantization for that attribute. Defaults are 14 position bits, 8 normal bits, and 10 UV bits.
- The demo does not ship `draco_encoder.js`. Load a Draco build yourself. Draco is Apache-2.0.

Details are in [quantization](docs/quantization.md) and the [container format](docs/container-format.md).

## Project website

The independent React website includes a live mesh splitting visualization, searchable documentation, English/Chinese content, and light/dark themes.

```bash
pnpm site
pnpm site:build
pnpm site:preview
```

See [website setup](apps/site/README.md) for GitHub Pages deployment. The Pages workflow deploys `apps/site/dist` from `main`; choose **GitHub Actions** as the Pages source in repository settings.

## Development

Node.js 22.12+, 24+ or 26+, with pnpm 10.33.0.

```bash
pnpm install
pnpm check
pnpm test
pnpm test:packages
pnpm build
```

`pnpm check` runs Prettier, ESLint, and the TypeScript project. See [CONTRIBUTING.md](CONTRIBUTING.md).

Encoding generates chunks lazily, but still keeps the source geometry and complete compressed output. See [runtime, memory and cancellation](docs/runtime-and-memory.md) for ownership, Worker failure semantics and zero-copy decoding. TypeScript 7 runs builds; a parallel TypeScript 6 installation supplies the API required by the current ESLint parser.

## License

MIT. See [LICENSE](LICENSE).
