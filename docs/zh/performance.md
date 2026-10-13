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

## 几何预处理与校验

编码入口通过内部 prepareGeometry 完成一次预处理：先检查结构和参数，再扫描一次索引与法线，位置/UV 的有限值检查合并到范围计算中。提供 positionVolume/uvVolume 时，只校验给定范围与输入有限值，不再计算随后被覆盖的 min/max。每个分块仍共用 float32 标准化的量化信息，默认14/8/10位；独立校验、分块和容器元数据校验继续保留，不按可变数组引用缓存校验结果。

使用 `pnpm bench -t 'validation cost'` 运行现有 Vitest/TypeScript 基准，每阶段至少20次预热与20次采样，结果位于 .tmp/performance/validation。比较对象是当前公共范围计算＋校验两个独立步骤，与内部统一预处理；独立扫描组不是历史编译版本。

2026-10-13，本机 Node26.5、约100万三角形、带法线/UV，中位数：

| 场景                  | 独立扫描 | 统一预处理 | 降低 |
| --------------------- | -------: | ---------: | ---: |
| 索引模型 / 自动范围   | 11.58 ms |    7.51 ms |  35% |
| 无索引模型 / 自动范围 | 48.72 ms |   34.14 ms |  30% |
| 索引模型 / 给定范围   |  9.93 ms |    5.41 ms |  45% |
| 无索引模型 / 给定范围 | 48.57 ms |   22.28 ms |  54% |

这是预处理收益，不代表完整 Draco 编码同比提速。该组测量将进程及子进程固定在 CPU0，减少 i9-14900KF 混合核心调度差异；未固定时波动明显，甚至出现误导性的索引模型退化。可在临时 PowerShell 进程中复现：

```powershell
pwsh -NoProfile -Command '(Get-Process -Id $PID).ProcessorAffinity = [IntPtr]1; pnpm bench -t "validation cost"'
```

减少扫描不会让同步预处理主动让出主线程；优先界面响应仍推荐整体 Worker。

## 编码与 Worker 测量

2026-10-13，i9-14900KF、32逻辑线程、约64GiB内存、Windows、Node26.5、Draco1.5.7、无界面 Chromium。基线为 cfec9e7，优化版本为 d7417ff，早于上面的统一预处理改动。数据为固定生成的带法线/UV高度场，量化14/8/10位，每块10万面。

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
