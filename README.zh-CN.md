# MeshQuilt

[English](README.md) | [简体中文](README.zh-CN.md)

面向原始几何数组的 TypeScript 网格编解码库：将三角网格分块、并行压缩，解码后的块共享量化网格，避免边界裂缝。

版本 0.2.0，见 [CHANGELOG.md](CHANGELOG.md)。单包重构没有改变 MQLT 格式与量化默认值。

## 一个发布包，三个入口

| 导入入口         | 职责                                                              |
| ---------------- | ----------------------------------------------------------------- |
| meshquilt        | 几何类型、惰性分块、数组合并、共享量化、MQLT 容器和编解码流水线。 |
| meshquilt/draco  | 可注入的 Draco 编解码适配器及浏览器 Worker 池。                   |
| meshquilt/worker | 由应用部署的经典 Worker 文件。                                    |

发布包没有运行时依赖或 peer dependency。Three.js 接入代码位于私有 [examples/three](examples/three/README.md) 示例，不再独立发布。根工作区与官网也不发布。

## 快速开始

```bash
npm install meshquilt
```

同一版本也会发布到 GitHub Packages，包名是 `@innovgame/meshquilt`。

若包尚未发布到你的注册源，请使用本地 pnpm 工作区。

```ts
import { encodeGeometry, decodeGeometry } from "meshquilt";
import { createDracoChunkEncoder, decodeDracoChunk } from "meshquilt/draco";

const geometry = {
    position: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    index: new Uint16Array([0, 1, 2])
};
// 自行加载 Draco 构建，先初始化 encoderModule 与 decoderModule。
const bytes = await encodeGeometry(geometry, {
    maxTriangles: 100_000,
    encodeChunk: createDracoChunkEncoder(encoderModule)
});
const { chunks } = await decodeGeometry(bytes, (payload) => decodeDracoChunk(decoderModule, payload));
```

输入支持 Uint16/Uint32 索引；省略索引表示逐三个顶点组成三角形。可选法线和 UV 为逐顶点属性；编码器输入与解码结果统一使用 Uint32 索引。文件加载、材质、变换及绘制由应用负责，平滑法线应在完整网格上预计算。默认位置14位、法线8位、UV10位，0表示禁用该属性量化。

并行编码使用2–4个 Worker，concurrency 与池大小匹配。单个 Draco 模块不可重入。应用自行提供编码脚本与匹配的 WASM。onProgress 提供阶段、已完成块数与总块数；取消使用 AbortSignal。

## 合并解码后的分块

```ts
import { mergeGeometry } from "meshquilt";

const geometry = mergeGeometry(chunks);
```

合并是可选步骤，输出独立缓冲区和 Uint32 索引，保留接缝重复顶点、法线与 UV，不焊接、不再次量化。每种可选属性必须在所有输入中都存在或都不存在，混合缺失会报错。创建 Mesh、材质与预览容量限制由应用负责。见[几何 API](docs/zh/geometry.md#合并几何)。

## 文档与官网

[快速上手](docs/quick-start.md)、[几何 API](docs/geometry.md)、[Draco](docs/draco.md)、[Worker](docs/workers.md)、[Three.js 示例](docs/three.md)、[量化与接缝](docs/quantization.md)、[容器格式](docs/container-format.md)、[运行时与内存](docs/runtime-and-memory.md)、[迁移说明](docs/migration.md)。

```bash
pnpm install
pnpm site
pnpm site:build
pnpm site:preview
```

官网包含真实几何交互、文档搜索、中英文切换和明暗主题。部署说明见 [apps/site/README.md](apps/site/README.md)，Pages Source 选择 GitHub Actions。

## 开发

Node.js22.12+、24+或26+，pnpm10.33.0。

```bash
pnpm check
pnpm test
pnpm test:packages
pnpm test:release
pnpm --filter meshquilt exec playwright install chromium
pnpm test:workers
pnpm site:test
pnpm build
```

TypeScript7用于构建和类型检查，TypeScript6为当前 ESLint 提供兼容 API。最低版本 Three 测试夹具仅属于私有示例。见 [CONTRIBUTING.md](CONTRIBUTING.md)。

本地发布准备见 [releasing.md](docs/releasing.md)。pnpm release:check vX.Y.Z 校验版本、标签与更新记录。GitHub 发布工作流默认仅检查并生成安装包；尚未配置远程或 npm 发布，本地包元数据不填写虚构仓库地址。

性能基准统一使用 pnpm bench（TypeScript Vitest）与 pnpm bench:browser（Playwright），共享夹具，不维护独立 mjs runner。百万面模型的整体 Worker、所有权与本机量化结果见[性能说明](docs/zh/performance.md)。

## 许可

MIT，见 [LICENSE](LICENSE)。Draco 二进制使用 Apache-2.0。
