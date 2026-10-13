# Examples

The browser demo is `apps/demo`. From the repository root:

```bash
pnpm demo
```

It builds a terrain `THREE.Mesh`, splits it, and colors each chunk. The stats compare a shared quantization volume with a volume computed per chunk.

A minimal encode and decode looks like this:

```ts
import { decodeMesh, encodeMesh } from "./three/integration";
import { createDracoChunkEncoder, decodeDracoChunk } from "meshquilt/draco";

const encoderModule = await DracoEncoderModule({});
const buffer = await encodeMesh(mesh, {
    maxTriangles: 100_000,
    encodeChunk: createDracoChunkEncoder(encoderModule)
});

const group = await decodeMesh(buffer, (bytes) => decodeDracoChunk(decoderModule, bytes), mesh);
```

`createDracoChunkEncoder` is not safe to call concurrently on one module. Use `createDracoWorkerPool` when more than one chunk should encode at the same time. Keep the pool size at 2 to 4.
