# Three.js 集成示例

本例位于 examples/three/integration.ts，属于私有源码示例，不是 npm 包，也不是编解码的前置依赖。将此文件复制到应用，应用自行安装 meshquilt 与 three。

## 使用

```ts
import { encodeMesh, decodeMesh } from "./integration";
const bytes = await encodeMesh(mesh, { encodeChunk });
const group = await decodeMesh(bytes, decodeChunk, mesh);
mesh.parent?.add(group);
```

meshToGeometry 读取属性，chunkToGeometry创建 BufferGeometry，chunksToGroup创建共享源材质的Group。原始数组流水线直接使用 meshquilt 的 encodeGeometry/decodeGeometry即可。

## 变换与边界

复制局部位置、旋转和缩放；matrixAutoUpdate为false时保留自定义矩阵。应将结果添加到源网格的同一父级。

编码前拒绝多材质、骨骼、实例化、morph和部分drawRange输入；先拆分或烘焙为静态几何。支持交错、规范化属性，最低测试Three.js0.160。

## 资源生命周期

移除结果时释放生成的各块几何；材质与源网格共享，生命周期由应用管理。此例复制属性，不转移Three.js源数组。几何块保持独立，不重新焊接。

## 校验与错误

meshToGeometry 会完整校验返回数组。encodeMesh 只转换一次，由核心编码入口在准备共享量化时校验几何，避免额外扫描。数值几何错误通过 Promise 拒绝；不支持的网格类型、材质和属性在转换阶段同步抛出。
