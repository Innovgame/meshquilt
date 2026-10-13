# meshquilt

面向原始数组的几何入口，负责分块、合并、共享量化与 MQLT 容器，不加载 Draco、Three.js 或 Worker。

## 输入与规范化

GeometryInput 接收紧密排列的 Float32Array 位置，可选法线/UV，以及 Uint16/Uint32 索引。无索引输入由连续三个顶点构成三角形。大输入不会先分配整模型索引，索引在每个块内生成。

ChunkGeometry 与 GeometryBuffers 表示规范化结果，始终包含 Uint32 索引。小型 Uint32 输入直接共享源几何；小型 Uint16/无索引输入仅规范化索引并共享属性；多块路径复制属性。编码期间不要修改或转移源数组。

## 编码

```ts
import { encodeGeometry } from "meshquilt";
const bytes = await encodeGeometry(geometry, {
    maxTriangles: 100_000,
    concurrency: 2,
    encodeChunk: myEncoder,
    onProgress({ stage, completedChunks, totalChunks }) {
        console.log(stage, completedChunks, totalChunks);
    },
    signal
});
```

myEncoder 由应用或 Draco 子入口提供。每个块接收相同的 float32 量化配置。位置/UV 范围取自完整输入，也可传入显式范围。数值须有限，位数为0–30的整数，范围须为正有限 float32。

## 解码

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

解码返回独立几何块，不创建材质/绘制对象，不重新焊接。默认复制压缩载荷，copyChunks: false 返回源容器视图，解码完成前不能修改或转移源容器。

## 合并几何

```ts
import { mergeGeometry } from "meshquilt";

const geometry = mergeGeometry(decoded.chunks);
```

`mergeGeometry(inputs: readonly GeometryInput[]): GeometryBuffers` 校验每份输入，按输入顺序拼接属性，并按前面输入的顶点数调整三角形索引。支持 Uint16/Uint32 索引和无索引三角网格，输出始终使用 Uint32 索引。空列表、无效几何或超出 Uint32 索引范围的总顶点数会被拒绝。

法线与 UV 各自必须在所有输入中都存在或都不存在；混合缺失会抛出 `MeshQuiltError`，由应用明确移除不需要的属性或补齐数据后再合并。属性值原样复制，不焊接、不重算法线、不再次量化；同位置但法线或 UV 不同的顶点保持独立，不恢复原始顶点编号或共享拓扑。

所有输出数组使用新缓冲区，包括只有一份输入时，源数组不会被修改。合并是同步操作，除输入块外还需要完整输出的内存；大模型浏览器应用可在自己的 Worker 中调用。函数不创建绘制对象，也不包含官网预览容量限制。`decodeGeometry` 继续返回分块，合并由调用者主动选择。

## 调度、进度与所有权

splitGeometry 返回数组，iterateGeometry 惰性产出块。编码仅在并发槽可用时生成下一块。mapPool 接收同步可迭代对象，保持结果顺序；失败/取消后停止领取新任务，等待已启动的任务结束。

onProgress 初始报告0，再在每个块成功后报告递增完成数，stage 为 encode/decode。回调抛错会拒绝操作，并等待在途调用结束；取消使用独立的 AbortSignal。

源数据、Worker 堆、压缩结果与最终输出仍占用与模型大小相关的内存。当前没有流式输出。见[运行时与内存](runtime-and-memory.md)、[量化](quantization.md)和[容器格式](container-format.md)。

## 兼容辅助 API

共享范围计算使用 computeSharedQuantization。旧名称 quantizationOf 保留为已弃用别名。quantizeComponent 同样标记弃用，它只是 float64 概念辅助函数，不是 Draco 的 float32 量化器。现有调用行为保持兼容；判断编码坐标和接缝时使用实际编解码器输出。
