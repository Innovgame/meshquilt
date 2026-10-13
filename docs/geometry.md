# meshquilt

The array-first entrypoint for geometry splitting/merging, shared quantization and the MQLT container. Importing it does not load Draco, Three.js, or start Workers.

## Install

```bash
npm install meshquilt
```

Use the local pnpm workspace if the package has not yet been published to your registry.

## Input geometry

```ts
import type { GeometryInput } from "meshquilt";

const geometry: GeometryInput = {
    position: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    index: new Uint16Array([0, 1, 2])
};
```

Positions are tightly packed xyz. Normals are optional xyz and UVs are optional uv, both per vertex. Attributes must contain finite values. Indices can be Uint16Array or Uint32Array. Omitting the index means each consecutive group of three vertices is a triangle. No whole-model index is generated for a large nonindexed input; indices are produced per chunk.

Input geometry is separate from normalized `ChunkGeometry`. Every chunk given to a codec or returned by the splitter has a Uint32Array index. A small already normalized input is returned by reference; small Uint16 or nonindexed inputs normalize only their index and share attribute arrays. Multi-chunk splits copy their attributes. Do not modify source arrays during encoding.

## Encode

```ts
import { encodeGeometry } from "meshquilt";

const bytes = await encodeGeometry(geometry, {
    maxTriangles: 100_000,
    concurrency: 2,
    encodeChunk(chunk, quantization) {
        return myEncoder(chunk, quantization);
    },
    onProgress({ stage, completedChunks, totalChunks }) {
        console.log(stage, completedChunks, totalChunks);
    },
    signal
});
```

`encodeChunk` is supplied by your application or `meshquilt/draco`. The codec gets the same float32-normalized quantization settings for every chunk. Positions and UV volumes cover the whole source mesh unless you pass explicit volumes.

`onProgress` receives a `GeometryProgress` event initially at zero, then after each successfully completed chunk. Stages are `encode` and `decode`. Completion counts are monotonic even when chunks finish out of order. A throwing progress observer rejects the operation; already running jobs are awaited. Cancellation uses AbortSignal, independently of progress return values.

## Decode

```ts
import { decodeGeometry } from "meshquilt";

const decoded = await decodeGeometry(bytes, myDecoder, 2, {
    copyChunks: false,
    onProgress(progress) {
        console.log(progress.completedChunks, progress.totalChunks);
    },
    signal
});
```

Results are independent geometry chunks. No rendering objects or materials are created, and chunks are not welded into one allocation. By default compressed payloads are copied; opt-in zero-copy decoding returns views into the input container. Keep that container alive, unchanged and attached until all decoders finish.

## Merge geometry

```ts
import { mergeGeometry } from "meshquilt";

const geometry = mergeGeometry(decoded.chunks);
```

`mergeGeometry(inputs: readonly GeometryInput[]): GeometryBuffers` validates each input, concatenates attributes in input order, and offsets triangle indices by the preceding vertex counts. It accepts Uint16/Uint32 indices and triangle soup; the result always has a Uint32 index. Empty lists, invalid geometry, and a total vertex count outside the Uint32 index range are rejected.

Normals and UVs must each be present on every input or absent from every input. Mixed presence throws `MeshQuiltError`; applications must explicitly remove an unwanted attribute or provide the missing data before merging. Values are copied exactly without welding, normal recomputation, or quantization. Coincident vertices with different normals/UVs stay separate, and original topology or vertex identifiers are not reconstructed.

Every output array owns a new buffer, including single-input merges. The inputs remain unchanged. Merging is synchronous and requires memory for the complete output in addition to the input chunks; large browser applications can call it in their own Worker. It creates no rendering objects and imposes no website preview limit. `decodeGeometry` continues to return chunks; merging is an explicit optional step.

## Lazy splitting and scheduling

`splitGeometry` returns an array; `iterateGeometry` yields one chunk at a time. Encoding consumes the lazy iterator with at most `concurrency` codec calls in flight. `mapPool` accepts any synchronous iterable and preserves input order. On failure or cancellation it stops requesting new items and waits for already started jobs before rejecting.

The source mesh, Worker WASM heaps, compressed results and final MQLT buffer still occupy model-sized memory. Validation and splitting run on the calling thread; this API does not provide streaming file output. See [runtime and memory](runtime-and-memory.md).

See [quantization](quantization.md) and the [container format](container-format.md).

## Compatibility helpers

Use `computeSharedQuantization` to calculate shared volumes. The older `quantizationOf` name remains available as a deprecated alias. `quantizeComponent` is also deprecated: it is an illustrative float64 helper, not Draco's float32 quantizer. Existing calls keep their behavior; use real codec output when checking encoded coordinates and seams.
