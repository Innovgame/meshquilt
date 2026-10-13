# @meshquilt/core

Split an indexed triangle mesh into chunks, measure one quantization volume, and pack encoder bytes into an `MQLT` container.

This package does not import three.js or Draco. Pass your own `encodeChunk` function.

## Install

```bash
npm install @meshquilt/core
```

## Encode

```ts
import { encodeGeometry } from "@meshquilt/core";

const buffer = await encodeGeometry(geometry, {
    maxTriangles: 100_000,
    encodeChunk(chunk, quant) {
        return myEncoder(chunk, quant);
    }
});
```

`geometry.position` is tightly packed `xyz`. `geometry.index` is a triangle list. Optional `normal` and `uv` are per vertex.

`encodeChunk` receives the same `quant` for every chunk. Position and UV origins come from the whole mesh unless you pass `positionVolume` or `uvVolume`.

## Decode

```ts
import { decodeGeometry } from "@meshquilt/core";

const decoded = await decodeGeometry(buffer, (bytes) => myDecoder(bytes));
```

The result is one geometry per chunk. This package does not weld those chunks back together.

## Scheduling and ownership

`encodeGeometry` produces chunks on demand, with at most `concurrency` encoder calls in flight. `iterateGeometry(geometry, maxTriangles)` exposes the lazy splitter; `splitGeometry` still returns an array. A single-chunk split aliases the source arrays. Multi-chunk splits copy attributes. Do not mutate source geometry or shared quantization while encoding, and do not transfer or detach caller-owned buffers in your encoder.

Pass `signal` to stop scheduling new encoding jobs. Already running codec calls are awaited before rejection, including when a job fails. `mapPool` accepts any synchronous iterable and preserves input order. An encoder must settle its own calls; use a Worker pool signal to terminate WASM work immediately.

For opt-in zero-copy compressed input:

```ts
const decoded = await decodeGeometry(buffer, decodeChunk, 2, { copyChunks: false, signal });
```

`decodeContainer(buffer, { copyChunks: false })` returns views into the input. Keep that input alive; do not mutate or transfer it until decoding finishes. The default copies payloads and preserves the previous ownership contract.

Finite positions, normals and UVs are required. Quantization bits are integers from 0 to 30. Position and UV volumes must have exactly 3 and 2 finite components, respectively, with positive finite float32 ranges. Explicit volumes are normalized to the container's float32 precision before encoder callbacks.

Lazy splitting bounds the uncompressed chunk working set. The source mesh, accumulated compressed output and final container still occupy memory proportional to the model. The complete-buffer API is not a streaming file API. See [runtime and memory](../../docs/runtime-and-memory.md).

See [quantization](../../docs/quantization.md) and the [container format](../../docs/container-format.md).
