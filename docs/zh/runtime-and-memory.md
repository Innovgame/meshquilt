# 运行时、内存与取消

MeshQuilt 限制每次交给编码器的几何大小；完整输出 API 的总内存仍与模型大小相关。

## 编码工作集

核心先测量完整几何的共享量化范围，再按并发槽位惰性生成块。除分块器暂存外，同时编码的未压缩块不超过 concurrency。无索引输入不会分配整模型索引。

源数组、Worker WASM 堆、压缩结果和最终 MQLT 容器仍需内存。打包期间压缩载荷与完整输出同时存在。校验与分块在调用线程运行，当前没有流式输出。Three.js 属性复制只属于示例集成，不属于核心编码流程。

## 所有权

小型 Uint32 输入直接共享源几何；小型 Uint16/无索引输入规范化索引并共享属性；多块路径复制属性。编码期间不要修改或转移输入数组。

解码默认复制压缩载荷，copyChunks: false 则保留源容器视图，解码完成前需保持原容器未修改、未转移。原始块没有材质所有权；Three 示例共享源材质，移除结果时仅释放生成几何。

## 失败、进度与取消

onProgress 初始报告0，并在每个成功块后报告 stage、completedChunks、totalChunks。返回值不用于取消。抛错会拒绝操作，并等待在途任务结束。

mapPool 在失败/取消后停止领取新任务，等待已启动调用结束。任意用户回调若不结束，核心无法强制中断。将相同 signal 传给流水线和 Worker 池，可同时停止调度和终止 WASM。dispose 也会关闭池。默认初始化/任务超时30秒，可用 timeoutMs 调整。

## 工具链与验证

Node.js22.12+、24+或26+，pnpm10.33.0。TypeScript7编译，TypeScript6为当前 ESLint 提供兼容API。three-min0.160夹具仅属于私有示例。

```bash
pnpm check
pnpm test
pnpm test:packages
pnpm test:workers
pnpm site:test
pnpm build
```

发布包检查不安装 Three.js，验证根/Draco/Worker入口与声明。浏览器 Worker 检查覆盖真实 WASM、并发和所有权；这些是正确性检查，不是峰值内存或性能基准。
