# Quick start

## Install

```bash
npm install meshquilt
```

If the package is not yet available on your registry, clone the repository and run `pnpm install` and `pnpm build:lib`. Development requires Node.js 22.12+, 24+ or 26+ and pnpm 10.33.0.

## Prepare arrays

```ts
import type { GeometryInput } from "meshquilt";

const geometry: GeometryInput = {
    position: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    index: new Uint16Array([0, 1, 2])
};
```

Indices can be Uint16Array or Uint32Array. For nonindexed triangle soup, omit index; the position array must contain complete triangles. Optional normal and UV arrays must match the vertex count. File loading is outside MeshQuilt.

## Load Draco separately

Supply a Draco build exposing DracoEncoderModule and DracoDecoderModule, and initialize both before encoding:

```ts
const encoderModule = await DracoEncoderModule({});
const decoderModule = await DracoDecoderModule({});
```

Serve matching WASM files where the build expects them. Configure locateFile if needed. MeshQuilt does not distribute Draco binaries.

## Encode and decode

```ts
import { encodeGeometry, decodeGeometry } from "meshquilt";
import { createDracoChunkEncoder, decodeDracoChunk } from "meshquilt/draco";

const bytes = await encodeGeometry(geometry, {
    maxTriangles: 100_000,
    encodeChunk: createDracoChunkEncoder(encoderModule)
});

const { chunks } = await decodeGeometry(bytes, (payload) => decodeDracoChunk(decoderModule, payload));
```

Each output chunk contains position, a Uint32Array index, and optional normal/UV arrays. Use the chunks directly in your renderer or processing pipeline. The [Three.js example](three.md) shows how to convert them to rendering objects.

## Worker encoding

```ts
import { encodeGeometry } from "meshquilt";
import { createDracoWorkerPool } from "meshquilt/draco";

const pool = await createDracoWorkerPool({
    workerUrl,
    encoderScriptUrl: "/draco/draco_encoder.js",
    size: 2
});
try {
    const bytes = await encodeGeometry(geometry, {
        concurrency: 2,
        encodeChunk: pool.encodeChunk,
        onProgress({ completedChunks, totalChunks }) {
            console.log(completedChunks, totalChunks);
        }
    });
} finally {
    pool.dispose();
}
```

Deploy `meshquilt/worker` as a classic Worker asset, and use its served URL as workerUrl. The worker uses importScripts; do not instantiate it as a module worker. Relative Draco asset URLs resolve from the Worker location. Matching WASM defaults to the encoder script directory; wasmUrl overrides that location. Use 2–4 workers to limit the number of simultaneous WASM heaps.

One Draco module is not re-entrant. Use concurrency: 1 with createDracoChunkEncoder; use createDracoWorkerPool for parallel work.

## Quantization and cancellation

Defaults are 14 position bits, 8 normal bits and 10 UV bits. A bit count of 0 disables quantization for the attribute. See [quantization and seams](quantization.md).

Pass the same AbortSignal to encodeGeometry and the Worker pool to stop scheduling and terminate Worker execution. See [runtime and memory](runtime-and-memory.md) for ownership and failure semantics.
