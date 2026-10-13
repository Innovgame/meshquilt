# 快速上手

## 安装

```bash
npm install meshquilt
```

若尚未发布到你的注册源，克隆仓库后运行 pnpm install 与 pnpm build:lib。开发需要 Node.js22.12+、24+或26+，pnpm10.33.0。

## 准备数组

```ts
import type { GeometryInput } from "meshquilt";
const geometry: GeometryInput = {
    position: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    index: new Uint16Array([0, 1, 2])
};
```

索引可以是 Uint16Array 或 Uint32Array；省略索引时，连续三个顶点表示一个三角形。可选 normal 与 uv 按顶点排列。文件加载属于应用层。

## 单独加载 Draco

自行加载暴露 DracoEncoderModule 与 DracoDecoderModule 的构建并初始化：

```ts
const encoderModule = await DracoEncoderModule({});
const decoderModule = await DracoDecoderModule({});
```

将匹配的 WASM 文件部署到该构建需要的位置，必要时配置 locateFile。本库不捆绑 Draco 二进制。

## 编码与解码

```ts
import { encodeGeometry, decodeGeometry } from "meshquilt";
import { createDracoChunkEncoder, decodeDracoChunk } from "meshquilt/draco";
const bytes = await encodeGeometry(geometry, {
    maxTriangles: 100_000,
    encodeChunk: createDracoChunkEncoder(encoderModule)
});
const { chunks } = await decodeGeometry(bytes, (payload) => decodeDracoChunk(decoderModule, payload));
```

每个输出块包含位置、Uint32 索引与可选法线/UV，可交给任意渲染器或处理流水线。[Three.js 示例](three.md)演示场景对象转换。

## Worker 并行编码

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

部署 meshquilt/worker 文件，以其 URL 设置 workerUrl。Worker 使用 importScripts，需采用经典 Worker。Draco URL 相对 Worker 解析，WASM 默认从编码脚本目录加载，也可用 wasmUrl 指定。建议2–4个 Worker。

单个 Draco 模块不可重入。使用 createDracoChunkEncoder 时设 concurrency: 1，并行任务使用 Worker 池。

## 量化与取消

默认位置14位、法线8位、UV10位，0表示禁用对应属性量化。详见[量化与接缝](quantization.md)。将同一 signal 传给编码流水线和 Worker 池，可停止调度并中止 Worker。详见[运行时与内存](runtime-and-memory.md)。
