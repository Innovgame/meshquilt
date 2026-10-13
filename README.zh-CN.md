# MeshQuilt

[English](README.md) | [简体中文](README.zh-CN.md)

在浏览器里把 `THREE.Mesh` 切成块，并行压缩，再按块画回去。接缝上的位置和 UV 仍落在同一套量化网格上。

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

版本 `0.1.0`。变更记录在 [CHANGELOG.md](CHANGELOG.md)。

3MF、glTF、STL 不在这个库里解析。先把它们装成 `THREE.Mesh`，再交给 MeshQuilt。

## 包

| 包                 | 作用                                                               |
| ------------------ | ------------------------------------------------------------------ |
| `@meshquilt/core`  | 切块、共用量化范围、`MQLT` 容器。不依赖 three.js，也不依赖 Draco。 |
| `@meshquilt/three` | 读取 `THREE.Mesh`，把解码后的块放进一个 `Group`。                  |
| `@meshquilt/draco` | Draco 编解码适配，以及 worker 池。                                 |
| `@meshquilt/demo`  | 在浏览器里看分块和接缝。                                           |
| `@meshquilt/site`  | 独立的开源官网与可搜索文档，用于 GitHub Pages。                    |

## 快速开始

```bash
pnpm install
pnpm demo
```

```ts
import { decodeMesh, encodeMesh } from "@meshquilt/three";
import { createDracoChunkEncoder, decodeDracoChunk } from "@meshquilt/draco";

const encoderModule = await DracoEncoderModule({});
const buffer = await encodeMesh(mesh, {
    maxTriangles: 100_000,
    encodeChunk: createDracoChunkEncoder(encoderModule)
});

const group = await decodeMesh(buffer, (bytes) => decodeDracoChunk(decoderModule, bytes), mesh);
mesh.parent?.add(group);
```

`createDracoChunkEncoder` 不能在同一个 Draco 模块上并发调用。要并行编码，用 `createDracoWorkerPool`，池大小保持在 2 到 4。每个 worker 里都有一块几何体和一份 wasm 堆。

## 它做什么

- 把带索引的三角网格切成块，编码器不必一次看见整份顶点缓冲。
- 先为整张网格算一套位置范围和一套 UV 范围，每一块都按这套范围量化。
- 法线走 Draco 的八面体网格。位数相同，原来相同的单位法线在块之间仍然对齐。
- 用一个小的 `MQLT` 容器装每块的字节。容器本身不要求 Draco。Draco 适配器只是你可以传进去的一种编码器。
- 解码结果是分开的网格。库不会把它们再焊成一份大缓冲。

## 限制

- 一个源网格只有一种材质。多材质要先拆开再编码。
- 骨骼、实例化和 morph-target 网格需先烘焙成静态几何；部分 drawRange 需提取为独立几何。
- UV 是 2 分量。位置和法线是 3 分量。
- 平滑法线要在切块之前，在完整网格上算好。按块算法线会把切口变成硬边。
- 某项位数为 `0` 时，不为该项设置量化。默认是位置 14、法线 8、UV 10。
- 演示页不附带 `draco_encoder.js`。Draco 构建需要自己加载。Draco 使用 Apache-2.0。

细节见 [量化与接缝](docs/quantization.md) 和 [容器格式](docs/container-format.md)。

## 项目官网

独立的 React 官网包含真实网格分块交互、可搜索文档、中英文切换和明暗主题。

```bash
pnpm site
pnpm site:build
pnpm site:preview
```

GitHub Pages 部署说明见 [官网 README](apps/site/README.md)。在仓库 Settings → Pages 中选择 GitHub Actions，工作流将在 main 分支更新后部署。

## 开发

需要 Node.js 22.12+、24+ 或 26+，以及 pnpm 10.33.0。

```bash
pnpm install
pnpm check
pnpm test
pnpm test:packages
pnpm build
```

`pnpm check` 会跑 Prettier、ESLint 和 TypeScript 工程检查。参与方式见 [CONTRIBUTING.md](CONTRIBUTING.md)。

编码现在按需生成几何块，但源网格和完整压缩输出仍占用内存。所有权、取消、Worker 失败处理和零拷贝解码见 [运行时与内存](docs/runtime-and-memory.md)。构建使用 TypeScript 7；因当前 ESLint 解析器的 API 限制，并行保留 TypeScript 6。

## 许可

MIT。见 [LICENSE](LICENSE)。
