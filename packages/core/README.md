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

See [quantization](../../docs/quantization.md) and the [container format](../../docs/container-format.md).
