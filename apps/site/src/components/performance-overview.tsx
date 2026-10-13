import { ArrowUpRight, ChartNoAxesCombined } from "lucide-react";
import { useState } from "react";
import { useSite } from "@/lib/site-context";

// Recorded Playwright medians from docs/performance.md, before preparation
// consolidation. These are fixed local measurements, never a live benchmark.
const snapshots = {
    indexed: { pool: [128, 17, 77], whole: [407, 1.6, 19] },
    soup: { pool: [211, 51.8, 133], whole: [574, 1.3, 33] }
} as const;

export function PerformanceOverview() {
    const { t } = useSite();
    const [fixture, setFixture] = useState<keyof typeof snapshots>("indexed");
    const snapshot = snapshots[fixture];
    const rows = [
        { label: t("4 pooled Workers", "4 个分块 Worker"), values: snapshot.pool, type: "pool" },
        { label: t("Whole Worker / transfer", "整体 Worker / 转移输入"), values: snapshot.whole, type: "whole" }
    ];
    const metrics = [
        { label: t("Total encoding", "总编码耗时"), unit: "ms", max: Math.max(snapshot.pool[0], snapshot.whole[0]) },
        {
            label: t("Main-thread timer delay", "主线程计时延迟"),
            unit: "ms",
            max: Math.max(snapshot.pool[1], snapshot.whole[1])
        },
        {
            label: t("Encoder WASM capacity", "编码器 WASM 容量"),
            unit: "MiB",
            max: Math.max(snapshot.pool[2], snapshot.whole[2])
        }
    ];
    return (
        <section
            className="performance-section"
            id="performance"
            aria-label={t("Local benchmark results", "本机基准结果")}
        >
            <div className="container">
                <div className="section-heading">
                    <div>
                        <p className="section-kicker">
                            <ChartNoAxesCombined size={16} />
                            {t("Measured, with context", "有依据的测量")}
                        </p>
                        <h2>{t("Speed is one part of the picture.", "性能不止总耗时。")}</h2>
                    </div>
                    <p>
                        {t(
                            "A warmed pool finishes sooner. A whole Worker keeps preparation off the main thread with fewer WASM heaps. Here is that trade-off on a million-triangle fixture.",
                            "预热后的池更快完成，整体 Worker 将预处理移出主线程并减少 WASM 堆。这里展示百万面夹具上的实际取舍。"
                        )}
                    </p>
                </div>
                <div className="benchmark-toolbar">
                    <span>{t("~1 million triangles · normals + UVs", "约 100 万三角面，含法线与 UV")}</span>
                    <div className="fixture-switch" role="group" aria-label={t("Benchmark geometry", "基准几何类型")}>
                        <button aria-pressed={fixture === "indexed"} onClick={() => setFixture("indexed")}>
                            {t("Indexed mesh", "索引网格")}
                        </button>
                        <button aria-pressed={fixture === "soup"} onClick={() => setFixture("soup")}>
                            {t("Triangle soup", "无索引网格")}
                        </button>
                    </div>
                </div>
                <div className="benchmark-table-wrap" aria-live="polite" aria-atomic="true">
                    <table className="benchmark-table">
                        <caption className="sr-only">
                            {t("Recorded local Playwright medians for ", "Playwright 本机测量中位数：")}
                            {fixture === "indexed"
                                ? t("indexed geometry", "索引网格")
                                : t("triangle soup", "无索引网格")}
                        </caption>
                        <thead>
                            <tr>
                                <th scope="col">{t("Encoding mode", "编码模式")}</th>
                                {metrics.map((metric) => (
                                    <th key={metric.label} scope="col">
                                        {metric.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr key={row.type} className={`benchmark-${row.type}`}>
                                    <th scope="row">
                                        <span className="benchmark-key" aria-hidden="true" />
                                        {row.label}
                                    </th>
                                    {row.values.map((value, index) => (
                                        <td key={metrics[index]!.label}>
                                            <span className="benchmark-mobile-label" aria-hidden="true">
                                                {metrics[index]!.label}
                                            </span>
                                            <strong>
                                                {value} <span>{metrics[index]!.unit}</span>
                                            </strong>
                                            <div className="benchmark-track" aria-hidden="true">
                                                <span style={{ width: `${(value / metrics[index]!.max) * 100}%` }} />
                                            </div>
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="benchmark-method">
                    <p>
                        {t(
                            "Snapshot d7417ff, 2026-10-13. i9-14900KF, Chromium, Draco 1.5.7; 14/8/10 bits, 100k triangles per chunk, 3 samples. Pool warmed; whole Worker includes startup. WASM capacity is not total browser memory; timer delay is not frame rate.",
                            "快照 d7417ff，测量于 2026-10-13。i9-14900KF、Chromium、Draco 1.5.7，量化 14/8/10 位，每块 10 万面，每场景 3 次采样。池已预热，整体 Worker 含启动成本。WASM 容量不等于浏览器总内存，计时延迟不等于帧率。"
                        )}
                    </p>
                    <a className="text-link" href="#/docs/performance">
                        {t("Benchmark methodology", "基准测量方法")}
                        <ArrowUpRight size={16} />
                    </a>
                </div>
                <div className="preparation-note">
                    <div>
                        <strong>{t("One attribute scan. Shared bounds.", "属性扫描一次，共享量化范围。")}</strong>
                        <p>
                            {t(
                                "Validation now runs alongside position/UV bounds calculation. Supplied volumes skip unused min/max work.",
                                "位置/UV 校验合并到范围计算；提供共享范围时，跳过无用的 min/max。"
                            )}
                        </p>
                    </div>
                    <a href="#/docs/performance">
                        <strong>30–35%</strong>
                        <span>
                            {t(
                                "less preprocessing time in local Vitest comparisons",
                                "本机 Vitest 对比中，预处理耗时降低"
                            )}
                        </span>
                    </a>
                </div>
            </div>
        </section>
    );
}
