# 更新日志

## Unreleased

## 0.2.0

- 只发布 `meshquilt`、`meshquilt/draco` 和 `meshquilt/worker`。不再发布 Three.js 适配器。MQLT v1 不变。
- 接受 Uint16、Uint32 和无索引几何。编码和解码会报告进度。
- 新增 `mergeGeometry` 和 `encodeDracoInWorker`。
- Worker 在释放、超时或失败时取消进行中的任务。
- 网站可导入 STL、OBJ、GLB 和 MQLT，并对比解码结果。

## 0.1.0

- 索引三角网格分块与MQLT容器。
- 共享位置/UV量化范围。
- 可注入Draco模块与独立Worker实例。
