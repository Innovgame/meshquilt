# 单包迁移

现在只发布 meshquilt。旧 core/draco 代码归并到内部模块，MQLT v1与默认量化参数保持不变。

## 导入路径

| 原导入                  | 新导入                                      |
| ----------------------- | ------------------------------------------- |
| @meshquilt/core         | meshquilt                                   |
| @meshquilt/draco        | meshquilt/draco                             |
| @meshquilt/draco/worker | meshquilt/worker                            |
| @meshquilt/three        | 将 examples/three/integration.ts 复制进应用 |

根包没有 Three.js 依赖或 peer dependency。旧适配器的转换、校验、材质与变换行为保留在私有源码示例中。

## 输入与进度

GeometryInput 支持 Uint16/Uint32或无索引输入，规范化的 GeometryBuffers/ChunkGeometry 仍使用 Uint32索引。材质和场景限制属于 Three 示例，原始数组 API 不认识材质。

encodeGeometry 与 decodeGeometry 新增类型化 onProgress；取消仍使用 signal。
