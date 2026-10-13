import contributing from "../../../../CONTRIBUTING.md?raw";
import changelog from "../../../../CHANGELOG.md?raw";

export const encodeExample = `import { encodeGeometry, decodeGeometry } from "meshquilt";
import {
    createDracoChunkEncoder,
    decodeDracoChunk
} from "meshquilt/draco";

// Pass your typed position/index/normal/UV arrays.
// Initialize your own Draco modules first.
const bytes = await encodeGeometry(geometry, {
    maxTriangles: 100_000,
    encodeChunk: createDracoChunkEncoder(encoderModule)
});

const { chunks } = await decodeGeometry(
    bytes,
    (payload) => decodeDracoChunk(decoderModule, payload)
);
// Use raw chunks in your renderer or processing pipeline.`;

export const workerExample = `import { encodeGeometry } from "meshquilt";
import { createDracoWorkerPool } from "meshquilt/draco";

const pool = await createDracoWorkerPool({
    workerUrl,
    encoderScriptUrl: "/draco/draco_encoder.js",
    size: 2
});
try {
    const bytes = await encodeGeometry(geometry, {
        maxTriangles: 100_000,
        concurrency: 2,
        encodeChunk: pool.encodeChunk,
        onProgress({ completedChunks, totalChunks }) {
            console.log(completedChunks, totalChunks);
        }
    });
} finally {
    pool.dispose();
}`;

export interface Doc {
    id: string;
    title: [string, string];
    description: [string, string];
    category: "start" | "api" | "concepts" | "project";
    content: [string, string];
    source?: string;
}

const markdown = import.meta.glob<string>("../../../../docs/**/*.md", {
    eager: true,
    query: "?raw",
    import: "default"
});
function page(
    id: string,
    file: string,
    title: Doc["title"],
    description: Doc["description"],
    category: Doc["category"]
): Doc {
    const en = markdown[`../../../../docs/${file}.md`];
    const zh = markdown[`../../../../docs/zh/${file}.md`];
    if (!en || !zh) throw new Error(`Missing English or Chinese documentation: ${file}`);
    return { id, title, description, category, content: [en, zh], source: `docs/${file}.md` };
}

export const docs: Doc[] = [
    page(
        "introduction",
        "introduction",
        ["Introduction", "项目介绍"],
        ["One array-first package. Clear boundaries.", "面向数组的单包与清晰边界。"],
        "start"
    ),
    page(
        "quick-start",
        "quick-start",
        ["Quick start", "快速上手"],
        ["Encode raw geometry and receive independent chunks.", "编码原始几何，解码独立分块。"],
        "start"
    ),
    page(
        "core",
        "geometry",
        ["Geometry API", "几何 API"],
        ["Typed arrays, lazy splitting, and the MQLT pipeline.", "类型化数组、惰性分块与 MQLT 流水线。"],
        "api"
    ),
    page(
        "draco",
        "draco",
        ["Draco adapter", "Draco 适配器"],
        ["An optional codec, injected by your application.", "由应用注入的可选编解码器。"],
        "api"
    ),
    page(
        "workers",
        "workers",
        ["Browser Workers", "浏览器 Worker"],
        ["Asset deployment, scheduling and lifecycle.", "资源部署、调度与生命周期。"],
        "api"
    ),
    page(
        "three",
        "three",
        ["Three.js example", "Three.js 示例"],
        ["An integration example, outside the published library.", "发布库之外的源码集成示例。"],
        "api"
    ),
    page(
        "quantization",
        "quantization",
        ["Quantization & seams", "量化与接缝"],
        ["Why a shared grid keeps boundaries aligned.", "共享网格如何保持边界对齐。"],
        "concepts"
    ),
    page(
        "container-format",
        "container-format",
        ["MQLT container", "MQLT 容器"],
        ["A versioned header with opaque chunk payloads.", "版本化头部与不透明分块载荷。"],
        "concepts"
    ),
    page(
        "runtime",
        "runtime-and-memory",
        ["Runtime & memory", "运行时与内存"],
        ["Ownership, progress and cancellation.", "所有权、进度与取消。"],
        "concepts"
    ),
    page(
        "performance",
        "performance",
        ["Performance & benchmarks", "性能与基准"],
        ["Measured stages, memory trade-offs and UI responsiveness.", "分阶段测量、内存取舍与界面响应。"],
        "concepts"
    ),
    page(
        "migration",
        "migration",
        ["Package migration", "单包迁移"],
        ["New entrypoints, preserved MQLT data.", "新的导入入口，保持 MQLT 兼容。"],
        "project"
    ),
    page(
        "releasing",
        "releasing",
        ["Local release preparation", "本地发布准备"],
        ["Version guards, local archives and optional publishing.", "版本校验、本地安装包与可选发布。"],
        "project"
    ),
    {
        id: "contributing",
        title: ["Contributing", "参与贡献"],
        description: ["Help improve MeshQuilt.", "帮助改进 MeshQuilt。"],
        category: "project",
        content: [contributing, markdown["../../../../docs/zh/contributing.md"]!],
        source: "CONTRIBUTING.md"
    },
    {
        id: "changelog",
        title: ["Changelog", "更新日志"],
        description: ["What changed in MeshQuilt.", "MeshQuilt 的版本变更。"],
        category: "project",
        content: [changelog, markdown["../../../../docs/zh/changelog.md"]!],
        source: "CHANGELOG.md"
    }
];

export function headingId(text: string) {
    return text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, "")
        .replace(/\s+/g, "-");
}
