# MeshQuilt

[English](README.md) | [简体中文](README.zh-CN.md)

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Version 0.2.0. See [CHANGELOG.md](CHANGELOG.md).

Array-first TypeScript mesh codec. Split triangle geometry, compress chunks independently, and keep neighboring chunks on one quantization grid.

## Install

```bash
npm install meshquilt
```

The same release is also published to GitHub Packages as `@innovgame/meshquilt`.

## Encode

```ts
import { encodeGeometry, decodeGeometry } from "meshquilt";
import { createDracoChunkEncoder, decodeDracoChunk } from "meshquilt/draco";

const geometry = {
    position: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    index: new Uint16Array([0, 1, 2])
};
// Load and initialize your own Draco encoder/decoder modules first.
const bytes = await encodeGeometry(geometry, {
    maxTriangles: 100_000,
    encodeChunk: createDracoChunkEncoder(encoderModule),
    onProgress({ completedChunks, totalChunks }) {
        console.log(completedChunks, totalChunks);
    }
});
const decoded = await decodeGeometry(bytes, (payload) => decodeDracoChunk(decoderModule, payload));
```

## Entrypoints

- `meshquilt`: geometry types, lazy splitter, buffer merger, shared quantization, MQLT container and codec callback pipeline. No runtime dependencies.
- `meshquilt/draco`: injected Draco adapters and a browser Worker pool.
- `meshquilt/worker`: generated classic Worker asset, deployed by your application.

There is no published Three.js adapter. Materials, scene transforms, rendering objects and model loading belong to your application. The repository provides tested Three.js integration examples.

## Input and output

GeometryInput accepts tightly packed Float32Array position, optional normal/UV arrays, and Uint16Array or Uint32Array indices. Omit indices for triangle soup. Compute smooth normals on the complete mesh before splitting. Decoded chunks and codec inputs use normalized Uint32Array indices.

The single-chunk Uint32 path aliases source geometry. Small Uint16/nonindexed inputs normalize their index while sharing attributes; multi-chunk splits copy attributes. Do not mutate or detach input arrays while encoding.

Defaults are position14, normal8 and UV10 bits. Set an attribute's bits to0 to skip quantization. Every chunk shares the same float32-normalized volume. Explicit volumes need finite origins, positive finite float32 ranges and must cover input values.

## Merge decoded chunks

```ts
import { mergeGeometry } from "meshquilt";

const geometry = mergeGeometry(decoded.chunks);
```

Merging is optional and returns independent buffers with Uint32 indices. It preserves coincident seam vertices, normals and UVs without welding or requantization. Each optional attribute must be present on every input or absent from every input; mixed presence is rejected. Creating a Mesh and choosing a material remain application responsibilities. See [Geometry API](docs/geometry.md#merge-geometry).

## Worker pool

```ts
import { encodeGeometry } from "meshquilt";
import { createDracoWorkerPool } from "meshquilt/draco";

const pool = await createDracoWorkerPool({
    workerUrl,
    encoderScriptUrl: "/draco/draco_encoder.js",
    size: 2,
    timeoutMs: 30_000,
    signal
});
try {
    const bytes = await encodeGeometry(geometry, {
        concurrency: 2,
        encodeChunk: pool.encodeChunk,
        signal
    });
} finally {
    pool.dispose();
}
```

Serve meshquilt/worker as a classic Worker and provide its served URL. Relative encoder URLs resolve from the Worker location. WASM defaults to the encoder script directory; wasmUrl overrides it. Draco binaries are supplied separately and licensed Apache-2.0. Keep the pool at2–4 Workers. Direct modules are not re-entrant; use concurrency1 without a pool.

## Failure, progress and memory

onProgress reports encode/decode stage, completedChunks and totalChunks, initially at0 and after every successful chunk. Progress is independent of AbortSignal cancellation; observer errors reject the operation. mapPool stops scheduling on failure and waits for active calls. A pool abort/dispose/runtime failure/timeout terminates all jobs. Default startup/per-job timeout is30 seconds, excluding queue time.

Encoding creates chunks lazily, but source attributes, compressed results and final output still require model-sized memory. Splitting/validation run on the calling thread; this is not a streaming output API. Decoding copies compressed payloads by default. With copyChunks:false, keep the input alive and unchanged until decoding finishes.

## Documentation

- [Quick start](docs/quick-start.md)
- [Geometry API](docs/geometry.md)
- [Draco adapter](docs/draco.md)
- [Browser Workers](docs/workers.md)
- [Three.js example](docs/three.md)
- [Quantization and seams](docs/quantization.md)
- [MQLT container](docs/container-format.md)
- [Runtime and memory](docs/runtime-and-memory.md)
- [Migration from scoped packages](docs/migration.md)
- [Local release preparation](docs/releasing.md)
- [Performance and benchmarks](docs/performance.md)

If the package has not yet been published to your registry, use the local workspace.

## Website and development

Node.js22.12+,24+ or26+ and pnpm10.33.0.

```bash
pnpm install
pnpm site
pnpm check
pnpm test
pnpm test:packages
pnpm test:release
pnpm --filter meshquilt exec playwright install chromium
pnpm test:workers
pnpm site:test
pnpm build
```

The independent React website includes real geometry splitting, searchable docs, English/Chinese and light/dark themes. See [website setup](apps/site/README.md) for GitHub Pages. Choose GitHub Actions as the Pages source.

TypeScript7 runs builds/typechecks; TypeScript6 supplies the API needed by the current ESLint parser. Three.js minimum-version tests belong only to the private example. See [CONTRIBUTING.md](CONTRIBUTING.md).

Use `pnpm bench` for the TypeScript Vitest benchmark suite and `pnpm bench:browser` for Playwright main-thread/Worker measurements. Both share fixtures; no standalone benchmark runner is maintained. For million-plus triangle UI workloads, see encodeDracoInWorker and input-ownership guidance in the performance doc.

## License

MIT. See [LICENSE](LICENSE). Draco has its own Apache-2.0 license.
