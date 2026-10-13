# meshquilt/draco

直接调用 Draco 模块的编码/解码适配器，不依赖 Three.js。应用自行加载编码器/解码器，Draco 二进制不随包分发。

## 编码

```ts
import { createDracoChunkEncoder } from "meshquilt/draco";
const encodeChunk = createDracoChunkEncoder(encoderModule, { encodeSpeed: 5, decodeSpeed: 5 });
```

位置/UV 使用共享范围进行显式量化，法线使用 Draco 的八面体网格。单个模块不可重入，不要并发调用同一模块。

## 解码

```ts
import { decodeDracoChunk } from "meshquilt/draco";
const chunk = decodeDracoChunk(decoderModule, payload);
```

返回规范化的原始几何块，不创建场景对象。Draco 使用 Apache-2.0，MeshQuilt 适配器使用 MIT。

## Worker 池

createDracoWorkerPool 支持 workerUrl、encoderScriptUrl、wasmUrl、size、settings、timeoutMs 和 signal。每个 Worker 持有独立模块与 WASM 堆，建议2–4个。编码与 Worker 共用类型化源码，避免行为分叉。

详见[浏览器 Worker](workers.md)。
