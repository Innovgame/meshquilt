<h1 align="center">MeshQuilt</h1>
<h3 align="center">
  Large meshes. One shared grid.<br />
  Array-first TypeScript mesh codec
</h3>

<p align="center">
  <a href="README.md">English</a>
  ·
  <a href="README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/meshquilt"><img alt="npm" src="https://img.shields.io/npm/v/meshquilt?color=CB3837&label=npm"></a>
  <a href="https://github.com/Innovgame/meshquilt/releases"><img alt="version" src="https://img.shields.io/github/v/release/Innovgame/meshquilt?color=0368FF&label=version"></a>
  <a href="https://github.com/Innovgame/meshquilt/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/Innovgame/meshquilt/ci.yml?branch=main&label=ci"></a>
  <a href="LICENSE"><img alt="license" src="https://img.shields.io/github/license/Innovgame/meshquilt?color=FF2B6E"></a>
</p>

<a href="https://innovgame.github.io/meshquilt/"><img alt="MeshQuilt website Live geometry preview" src="docs/images/live-geometry.png"></a>

```bash
npm install meshquilt
```

The same release is also published as `@innovgame/meshquilt` on GitHub Packages.

## Table of Contents

1. [Why MeshQuilt?](#why-meshquilt)
2. [Entrypoints](#entrypoints)
3. [Website](#website)
4. [Documentation](#documentation)
5. [License](#license)
6. [Contribute](#contribute)

## Why MeshQuilt?

- **One grid for every chunk.** Positions and UVs are quantized against one volume, so a vertex copied onto a chunk boundary stays on the same grid.
- **Array-first.** Typed arrays in, typed arrays out. The root import has no runtime dependencies and does not load Draco, Three.js, or Workers.
- **Independent chunk compression.** Inject your own Draco encoder, or move the pipeline into a Worker. Draco binaries stay in your application.
- **An explicit container.** Encoded chunks are packed in MQLT. Decoding returns independent chunks for your renderer.

## Entrypoints

| Import              | Responsibility                                                              |
| ------------------- | --------------------------------------------------------------------------- |
| `meshquilt`         | Geometry, splitting, shared quantization, merge, and the MQLT container.   |
| `meshquilt/draco`   | Injected Draco adapters and a browser Worker pool.                          |
| `meshquilt/worker`  | Classic Worker asset. Your application serves it.                           |

There is no published Three.js adapter. Materials, transforms, and model loading belong to your application. A tested integration lives in [`examples/three`](examples/three/README.md).

### Encode and decode

```ts
import { encodeGeometry, decodeGeometry } from "meshquilt";
import { createDracoChunkEncoder, decodeDracoChunk } from "meshquilt/draco";

const geometry = {
    position: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    index: new Uint16Array([0, 1, 2])
};

// Load and initialize your own Draco modules first.
const bytes = await encodeGeometry(geometry, {
    maxTriangles: 100_000,
    encodeChunk: createDracoChunkEncoder(encoderModule)
});
const decoded = await decodeGeometry(bytes, (payload) => decodeDracoChunk(decoderModule, payload));
```

Uint16, Uint32, and nonindexed triangle soup are accepted. See the [quick start](docs/quick-start.md).

### Merge chunks

```ts
import { mergeGeometry } from "meshquilt";

const geometry = mergeGeometry(decoded.chunks);
```

Merging is optional. It keeps seam vertices and does not weld or requantize. See the [geometry API](docs/geometry.md#merge-geometry).

### Workers

```ts
import { createDracoWorkerPool } from "meshquilt/draco";

const pool = await createDracoWorkerPool({
    workerUrl,
    encoderScriptUrl: "/draco/draco_encoder.js",
    size: 2
});
```

Serve `meshquilt/worker` as a classic Worker. Keep the pool at 2–4 workers. See [browser Workers](docs/workers.md).

## Website

The [project website](https://innovgame.github.io/meshquilt/) shows real chunk splitting, imports STL, OBJ, GLB, and MQLT, and includes searchable English and Chinese docs.

```bash
pnpm install
pnpm site
```

Pages deployment is documented in [apps/site/README.md](apps/site/README.md).

## Documentation

- [Quick start](docs/quick-start.md)
- [Geometry API](docs/geometry.md)
- [Draco adapter](docs/draco.md)
- [Browser Workers](docs/workers.md)
- [Three.js example](docs/three.md)
- [Quantization and seams](docs/quantization.md)
- [MQLT container](docs/container-format.md)
- [Runtime and memory](docs/runtime-and-memory.md)
- [Migration](docs/migration.md)
- [Performance](docs/performance.md)
- [Changelog](CHANGELOG.md)

## License

- MeshQuilt is [MIT licensed](LICENSE).
- Draco binaries are supplied by your application and remain Apache-2.0.

## Contribute

Issues and pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before starting. Report vulnerabilities through [SECURITY.md](SECURITY.md).

Node.js 22.12+, 24+, or 26+, and pnpm 10.33.0.

```bash
pnpm install
pnpm check
pnpm test
pnpm test:packages
pnpm test:release
```

---

MeshQuilt © 2026 MeshQuilt contributors
