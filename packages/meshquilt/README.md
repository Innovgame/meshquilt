# MeshQuilt

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

The synchronous merger accepts a readonly list of GeometryInput and returns GeometryBuffers with Uint32 indices and independently owned attribute buffers. Input order and duplicate seam vertices are preserved; it does not weld, recompute normals, requantize, or create a Mesh. Normals/UVs must each be present on every input or absent from every input; mixed presence and invalid geometry throw MeshQuiltError. Merging requires a complete additional geometry allocation and remains optional after decodeGeometry.

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

For million-plus triangle browser workloads, `encodeDracoInWorker` from `meshquilt/draco` moves the complete encode pipeline off the main thread. It uses one dedicated Worker per operation. Default cloning preserves input ownership; explicit transferInput: true detaches input ArrayBuffers after startup and reduces copy memory. Those inputs cannot be reused or recovered after cancellation. Set timeoutMs for the whole operation, not per chunk. The chunk pool remains useful for multicore throughput.

onProgress reports encode/decode stage, completedChunks and totalChunks, initially at0 and after every successful chunk. Progress is independent of AbortSignal cancellation; observer errors reject the operation. mapPool stops scheduling on failure and waits for active calls. A pool abort/dispose/runtime failure/timeout terminates all jobs. Default startup/per-job timeout is30 seconds, excluding queue time.

Encoding creates chunks lazily, but source attributes, compressed results and final output still require model-sized memory. Splitting/validation run on the calling thread; this is not a streaming output API. Decoding copies compressed payloads by default. With copyChunks:false, keep the input alive and unchanged until decoding finishes.

## License

MIT. See LICENSE. Draco has its own Apache-2.0 license.
