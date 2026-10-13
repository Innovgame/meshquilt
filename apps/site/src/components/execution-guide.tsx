import { ArrowRight, Check, Cpu, Monitor, Workflow } from "lucide-react";
import { useSite } from "@/lib/site-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

type Mode = "whole" | "pool" | "direct";

function ThreadDiagram({ mode }: { mode: Mode }) {
    const { t } = useSite();
    const prepare = t("Validate & bounds", "校验与共享范围");
    const split = t("Split", "分块");
    const encode = t("Encode", "编码");
    const pack = t("Pack MQLT", "打包 MQLT");
    const lanes = [
        {
            name: t("Main thread", "主线程"),
            icon: Monitor,
            steps:
                mode === "whole"
                    ? [t("Send input", "发送输入"), t("Receive MQLT", "接收 MQLT")]
                    : mode === "pool"
                      ? [prepare, split, pack]
                      : [prepare, split, encode, pack],
            muted: false
        },
        {
            name: mode === "pool" ? t("Worker pool", "Worker 池") : t("Dedicated Worker", "专用 Worker"),
            icon: Cpu,
            steps:
                mode === "whole"
                    ? [prepare, split, encode, pack]
                    : mode === "pool"
                      ? [t("Encode independent chunks", "并行编码独立块")]
                      : [t("No Worker", "不使用 Worker")],
            muted: mode === "direct"
        }
    ];
    return (
        <div className="thread-diagram">
            {lanes.map((lane) => (
                <div className={`thread-lane${lane.muted ? " thread-lane-muted" : ""}`} key={lane.name}>
                    <div className="thread-label">
                        <lane.icon size={17} aria-hidden="true" />
                        <span>{lane.name}</span>
                    </div>
                    <ol className="thread-steps">
                        {lane.steps.map((step, index) => (
                            <li key={step}>
                                {index > 0 && <ArrowRight size={14} aria-hidden="true" />}
                                <span>{step}</span>
                            </li>
                        ))}
                    </ol>
                </div>
            ))}
        </div>
    );
}

export function ExecutionGuide() {
    const { t } = useSite();
    const modes = [
        {
            id: "whole" as const,
            label: t("Whole pipeline", "整体流水线"),
            api: "encodeDracoInWorker",
            title: t("Keep the interface moving.", "让界面持续响应。"),
            description: t(
                "All processing runs in one dedicated Worker: validation, shared bounds, splitting, Draco encoding and packing. One encoder, one WASM heap.",
                "校验、共享范围、分块、Draco 编码和打包全部在一个专用 Worker 中完成，一个编码器对应一个 WASM 堆。"
            ),
            points: [
                t("Best fit for million-triangle models and UI responsiveness.", "适合百万面模型，优先界面响应。"),
                t(
                    "The Worker closes on completion, failure, timeout or cancellation.",
                    "完成、失败、超时或取消后自动释放 Worker。"
                )
            ],
            ownership: t(
                "Copying is the default and preserves your buffers. Set transferInput: true only when you can give up every input buffer; all views sharing those buffers detach.",
                "默认复制并保留原缓冲区。仅在可以放弃全部输入缓冲区时设置 transferInput: true；共享这些缓冲区的视图都会分离。"
            ),
            note: t(
                "Per-call startup is included. Fewer heaps take priority over multicore throughput.",
                "每次调用包含启动成本，优先减少 WASM 堆而非多核吞吐。"
            )
        },
        {
            id: "pool" as const,
            label: t("Chunk pool", "分块 Worker 池"),
            api: "createDracoWorkerPool",
            title: t("Give independent chunks their own lane.", "让独立分块并行处理。"),
            description: t(
                "Preprocessing stays on the calling thread. A pool encodes chunks concurrently, with one Draco module and WASM heap per Worker.",
                "预处理仍在调用线程完成。Worker 池并行编码各块，每个 Worker 持有独立的 Draco 模块和 WASM 堆。"
            ),
            points: [
                t(
                    "Start with 2–4 Workers and match encode concurrency to pool size.",
                    "建议从 2–4 个 Worker 开始，让编码并发数匹配池大小。"
                ),
                t(
                    "Reuse a warm pool across models; dispose it in finally.",
                    "可跨模型复用已初始化的池，在 finally 中释放。"
                )
            ],
            ownership: t(
                "Input arrays remain attached. The pool copies a chunk when a Worker is available and transfers that copy.",
                "输入数组保持可用，仅在 Worker 空闲时复制一个块并转移该副本。"
            ),
            note: t(
                "More Workers increase WASM memory. Main-thread preparation can still pause the interface.",
                "更多 Worker 会增加 WASM 内存，主线程预处理仍可能造成界面停顿。"
            )
        },
        {
            id: "direct" as const,
            label: t("Direct module", "直接模块"),
            api: "createDracoChunkEncoder",
            title: t("Use the codec in your own runtime.", "在自己的运行时中使用编解码器。"),
            description: t(
                "Preprocessing and encoding stay on the calling thread. Inject your Draco module or a custom codec into the array-first pipeline.",
                "预处理和编码都留在调用线程。向面向数组的流水线注入 Draco 模块或自己的编解码器。"
            ),
            points: [
                t(
                    "Useful in Node.js, your own Worker, or for smaller meshes.",
                    "适用于 Node.js、自建 Worker 或较小模型。"
                ),
                t(
                    "Use concurrency: 1 with a direct Draco module; it is not re-entrant.",
                    "直接 Draco 模块不可重入，使用 concurrency: 1。"
                )
            ],
            ownership: t(
                "Keep input arrays unchanged and attached until encoding finishes. No browser Worker lifecycle to manage.",
                "编码完成前保持输入数组不变且未分离，无需管理浏览器 Worker 生命周期。"
            ),
            note: t(
                "A Promise does not move CPU work off the main thread.",
                "返回 Promise 并不意味着 CPU 工作离开了主线程。"
            )
        }
    ];
    return (
        <section className="section container execution-section" id="execution" aria-labelledby="execution-title">
            <div className="section-heading">
                <div>
                    <p className="section-kicker">
                        <Workflow size={16} />
                        {t("Execution & ownership", "执行方式与所有权")}
                    </p>
                    <h2 id="execution-title">{t("Choose where the work runs.", "决定工作在哪里执行。")}</h2>
                </div>
                <p>
                    {t(
                        "The same shared grid in every mode. Choose the balance of responsiveness, throughput and memory your application needs.",
                        "所有模式共用同一量化网格，根据应用选择界面响应、吞吐与内存之间的取舍。"
                    )}
                </p>
            </div>
            <Tabs defaultValue="whole" className="execution-guide">
                <TabsList className="execution-tabs" aria-label={t("Execution modes", "执行模式")}>
                    {modes.map((mode) => (
                        <TabsTrigger key={mode.id} value={mode.id}>
                            {mode.label}
                        </TabsTrigger>
                    ))}
                </TabsList>
                {modes.map((mode) => (
                    <TabsContent key={mode.id} value={mode.id} className="execution-panel">
                        <div className="execution-copy">
                            <code className="execution-api">{mode.api}</code>
                            <h3>{mode.title}</h3>
                            <p>{mode.description}</p>
                            <ul>
                                {mode.points.map((point) => (
                                    <li key={point}>
                                        <Check size={15} aria-hidden="true" />
                                        <span>{point}</span>
                                    </li>
                                ))}
                            </ul>
                            <a className="text-link" href="#/docs/workers">
                                {t("Worker deployment guide", "Worker 部署指南")}
                                <ArrowRight size={15} />
                            </a>
                        </div>
                        <div className="execution-detail">
                            <ThreadDiagram mode={mode.id} />
                            <div className="ownership-note">
                                <strong>{t("Input ownership", "输入所有权")}</strong>
                                <p>{mode.ownership}</p>
                            </div>
                            <p className="execution-tradeoff">{mode.note}</p>
                        </div>
                    </TabsContent>
                ))}
            </Tabs>
        </section>
    );
}
