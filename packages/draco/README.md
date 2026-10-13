# @meshquilt/draco

Draco encoder and decoder adapters for MeshQuilt chunks.

The package does not bundle `draco_encoder.js`. Load a Draco build that exposes `DracoEncoderModule` and `DracoDecoderModule`, then pass the created module in.

Draco is licensed under Apache-2.0. This adapter is MIT.

## Encode one chunk

```ts
import { createDracoChunkEncoder } from "@meshquilt/draco";

const encodeChunk = createDracoChunkEncoder(encoderModule);
```

One module is not re-entrant. Do not run that function on overlapping calls.

Positions and UVs use `SetAttributeExplicitQuantization` with the shared volume from `@meshquilt/core`. Normals use `SetAttributeQuantization` and Draco's octahedral grid.

## Workers

```ts
import { createDracoWorkerPool } from "@meshquilt/draco";

const pool = await createDracoWorkerPool({
    workerUrl,
    encoderScriptUrl: "/draco_encoder.js",
    size: 2
});
```

`workerUrl` should point at `@meshquilt/draco/worker`, which is `worker/encode.worker.js`. Each worker loads the encoder script with `importScripts` and keeps its own module. A pool size of 2 to 4 matches the memory cost of one geometry chunk plus one wasm heap per worker.

## Decode

```ts
import { decodeDracoChunk } from "@meshquilt/draco";

const chunk = decodeDracoChunk(decoderModule, bytes);
```
