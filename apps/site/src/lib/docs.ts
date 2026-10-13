import core from "../../../../packages/core/README.md?raw";
import three from "../../../../packages/three/README.md?raw";
import draco from "../../../../packages/draco/README.md?raw";
import quantization from "../../../../docs/quantization.md?raw";
import container from "../../../../docs/container-format.md?raw";
import contributing from "../../../../CONTRIBUTING.md?raw";
import changelog from "../../../../CHANGELOG.md?raw";
import { version } from "./config";

export const encodeExample = `import { encodeMesh, decodeMesh } from "@meshquilt/three";
import {
    createDracoChunkEncoder,
    decodeDracoChunk
} from "@meshquilt/draco";

// Load the Draco encoder and decoder modules first.
const buffer = await encodeMesh(mesh, {
    maxTriangles: 100_000,
    encodeChunk: createDracoChunkEncoder(encoderModule)
});

const group = await decodeMesh(
    buffer,
    (bytes) => decodeDracoChunk(decoderModule, bytes),
    mesh
);
mesh.parent?.add(group);`;

export const workerExample = `import { encodeMesh } from "@meshquilt/three";
import { createDracoWorkerPool } from "@meshquilt/draco";

const pool = await createDracoWorkerPool({
    workerUrl,
    encoderScriptUrl: "/draco_encoder.js",
    size: 2
});

try {
    const buffer = await encodeMesh(mesh, {
        maxTriangles: 100_000,
        concurrency: 2,
        encodeChunk: pool.encodeChunk
    });
    // Store or transfer the MQLT buffer.
} finally {
    pool.dispose();
}`;

export interface Doc {
    id: string;
    title: [string, string];
    description: [string, string];
    category: "start" | "packages" | "concepts" | "project";
    content: [string, string];
    source?: string;
}

const introduction = `# Meet MeshQuilt

MeshQuilt is a modular mesh codec for the browser. It splits an indexed triangle mesh into smaller pieces, compresses those pieces, and renders them without quantization cracks at the boundaries.

## One mesh, one grid

Vertices on a chunk boundary are copied into both chunks. MeshQuilt measures the position and UV volumes once, across the entire source mesh, and gives every encoder the same quantization settings. Shared vertices stay on the same grid.

## Three focused packages

| Package | Responsibility |
| --- | --- |
| @meshquilt/core | Geometry splitting, shared quantization, MQLT container. No Three.js or Draco dependency. |
| @meshquilt/three | Convert THREE.Mesh inputs and render decoded chunks as a THREE.Group. |
| @meshquilt/draco | Injectable Draco adapters and a worker pool with isolated encoder modules. |

## What to know first

- The input is an **indexed triangle mesh with one material**. Split multi-material meshes first.
- Compute smooth normals on the **complete mesh before splitting**.
- Position and normal attributes have three components; UVs have two.
- Decoding returns separate chunk buffers, not one welded allocation.
- Load 3MF, glTF or STL yourself, then pass a THREE.Mesh to the library.
- Draco binaries are supplied by your application. MeshQuilt does not bundle them.

## Current release

The repository version is **${version}**. MeshQuilt is MIT licensed; Draco has its own Apache-2.0 license. This site shows an actual split geometry preview, not a compression benchmark.

Continue with [Quick start](#/docs/quick-start) or learn about [quantization and seams](#/docs/quantization).
`;

const introductionZh = `# 认识 MeshQuilt

MeshQuilt 是一个面向浏览器的模块化网格编解码库。它将索引三角网格拆成较小的块，压缩这些块，并在渲染时避免量化造成的边界裂缝。

## 一个网格，一套量化网格

分块边界的顶点会被复制到两侧的块中。MeshQuilt 基于完整源网格计算一次位置和 UV 范围，并向所有编码器传入相同的量化配置，让共享顶点落在同一套网格上。

## 三个职责清晰的包

| 包 | 职责 |
| --- | --- |
| @meshquilt/core | 几何分块、共享量化、MQLT 容器，不依赖 Three.js 或 Draco。 |
| @meshquilt/three | 读取 THREE.Mesh，将解码后的块绘制为 THREE.Group。 |
| @meshquilt/draco | 可注入的 Draco 适配器，以及隔离编码器实例的 Worker 池。 |

## 使用前须知

- 输入是**单材质的索引三角网格**。多材质网格需先拆分。
- 必须在**完整网格上计算平滑法线，再进行分块**。
- 位置和法线属性为三个分量，UV 为两个分量。
- 解码返回独立的块缓冲区，不重新焊接成一个大缓冲区。
- 自行加载 3MF、glTF 或 STL，再将 THREE.Mesh 传给本库。
- 应用自行提供 Draco 二进制文件，MeshQuilt 不捆绑这些文件。

## 当前版本

仓库版本为 **${version}**。MeshQuilt 使用 MIT 许可证，Draco 使用 Apache-2.0 许可证。本站展示真实的几何分块预览，不提供压缩性能基准。

继续阅读[快速上手](#/docs/quick-start)或[量化与接缝](#/docs/quantization)。
`;

const quickStart = `# Quick start

## Set up the workspace

MeshQuilt is a pnpm workspace. For local development, use Node.js 22 or newer and pnpm 10 or newer, then run these commands from your clone:

\`\`\`bash
pnpm install
pnpm build
\`\`\`

The package READMEs also document npm installation. If the packages are not yet available on your registry, use the local workspace instead.

## Prepare your mesh

Load your model using the appropriate Three.js loader. The mesh needs an index, one material, and tightly packed position attributes. Compute smooth normals before encoding. File loading is outside MeshQuilt.

## Load Draco separately

Supply a Draco build that exposes DracoEncoderModule and DracoDecoderModule. Load its scripts and initialize both modules before using this example:

\`\`\`ts
const encoderModule = await DracoEncoderModule({});
const decoderModule = await DracoDecoderModule({});
\`\`\`

Serve the matching WASM files at the paths expected by your Draco build. Use its locateFile option when needed. Draco is Apache-2.0; it is not included in MeshQuilt.

## Encode and draw

\`\`\`ts
${encodeExample}
\`\`\`

The source argument gives the decoded group the source material and local transform. The decoded chunks stay separate. Hide or remove the original mesh in your application when you replace it with the decoded group.

## Encode in parallel

\`\`\`ts
${workerExample}
\`\`\`

Set workerUrl to the served @meshquilt/draco/worker script (worker/encode.worker.js). The worker uses importScripts, so provide a classic worker URL, not a module worker. Serve the Draco encoder script and matching WASM files where your build expects them. Keep the pool at 2–4 workers: each worker owns a chunk and a WASM heap.

One Draco module is not re-entrant. Use concurrency: 1 with createDracoChunkEncoder, or use the worker pool for overlapping encoding calls.

## Choose quantization

The defaults are 14 position bits, 8 normal bits and 10 UV bits. A value of 0 disables quantization for that attribute. See [Quantization and seams](#/docs/quantization) for the details.
`;

const quickStartZh = `# 快速上手

## 安装工作区

MeshQuilt 使用 pnpm 工作区。本地开发需要 Node.js 22+ 和 pnpm 10+，在克隆的仓库中运行：

\`\`\`bash
pnpm install
pnpm build
\`\`\`

各包的 README 也提供 npm 安装说明。如果注册源尚未发布这些包，请使用本地工作区。

## 准备网格

使用相应的 Three.js 加载器读取模型。网格需要索引、单个材质以及紧密排列的位置属性。编码前在完整网格上计算平滑法线。模型文件的加载不属于 MeshQuilt 的职责。

## 单独加载 Draco

自行提供暴露 DracoEncoderModule 与 DracoDecoderModule 的 Draco 构建，加载脚本并初始化两个模块：

\`\`\`ts
const encoderModule = await DracoEncoderModule({});
const decoderModule = await DracoDecoderModule({});
\`\`\`

将匹配的 WASM 文件部署到该 Draco 构建需要的路径，必要时使用 locateFile 选项。Draco 使用 Apache-2.0 许可证，不随 MeshQuilt 分发。

## 编码与绘制

\`\`\`ts
${encodeExample}
\`\`\`

source 参数让解码结果继承源网格的材质和局部变换，块仍保持独立。当使用解码结果替换源网格时，在应用中隐藏或移除原始网格。

## 并行编码

\`\`\`ts
${workerExample}
\`\`\`

workerUrl 指向已部署的 @meshquilt/draco/worker 脚本（worker/encode.worker.js）。Worker 使用 importScripts，需要经典 Worker URL，而不是模块 Worker。自行部署 Draco 编码脚本及匹配的 WASM 文件。建议使用 2–4 个 Worker，每个 Worker 都持有一个块和一个 WASM 堆。

单个 Draco 模块不可重入。使用 createDracoChunkEncoder 时设置 concurrency: 1，需要并发时使用 Worker 池。

## 选择量化参数

默认位置 14 位、法线 8 位、UV 10 位。设为 0 可禁用对应属性的量化。详见[量化与接缝](#/docs/quantization)。
`;

const coreZh = `# @meshquilt/core

对索引三角网格分块，计算共享量化范围，并将编码器输出打包为 MQLT 容器。

不依赖 Three.js 或 Draco，由应用传入 encodeChunk 函数。

## 安装

\`\`\`bash
npm install @meshquilt/core
\`\`\`

## 编码

\`\`\`ts
import { encodeGeometry } from "@meshquilt/core";

const buffer = await encodeGeometry(geometry, {
    maxTriangles: 100_000,
    encodeChunk(chunk, quant) {
        return myEncoder(chunk, quant);
    }
});
\`\`\`

geometry.position 是紧密排列的 xyz，geometry.index 是三角形索引列表。normal 和 uv 为可选的逐顶点属性。

所有块的 encodeChunk 接收相同的 quant。除非显式传入 positionVolume 或 uvVolume，否则位置和 UV 原点取自完整网格。

## 解码

\`\`\`ts
import { decodeGeometry } from "@meshquilt/core";

const decoded = await decodeGeometry(buffer, (bytes) => myDecoder(bytes));
\`\`\`

结果为每个块独立的几何数据，不重新焊接。
`;

const threeZh = `# @meshquilt/three

读取 THREE.Mesh，并将解码后的块转为 Group。

## 安装

\`\`\`bash
npm install @meshquilt/three three
\`\`\`

three 是 peer dependency。

## 使用

\`\`\`ts
import { decodeMesh, encodeMesh } from "@meshquilt/three";

const buffer = await encodeMesh(mesh, {
    maxTriangles: 100_000,
    encodeChunk
});
const group = await decodeMesh(buffer, decodeChunk, mesh);
mesh.parent?.add(group);
\`\`\`

Group 复制源网格的位置、四元数与缩放，父级变换仍保留在父级。材质数组会被拒绝，请先按材质拆分。

chunksToGroup 在块之间共享源材质，不合并块缓冲区。
`;

const dracoZh = `# @meshquilt/draco

MeshQuilt 的 Draco 编码和解码适配器。

该包不捆绑 draco_encoder.js。自行加载暴露 DracoEncoderModule 和 DracoDecoderModule 的构建，并传入初始化后的模块。

Draco 使用 Apache-2.0 许可证，适配器使用 MIT 许可证。

## 单块编码

\`\`\`ts
import { createDracoChunkEncoder } from "@meshquilt/draco";
const encodeChunk = createDracoChunkEncoder(encoderModule);
\`\`\`

单个模块不可重入，不能同时调用同一个 encodeChunk。位置和 UV 使用共享范围与 SetAttributeExplicitQuantization，法线使用 SetAttributeQuantization 和 Draco 的八面体网格。

## Worker 池

\`\`\`ts
${workerExample}
\`\`\`

workerUrl 指向 @meshquilt/draco/worker（worker/encode.worker.js）。每个 Worker 通过 importScripts 加载编码器，保留独立模块。建议池大小为 2–4。

## 解码

\`\`\`ts
import { decodeDracoChunk } from "@meshquilt/draco";
const chunk = decodeDracoChunk(decoderModule, bytes);
\`\`\`
`;

const quantizationZh = `# 量化与接缝

MeshQuilt 会把顶点复制到每个引用它的块。如果每个块根据自己的包围盒量化位置，同一个输入就可能落在不同的量化网格上，导致解码后的边界出现裂缝。

## 共享位置范围

编码前，MeshQuilt 基于完整网格计算一次位置范围。origin 是最小角点，range 是最大的轴跨度。每个块使用相同范围调用 POSITION 的 SetAttributeExplicitQuantization。

## 共享 UV 范围

UV 使用相同规则，取完整网格 UV 的并集，而不是单个块的 UV 包围盒。TEX_COORD 使用该原点与范围进行显式量化。

## 法线与默认参数

法线不使用网格包围盒。Draco 的八面体编码器仅根据位数构建网格。normalBits 相同时，完全相同的单位法线在不同块中保持一致，原始向量长度不保留。

设为 0 可跳过该属性的量化。默认位置 14 位、法线 8 位、UV 10 位。

在完整网格上计算平滑法线，再进行分块。块内单独计算法线无法看到相邻块，会让切口变成硬边。

将解码后的块作为独立网格绘制。重新合并会恢复分块原本要避免的大型分配。
`;

const containerZh = `# 容器格式

MQLT 文件使用小端序，魔数为 MQLT。本版本仅写入版本 1。

| 偏移 | 字段 |
| --- | --- |
| 0 | 4 字节魔数 |
| 4 | uint16 版本 |
| 6 | uint16 标志：位 0 表示存在法线，位 1 表示存在 UV |
| 8 | uint32 块数量 |
| 12 | 位置位数、法线位数、UV 位数及一个保留字节 |
| 16 | 三个 float32 位置原点 xyz，以及 float32 范围 |
| 32 | 两个 float32 UV 原点 uv，以及 float32 范围 |
| 44 | 重复的 uint32 字节长度与编码器字节数据 |

range 是最大轴跨度。位置与 UV 原点取自完整网格，块不在头部存储自己的原点。

每段长度后的字节对容器而言是不透明数据。Draco 适配器写入 Draco 网格；其他编码器也可以使用该容器，只要传给 decodeGeometry 的解码器能够理解这些字节。
`;

const contributingZh = `# 参与贡献

感谢你帮助改进 MeshQuilt。

## 开发环境

需要 Node.js 22 与 pnpm 10+。

\`\`\`bash
pnpm install
pnpm site
\`\`\`

## 提交 Pull Request 前

\`\`\`bash
pnpm check
pnpm test
pnpm build
\`\`\`

pnpm check 运行 Prettier、ESLint 与 TypeScript 检查。修改包导出或站点时也要构建。

## 官网开发

运行 pnpm site 启动独立的 React 官网。修改官网行为时，先安装 Chromium，再运行浏览器检查：

\`\`\`bash
pnpm --filter @meshquilt/site exec playwright install chromium
pnpm site:test
\`\`\`

浏览器测试覆盖桌面与移动布局、Pages 子路径文档路由、键盘操作、搜索、语言与主题持久化、代码复制、WebGL 降级和无障碍检查。请保持中文翻译与源 Markdown 同步。

## 提交说明

使用简短的英文 Conventional Commit，例如 fix:、feat:、docs: 或 ci:，说明用户能观察到的变化。

## 发布

从 main 分支通过 v* 标签发布。同步根目录与可发布包的版本，将 Unreleased 条目移至版本标题，等待 CI 通过后创建并推送标签。首次发布前需为可发布包配置 repository 字段。

## 反馈问题

缺陷与功能建议通过 GitHub Issues 提交。安全问题请遵循仓库 SECURITY.md，避免公开披露。
`;

const changelogZh = `# 更新日志

记录用户可见的变更，版本对应仓库标签（例如 v0.1.0）。

## Unreleased

## 0.1.0

- 对索引三角网格分块，将压缩结果打包为 MQLT 容器。
- 基于完整网格共享位置与 UV 量化范围，让块边界保持同一量化网格。
- 读取 THREE.Mesh，将解码结果绘制为 Group 的独立子网格。
- 通过注入的 Draco 模块编码与解码，使用 Worker 池让每个编码器实例在独立线程运行。
`;

export const docs: Doc[] = [
    {
        id: "introduction",
        title: ["Introduction", "项目介绍"],
        description: ["A small codec with a clear division of responsibilities.", "职责清晰的模块化网格编解码库。"],
        category: "start",
        content: [introduction, introductionZh]
    },
    {
        id: "quick-start",
        title: ["Quick start", "快速上手"],
        description: ["From an indexed mesh to independent, decoded chunks.", "从索引网格到独立解码的几何块。"],
        category: "start",
        content: [quickStart, quickStartZh]
    },
    {
        id: "core",
        title: ["@meshquilt/core", "@meshquilt/core"],
        description: ["The codec-independent foundation.", "与编码器无关的基础层。"],
        category: "packages",
        content: [core, coreZh],
        source: "packages/core/README.md"
    },
    {
        id: "three",
        title: ["@meshquilt/three", "@meshquilt/three"],
        description: ["Bring your mesh. Keep your material.", "使用现有网格与材质。"],
        category: "packages",
        content: [three, threeZh],
        source: "packages/three/README.md"
    },
    {
        id: "draco",
        title: ["@meshquilt/draco", "@meshquilt/draco"],
        description: ["Draco adapters and isolated workers.", "Draco 适配器与隔离的 Worker。"],
        category: "packages",
        content: [draco, dracoZh],
        source: "packages/draco/README.md"
    },
    {
        id: "quantization",
        title: ["Quantization & seams", "量化与接缝"],
        description: ["Why a shared grid makes the difference.", "共享量化网格如何避免裂缝。"],
        category: "concepts",
        content: [quantization, quantizationZh],
        source: "docs/quantization.md"
    },
    {
        id: "container-format",
        title: ["MQLT container", "MQLT 容器"],
        description: ["A compact header. Opaque chunk payloads.", "紧凑的头部与不透明的块载荷。"],
        category: "concepts",
        content: [container, containerZh],
        source: "docs/container-format.md"
    },
    {
        id: "contributing",
        title: ["Contributing", "参与贡献"],
        description: ["Help improve the project.", "帮助改进项目。"],
        category: "project",
        content: [contributing, contributingZh],
        source: "CONTRIBUTING.md"
    },
    {
        id: "changelog",
        title: ["Changelog", "更新日志"],
        description: ["What changed in MeshQuilt.", "MeshQuilt 的版本变更。"],
        category: "project",
        content: [changelog, changelogZh],
        source: "CHANGELOG.md"
    }
];

export function headingId(text: string) {
    return text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, "")
        .replace(/\s+/g, "-");
}
