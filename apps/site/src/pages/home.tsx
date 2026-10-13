import {
    ArrowDown,
    ArrowRight,
    ArrowUpRight,
    Boxes,
    Box,
    Braces,
    Check,
    Cpu,
    Layers3,
    Network,
    Package,
    ScanLine,
    ShieldCheck,
    Workflow
} from "lucide-react";
import { useEffect, useState } from "react";
import { Github } from "@/components/github-icon";
import { githubUrl, version } from "@/lib/config";
import { encodeExample, workerExample } from "@/lib/docs";
import { useSite } from "@/lib/site-context";
import { CodeBlock } from "@/components/code-block";
import { MeshPreview } from "@/components/mesh-preview";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function GridDiagram({ shared }: { shared: boolean }) {
    return (
        <svg
            className="grid-diagram"
            viewBox="0 0 460 216"
            role="img"
            aria-label={
                shared
                    ? "Shared quantization aligns adjacent chunk boundaries / 共享量化对齐分块边界"
                    : "Independent quantization produces a gap at chunk boundaries / 独立量化使边界出现偏移"
            }
        >
            <defs>
                <pattern id={`grid-${shared}`} width="25" height="25" patternUnits="userSpaceOnUse">
                    <path d="M25 0H0v25" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
                </pattern>
            </defs>
            <rect x="30" y="10" width="400" height="195" fill={`url(#grid-${shared})`} />
            <path
                d="M55 160 80 85 130 35 205 60 230 160Z"
                fill="#88acd8"
                fillOpacity="0.25"
                stroke="#7399c9"
                strokeWidth="2"
            />
            <path
                d={shared ? "M230 160 205 60 280 35 355 85 405 160Z" : "M241 167 215 67 290 42 365 92 415 167Z"}
                fill="#e9a887"
                fillOpacity="0.28"
                stroke="#d99573"
                strokeWidth="2"
            />
            <path
                d="m55 160 75-125 100 125M80 85l125-25M130 35l100 125M55 160l150-100"
                stroke="#7399c9"
                fill="none"
                strokeWidth="1"
            />
            <path
                d={
                    shared
                        ? "m230 160 50-125 125 125M205 60l150 25M280 35l75 50M230 160l125-75"
                        : "m241 167 49-125 125 125M215 67l150 25M290 42l75 50M241 167l124-75"
                }
                stroke="#d99573"
                fill="none"
                strokeWidth="1"
            />
            <path
                d="M205 60 230 160"
                stroke={shared ? "#4a9c86" : "#c5594f"}
                strokeWidth="4"
                strokeDasharray={shared ? undefined : "5 5"}
            />
            {[205, 230].map((x, i) => (
                <circle
                    key={x}
                    cx={x}
                    cy={i === 0 ? 60 : 160}
                    r="5"
                    fill={shared ? "#4a9c86" : "#c5594f"}
                    stroke="var(--surface)"
                    strokeWidth="2"
                />
            ))}
            <text x="97" y="195" fill="currentColor" fontSize="11" fontFamily="monospace">
                chunk A
            </text>
            <text x="313" y="195" fill="currentColor" fontSize="11" fontFamily="monospace">
                chunk B
            </text>
        </svg>
    );
}

export function Home({ section }: { section?: string }) {
    const { t } = useSite();
    const [shared, setShared] = useState(true);
    useEffect(() => {
        if (section) document.getElementById(section)?.scrollIntoView({ block: "center" });
    }, [section]);

    return (
        <main id="main-content" tabIndex={-1}>
            <section className="hero container">
                <div className="hero-copy">
                    <a href="#/changelog" className="release-badge">
                        <span className="release-dot" />v{version}
                        <span className="badge-divider" />
                        {t("Small pieces. Big potential.", "小块网格，更多可能。")}
                        <ArrowUpRight size={13} />
                    </a>
                    <h1>
                        {t("One mesh.", "一个网格。")}
                        <br />
                        {t("Many possibilities.", "无限可能。")}
                    </h1>
                    <p className="hero-description">
                        {t(
                            "A modular mesh codec for the browser. Split your geometry, compress in parallel, and bring it back together without the cracks.",
                            "面向浏览器的模块化网格编解码库。拆分几何、并行压缩，再将各块无缝呈现。"
                        )}
                    </p>
                    <div className="hero-buttons">
                        <Button asChild>
                            <a href="#/docs/quick-start">
                                {t("Start building", "开始使用")}
                                <ArrowRight size={16} />
                            </a>
                        </Button>
                        <Button asChild variant="outline">
                            <a href={githubUrl} target="_blank" rel="noreferrer">
                                <Github size={17} />
                                {t("View on GitHub", "查看 GitHub")}
                            </a>
                        </Button>
                    </div>
                    <div className="hero-note">
                        <ShieldCheck size={14} />
                        <span>{t("MIT licensed", "MIT 许可证")}</span>
                        <span className="note-dot" />
                        <span>{t("Built for the browser", "为浏览器而生")}</span>
                    </div>
                </div>
                <div className="hero-visual" id="playground">
                    <MeshPreview />
                    <p className="visual-note">
                        {t(
                            "Actual MeshQuilt splitting. Geometry preview, not a compression benchmark.",
                            "使用 MeshQuilt 真实分块，仅为几何预览，不是压缩性能基准。"
                        )}
                    </p>
                </div>
            </section>

            <div className="ecosystem container">
                <span>{t("Fits right into your stack", "融入现有技术栈")}</span>
                <div>
                    <Braces size={20} />
                    <strong>TypeScript</strong>
                </div>
                <div>
                    <Box size={21} />
                    <strong>Three.js</strong>
                </div>
                <div>
                    <Boxes size={22} />
                    <strong>Draco</strong>
                </div>
                <div>
                    <Cpu size={21} />
                    <strong>Web Workers</strong>
                </div>
                <div className="ecosystem-no-deps">
                    <span className="tiny-dot" />
                    {t("Codec-independent core", "独立的编解码核心")}
                </div>
            </div>

            <section className="section container" id="features">
                <div className="section-heading">
                    <div>
                        <p className="section-kicker">
                            <Layers3 size={15} />
                            {t("The idea behind the quilt", "分块背后的设计")}
                        </p>
                        <h2>
                            {t("Break it down.", "拆得更小。")}
                            <br />
                            {t("Keep it together.", "依然完整。")}
                        </h2>
                    </div>
                    <p>
                        {t(
                            "Large meshes don’t have to be one large problem. Give each piece its own buffer, and every piece the same frame of reference.",
                            "大网格无需变成一个大难题。每个块持有自己的缓冲区，所有块共享同一套量化参考。"
                        )}
                    </p>
                </div>
                <div className="feature-layout">
                    <article className="seam-card">
                        <div className="feature-title">
                            <span className="feature-icon mint">
                                <ScanLine size={20} />
                            </span>
                            <span className="technical-badge">POSITION + UV</span>
                        </div>
                        <h3>{t("Different chunks. One shared grid.", "不同分块，同一量化网格。")}</h3>
                        <p>
                            {t(
                                "Measure once across the full mesh. Shared vertices quantize to the same coordinates, so the pieces meet where they should.",
                                "基于完整网格测量一次，共享顶点量化到相同坐标，让分块边界准确衔接。"
                            )}
                        </p>
                        <div className="seam-switch" role="group" aria-label={t("Quantization comparison", "量化对比")}>
                            <button aria-pressed={!shared} onClick={() => setShared(false)}>
                                {t("Per-chunk grid", "独立量化网格")}
                            </button>
                            <button aria-pressed={shared} onClick={() => setShared(true)}>
                                {t("Shared grid", "共享量化网格")}
                                <Check size={13} />
                            </button>
                        </div>
                        <GridDiagram shared={shared} />
                        <div className={`seam-result ${shared ? "aligned" : "gap"}`} aria-live="polite">
                            <span className="tiny-dot" />
                            {shared
                                ? t("Aligned boundaries, even as separate meshes.", "独立绘制，边界依然对齐。")
                                : t(
                                      "Independent grids can move the same vertex apart.",
                                      "独立量化可能让同一顶点落在不同位置。"
                                  )}
                        </div>
                        <span className="diagram-note">
                            {t("Conceptual illustration of quantization grids", "量化网格的概念示意图")}
                        </span>
                    </article>
                    <div className="feature-stack">
                        <article className="feature-small">
                            <div className="feature-title">
                                <span className="feature-icon blue">
                                    <Cpu size={20} />
                                </span>
                                <span className="technical-badge">2–4 WORKERS</span>
                            </div>
                            <h3>{t("Parallel, with a purpose.", "有边界地并行。")}</h3>
                            <p>
                                {t(
                                    "A worker pool gives each encoder its own Draco module and WASM heap. Work on chunks without feeding the encoder the entire vertex buffer.",
                                    "每个 Worker 持有独立的 Draco 模块和 WASM 堆，以块为单位编码，无需把完整顶点缓冲区交给编码器。"
                                )}
                            </p>
                            <div className="worker-lanes" aria-hidden="true">
                                {[0, 1, 2].map((lane) => (
                                    <div key={lane}>
                                        <span>worker {lane + 1}</span>
                                        {[0, 1, 2, 3].map((piece) => (
                                            <i key={piece} style={{ opacity: 1 - piece * 0.15 }} />
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </article>
                        <article className="feature-small">
                            <div className="feature-title">
                                <span className="feature-icon coral">
                                    <Package size={20} />
                                </span>
                                <span className="technical-badge">MQLT v1</span>
                            </div>
                            <h3>{t("A container, not a commitment.", "一种容器，多种编码。")}</h3>
                            <p>
                                {t(
                                    "A small header carries shared quantization. Chunk payloads stay opaque. Use Draco today, or bring an encoder of your own.",
                                    "小巧的头部记录共享量化配置，块载荷保持不透明。可以使用 Draco，也可以注入自己的编码器。"
                                )}
                            </p>
                            <a className="text-link" href="#/docs/container-format">
                                {t("Inside the format", "了解容器格式")}
                                <ArrowUpRight size={15} />
                            </a>
                        </article>
                    </div>
                </div>
            </section>

            <section className="code-section" id="getting-started">
                <div className="container code-layout">
                    <div className="code-copy">
                        <p className="section-kicker">
                            <Braces size={16} />
                            {t("A small API. A useful pipeline.", "简洁 API，实用流程。")}
                        </p>
                        <h2>
                            {t("Your mesh in.", "传入网格。")}
                            <br />
                            {t("Your chunks out.", "得到分块。")}
                        </h2>
                        <p>
                            {t(
                                "Keep your Three.js workflow. Add an encoder, set a chunk budget, and let MeshQuilt handle the split and the shared quantization.",
                                "延续现有 Three.js 工作流，添加编码器、设置分块上限，剩下的拆分与共享量化交给 MeshQuilt。"
                            )}
                        </p>
                        <ul className="code-benefits">
                            <li>
                                <Check size={16} />
                                {t("Indexed triangle geometry", "索引三角网格")}
                            </li>
                            <li>
                                <Check size={16} />
                                {t("Source material and local transforms", "继承源材质与局部变换")}
                            </li>
                            <li>
                                <Check size={16} />
                                {t("Independent decoded chunk buffers", "独立的解码块缓冲区")}
                            </li>
                        </ul>
                        <Button asChild variant="outline">
                            <a href="#/docs/quick-start">
                                {t("Read the quick start", "阅读快速上手")}
                                <ArrowUpRight size={15} />
                            </a>
                        </Button>
                    </div>
                    <Tabs defaultValue="mesh" className="example-tabs">
                        <TabsList className="example-tabs-list" aria-label={t("Code examples", "代码示例")}>
                            <TabsTrigger value="mesh">{t("Encode & decode", "编码与解码")}</TabsTrigger>
                            <TabsTrigger value="workers">{t("Worker pool", "Worker 池")}</TabsTrigger>
                        </TabsList>
                        <TabsContent value="mesh">
                            <CodeBlock code={encodeExample} title="mesh.ts" />
                        </TabsContent>
                        <TabsContent value="workers">
                            <CodeBlock code={workerExample} title="workers.ts" />
                        </TabsContent>
                        <p className="code-footnote">
                            {t(
                                "Bring your own Draco build. Initialize its modules before encoding.",
                                "自行提供 Draco 构建，编码前先初始化模块。"
                            )}
                        </p>
                    </Tabs>
                </div>
            </section>

            <section className="section container" id="architecture">
                <div className="section-heading">
                    <div>
                        <p className="section-kicker">
                            <Network size={15} />
                            {t("Designed to fit, not take over", "融入应用，各司其职")}
                        </p>
                        <h2>
                            {t("Three packages.", "三个包。")}
                            <br />
                            {t("Clear boundaries.", "清晰边界。")}
                        </h2>
                    </div>
                    <p>
                        {t(
                            "Use just the foundation, or put the whole pipeline together. The core knows geometry. The adapters know your tools.",
                            "仅使用基础层，或组合完整流水线。核心层负责几何，适配器对接具体工具。"
                        )}
                    </p>
                </div>
                <div className="package-cards">
                    {[
                        {
                            id: "core",
                            icon: Layers3,
                            color: "blue",
                            label: t("The foundation", "基础层"),
                            name: "@meshquilt/core",
                            description: t(
                                "Splitting, shared quantization, and the MQLT container. No Three.js. No Draco.",
                                "分块、共享量化与 MQLT 容器，不依赖 Three.js 或 Draco。"
                            ),
                            tags: ["GeometryBuffers", "encodeGeometry"]
                        },
                        {
                            id: "three",
                            icon: Box,
                            color: "mint",
                            label: t("The scene adapter", "场景适配器"),
                            name: "@meshquilt/three",
                            description: t(
                                "Read a THREE.Mesh. Render separate decoded chunks in a Group with your material.",
                                "读取 THREE.Mesh，使用原材质将独立的解码块绘制为 Group。"
                            ),
                            tags: ["THREE.Mesh", "THREE.Group"]
                        },
                        {
                            id: "draco",
                            icon: Boxes,
                            color: "coral",
                            label: t("The compression adapter", "压缩适配器"),
                            name: "@meshquilt/draco",
                            description: t(
                                "Draco encode and decode adapters, plus a pool of isolated encoding workers.",
                                "Draco 编解码适配器，以及隔离实例的编码 Worker 池。"
                            ),
                            tags: ["Draco", "Web Workers"]
                        }
                    ].map((pkg) => (
                        <a className={`package-card ${pkg.color}`} key={pkg.id} href={`#/docs/${pkg.id}`}>
                            <div className="package-card-top">
                                <pkg.icon size={25} />
                                <ArrowUpRight size={18} />
                            </div>
                            <span className="package-label">{pkg.label}</span>
                            <h3>{pkg.name}</h3>
                            <p>{pkg.description}</p>
                            <div className="package-tags">
                                {pkg.tags.map((tag) => (
                                    <span key={tag}>{tag}</span>
                                ))}
                            </div>
                        </a>
                    ))}
                </div>
                <div className="architecture-note">
                    <Workflow size={17} />
                    <code>THREE.Mesh</code>
                    <ArrowRight size={14} />
                    <span>{t("split + quantize", "分块 + 量化")}</span>
                    <ArrowRight size={14} />
                    <span>{t("encode chunks", "逐块编码")}</span>
                    <ArrowRight size={14} />
                    <code>MQLT</code>
                    <ArrowRight size={14} />
                    <code>THREE.Group</code>
                </div>
            </section>

            <section className="docs-banner container">
                <div className="docs-banner-title">
                    <span className="feature-icon blue">
                        <Braces size={23} />
                    </span>
                    <div>
                        <h3>{t("Understand every piece.", "理解每个环节。")}</h3>
                        <p>
                            {t(
                                "Explore the quantization model, the binary format, and the APIs.",
                                "探索量化模型、二进制格式与 API。"
                            )}
                        </p>
                    </div>
                </div>
                <Button asChild variant="outline">
                    <a href="#/docs/introduction">
                        {t("Explore the docs", "浏览文档")}
                        <ArrowRight size={16} />
                    </a>
                </Button>
            </section>

            <section className="community container">
                <div className="community-mark" aria-hidden="true">
                    <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" />
                </div>
                <p className="section-kicker">{t("Made to be built on", "为共同构建而生")}</p>
                <h2>
                    {t("Open source.", "开源。")} {t("Open possibilities.", "开放可能。")}
                </h2>
                <p>
                    {t(
                        "Read the code, ask a question, or help shape what comes next. MeshQuilt is a small project with room for your ideas.",
                        "阅读代码、提出问题，或一起探索下一步。MeshQuilt 是一个小项目，期待你的想法。"
                    )}
                </p>
                <div className="community-buttons">
                    <Button asChild>
                        <a href={githubUrl} target="_blank" rel="noreferrer">
                            <Github size={17} />
                            {t("Explore on GitHub", "在 GitHub 上探索")}
                            <ArrowUpRight size={15} />
                        </a>
                    </Button>
                    <a className="text-link" href="#/docs/contributing">
                        {t("Contribution guide", "贡献指南")}
                        <ArrowRight size={15} />
                    </a>
                </div>
            </section>
            <a
                className="back-top"
                href="#/"
                aria-label={t("Back to top", "返回顶部")}
                onClick={() =>
                    window.scrollTo({
                        top: 0,
                        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth"
                    })
                }
            >
                <ArrowDown size={14} />
                {t("Back to top", "返回顶部")}
            </a>
        </main>
    );
}
