# 性能与基准

百万面以上模型优先内存和界面响应时，推荐 meshquilt/draco 的 encodeDracoInWorker。它把校验、共享范围计算、分块、编码和打包放入同一个专用 Worker。

```ts
import { encodeDracoInWorker } from "meshquilt/draco";
const bytes = await encodeDracoInWorker(geometry, {
    workerUrl,
    encoderScriptUrl: "/draco/draco_encoder.js",
    maxTriangles: 100_000,
    transferInput: true,
    timeoutMs: 120_000,
    signal
});
```

## 所有权与取舍

默认 transferInput: false 会保留输入，但结构化克隆可能复制完整底层缓冲区，带来短暂停顿与额外模型内存。SharedArrayBuffer 保持共享，运行期间不能修改。

显式 transferInput: true 在初始化成功后转移输入；所有共享这些缓冲区的视图都会被分离。后续失败或取消也不归还原缓冲区，不要转移渲染器仍要使用的数据。每次调用创建单个 Worker，结束后释放；默认30秒超时覆盖整个调用，可调整。源数据、压缩载荷与最终输出仍占用内存，本 API 不提供流式输出。

## 统一工具链

```bash
pnpm bench
pnpm bench -t 1m-soup
pnpm bench:browser
pnpm test:workers
```

Node 基准使用现有 Vitest 配置和 TypeScript bench 文件，Vitest 管理预热、采样、比较表和 JSON 结果。浏览器基准进入现有 Playwright 项目，并与 Worker 集成验证共享 TypeScript 夹具；没有独立 benchmark mjs runner 或第二套 HTTP 服务。

Vitest 结果位于 .tmp/performance/vitest/current。将 MESHQUILT_BENCH_DIST 指向旧版本编译目录后运行 pnpm bench，会生成 baseline；清除变量再运行，自动用 bench.from 比较。每阶段至少5次采样，浏览器每场景3次。正常 CI 不设置依赖硬件的耗时阈值。

## 本机量化结果

2026-10-13，i9-14900KF、32逻辑线程、约64GiB内存、Windows、Node26.5、Draco1.5.7、无界面 Chromium。基线为 cfec9e7，数据为固定生成的带法线/UV高度场，量化14/8/10位，每块10万面。

| 场景          | Vitest编码中位数：优化前 / 后 | 降低 |
| ------------- | ----------------------------- | ---- |
| 10万索引面    | 44.7 / 37.8 ms                | 15%  |
| 50万索引面    | 448.1 / 327.7 ms              | 27%  |
| 100万索引面   | 819.1 / 665.4 ms              | 19%  |
| 100万无索引面 | 1926.4 / 998.3 ms             | 48%  |
| 200万索引面   | 1662.9 / 1401.2 ms            | 16%  |

| 浏览器100万面场景           | 总耗时 | 主线程计时延迟 | 编码器WASM容量 |
| --------------------------- | ------ | -------------- | -------------- |
| 索引 / 4个分块Worker        | 128 ms | 17.0 ms        | 77 MiB         |
| 索引 / 整体Worker转移输入   | 407 ms | 1.6 ms         | 19 MiB         |
| 无索引 / 4个分块Worker      | 211 ms | 51.8 ms        | 133 MiB        |
| 无索引 / 整体Worker转移输入 | 574 ms | 1.3 ms         | 33 MiB         |

200万索引面整体Worker转移模式为820ms总耗时、1.6ms主线程计时延迟、19MiB编码器WASM；本轮整体Worker场景均未观察到长任务。4个分块Worker总耗时237ms，但WASM约77MiB，计时延迟约40ms。

整体Worker每次含启动成本，池模式已预热并单独报告启动。WASM容量不等于浏览器总内存，5ms计时器反映事件循环延迟，不等于渲染帧率。生成模型也不代表所有真实模型；不同运行时的绝对耗时不能混用。

主要优化为无索引连续复制、有界稠密索引映射及稀疏回退、减少属性视图分配和重复校验、Draco批量读取。量化精度与 positionRange 保持不变，固定模型输出字节一致。完整方法与限制见[英文性能说明](../performance.md)。
