# 浏览器 Worker

从 meshquilt/draco 导入 createDracoWorkerPool。meshquilt/worker 是生成的经典 Worker 文件，由应用部署。

## 资源路径

提供 workerUrl 与 encoderScriptUrl。相对 Draco 路径从 Worker 位置解析，建议使用根相对/绝对路径。WASM 默认在编码脚本目录，可用 wasmUrl 覆盖。Draco 脚本和 WASM 不随本库打包。

## 调度与所有权

超大模型可用 encodeDracoInWorker，把校验、量化、分块和编码都移到单个专用 Worker。显式 transferInput: true 转移输入所有权，避免复制完整模型；适合优先主线程响应与较少 WASM 堆的场景。详见[性能与基准](performance.md)。

建议2–4个 Worker，并让 encodeGeometry 的 concurrency 与池大小匹配。核心按需生成块，池仅在 Worker 空闲时复制并转移输入的副本，不分离调用方数组。

## 失败与取消

默认初始化与单个已分派任务超时30秒，排队时间不计入，可用 timeoutMs 调整。超时、Worker 运行时错误、取消或 dispose 会关闭整个池，拒绝运行中、排队与未来调用。初始化失败清理已创建 Worker；编码器报告的单任务错误不会关闭池。

向流水线和池传入同一个 signal 可中止 Worker。dispose 可重复调用，建议放在 finally 中。直接 Draco 模块与 Worker 池都是可选机制，根入口也可使用自己的编码器。
