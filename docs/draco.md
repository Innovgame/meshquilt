# meshquilt/draco

Draco encoder and decoder adapters for MeshQuilt chunks.

The package does not bundle `draco_encoder.js`. Load a Draco build that exposes `DracoEncoderModule` and `DracoDecoderModule`, then pass the created module in.

Draco is licensed under Apache-2.0. This adapter is MIT.

## Encode one chunk

```ts
import { createDracoChunkEncoder } from "meshquilt/draco";

const encodeChunk = createDracoChunkEncoder(encoderModule);
```

One module is not re-entrant. Do not run that function on overlapping calls.

Positions and UVs use `SetAttributeExplicitQuantization` with the shared volume from `meshquilt`. Normals use `SetAttributeQuantization` and Draco's octahedral grid.

## Workers

```ts
import { createDracoWorkerPool } from "meshquilt/draco";

const pool = await createDracoWorkerPool({
    workerUrl,
    encoderScriptUrl: "/draco_encoder.js",
    size: 2
});
```

`workerUrl` should point at `meshquilt/worker`, which is `worker/encode.worker.js`. Each worker loads the encoder script with `importScripts` and keeps its own module. A pool size of 2 to 4 matches the memory cost of one geometry chunk plus one wasm heap per worker.

The classic Worker is generated from typed source during build and uses the same encoder implementation as `createDracoChunkEncoder`. Deploy the exported Worker asset and your Draco build yourself. URLs are resolved relative to the Worker; root-relative or absolute URLs are recommended when assets live in different directories. Matching WASM files default to the encoder script directory. Use `wasmUrl` to override that location.

```ts
const controller = new AbortController();
const pool = await createDracoWorkerPool({
    workerUrl,
    encoderScriptUrl: "/draco/draco_encoder.js",
    wasmUrl: "/draco/draco_encoder.wasm",
    size: 2,
    timeoutMs: 30_000,
    settings: { encodeSpeed: 5, decodeSpeed: 5 },
    signal: controller.signal
});
try {
    const buffer = await encodeGeometry(geometry, {
        concurrency: 2,
        encodeChunk: pool.encodeChunk,
        signal: controller.signal
    });
} finally {
    pool.dispose();
}
```

Import `encodeGeometry` from `meshquilt` for this example. The default timeout is 30 seconds for startup and each dispatched job; time waiting in the queue does not count. Increase it for expensive chunks. Aborting, disposing, a timeout or a runtime Worker failure terminates the whole pool and rejects all running, queued and future calls. Startup failures clean up partially created Workers. A codec-reported error rejects that job and keeps the pool available for subsequent calls. `dispose()` is idempotent.

The pool copies each chunk only when a Worker becomes available, then transfers its copies. It never detaches your input buffers. Queued calls retain their original chunks until dispatched: use `encodeGeometry` with matching concurrency to avoid queuing the whole model yourself.

## Decode

For large UI workloads, `encodeDracoInWorker` provides an optional whole-pipeline Worker encoder. It preserves shared position quantization and supports input transfer, cancellation and typed progress. See [performance and ownership](performance.md) before enabling transferInput.

```ts
import { decodeDracoChunk } from "meshquilt/draco";

const chunk = decodeDracoChunk(decoderModule, bytes);
```
