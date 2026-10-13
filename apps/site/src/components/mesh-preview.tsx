import { lazy, Suspense, useRef, useState } from "react";
import { Maximize2, Pause, Play, RotateCcw, Box, Upload, Download, Scan, X, Layers } from "lucide-react";
import { useSite } from "@/lib/site-context";
import { formatBytes, geometryBytes, triangleCount } from "@/lib/mesh-metrics";
import { useMeshPlayground } from "@/lib/use-mesh-playground";
import { MAX_NORMAL_BITS } from "@/lib/mesh-limits";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";

const MeshCanvas = lazy(() => import("./mesh-canvas"));

export function MeshPreview() {
    const { t } = useSite();
    const playground = useMeshPlayground();
    const { source, model, settings, result, busy, progress, error } = playground;
    const fileInput = useRef<HTMLInputElement>(null);
    const [explode, setExplode] = useState(12);
    const [wireframe, setWireframe] = useState(false);
    const [rotate, setRotate] = useState(false);
    const [fitVersion, setFitVersion] = useState(0);
    const [dragging, setDragging] = useState(false);
    const errorText =
        error === "limit"
            ? t(
                  "Preview limit: 100 MiB, 2 million triangles, 1,000 chunks. Use a smaller model or larger chunks.",
                  "预览上限：100 MiB、200 万三角形、1,000 块。请缩小模型或增加每块三角形数。"
              )
            : error === "empty"
              ? t(
                    "No triangles found. Choose a file containing a triangle mesh.",
                    "没有找到三角形，请选择包含三角网格的文件。"
                )
              : error === "unsupported"
                ? t(
                      "Use STL, OBJ, a self-contained static GLB (without compressed geometry), or a Draco MQLT file. Animation and instancing are unsupported.",
                      "请选择 STL、OBJ、自包含的静态 GLB（几何未经扩展压缩）或 Draco MQLT 文件。暂不支持动画和实例化。"
                  )
                : t(
                      "Could not process this model. Check that the file is valid and the local codec resources are available, then try again.",
                      "无法处理模型，请检查文件是否完整及本地编解码资源是否可用，然后重试。"
                  );
    const busyText =
        busy === "encode"
            ? t("Encoding", "正在编码")
            : busy === "decode"
              ? t("Decoding", "正在解码")
              : busy === "split"
                ? t("Splitting", "正在分块")
                : t("Loading geometry", "正在加载几何");

    function load(file?: File) {
        if (!file || busy) return;
        setExplode(0);
        void playground.importFile(file);
    }

    return (
        <div
            className={`mesh-preview${dragging ? " mesh-preview-dragging" : ""}`}
            onDragOver={(event) => {
                event.preventDefault();
                if (!busy) setDragging(true);
            }}
            onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
            }}
            onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                load(event.dataTransfer.files[0]);
            }}
        >
            <div className="preview-top">
                <span className="live-indicator" />
                {t("Live geometry", "实时几何预览")}
                <span className="preview-format">{model?.header ? "MQLT · Draco" : "indexed mesh"}</span>
            </div>
            <div className="preview-file-toolbar">
                <input
                    ref={fileInput}
                    type="file"
                    className="preview-file-input"
                    accept=".stl,.obj,.glb,.mqlt"
                    aria-label={t("Import model file", "导入模型文件")}
                    disabled={!!busy}
                    onChange={(event) => {
                        load(event.target.files?.[0]);
                        event.target.value = "";
                    }}
                />
                <Button variant="outline" size="sm" disabled={!!busy} onClick={() => fileInput.current?.click()}>
                    <Upload size={14} />
                    {t("Import model", "导入模型")}
                </Button>
                <Button size="sm" disabled={!!busy || !source} onClick={() => void playground.encode()}>
                    <Download size={14} />
                    {t("Encode & download", "编码并下载")}
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    disabled={!!busy}
                    onClick={() => {
                        setExplode(12);
                        void playground.resetDemo();
                    }}
                >
                    {t("Use demo", "恢复示例")}
                </Button>
            </div>
            <p className="preview-import-hint">
                {dragging
                    ? t("Drop your model here", "将模型拖放到这里")
                    : t("Drop STL / OBJ / GLB / MQLT · local processing", "拖入 STL / OBJ / GLB / MQLT · 本地处理")}
            </p>
            <div className="preview-stage" aria-busy={!!busy}>
                <div className="axis-label axis-y">Y</div>
                <div className="axis-label axis-x">X</div>
                <Suspense
                    fallback={
                        <div className="mesh-loading">
                            <Box size={32} />
                            <span>{t("Preparing the mesh…", "正在准备网格…")}</span>
                        </div>
                    }
                >
                    {model && (
                        <MeshCanvas
                            chunks={model.chunks}
                            explode={explode}
                            wireframe={wireframe}
                            rotate={rotate}
                            fitVersion={fitVersion}
                        />
                    )}
                </Suspense>
                {!model && (
                    <div className="mesh-loading">
                        <Layers size={28} />
                        <span>{busy ? busyText : t("Import a model to begin", "导入模型以开始")}</span>
                    </div>
                )}
                <div className="preview-caption">
                    <span>{t("Drag to orbit · scroll to zoom", "拖动旋转 · 滚动缩放")}</span>
                    <span className="preview-model-name" title={source?.name}>
                        {source?.name ?? "—"}
                    </span>
                </div>
            </div>
            <div className="preview-controls">
                <label id="explode-label">
                    <Maximize2 size={14} />
                    {t("Separate chunks", "分离几何块")}
                </label>
                <Slider
                    value={[explode]}
                    onValueChange={(value) => setExplode(value[0]!)}
                    min={0}
                    max={100}
                    step={1}
                    aria-labelledby="explode-label"
                    aria-label={t("Chunk separation", "分块间距")}
                />
                <span className="slider-value">{explode}%</span>
            </div>
            <div className="preview-bottom">
                <div className="preview-stats">
                    <span>
                        <strong>{model?.chunks.length.toLocaleString() ?? "—"}</strong> {t("chunks", "块")}
                    </span>
                    <span>
                        <strong>{model ? triangleCount(model.geometry).toLocaleString() : "—"}</strong>{" "}
                        {t("triangles", "三角形")}
                    </span>
                </div>
                <div className="preview-actions">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setWireframe(!wireframe)}
                        aria-pressed={wireframe}
                        aria-label={t("Toggle wireframe", "切换线框")}
                        title={t("Wireframe", "线框")}
                    >
                        <Box size={16} />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setRotate(!rotate)}
                        aria-pressed={rotate}
                        aria-label={t("Toggle rotation", "切换自动旋转")}
                        title={t("Auto rotate", "自动旋转")}
                    >
                        {rotate ? <Pause size={15} /> : <Play size={15} />}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setFitVersion((value) => value + 1)}
                        aria-label={t("Fit model to view", "适配模型视图")}
                        title={t("Fit to view", "适配视图")}
                    >
                        <Scan size={16} />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                            setExplode(0);
                            setWireframe(false);
                            setRotate(false);
                            setFitVersion((value) => value + 1);
                        }}
                        aria-label={t("Reset preview controls", "重置预览参数")}
                        title={t("Reset controls", "重置参数")}
                    >
                        <RotateCcw size={15} />
                    </Button>
                </div>
            </div>
            <div className="preview-codec-panel">
                <fieldset className="preview-settings" disabled={!!busy || !source}>
                    <legend>{t("Encoding settings", "编码设置")}</legend>
                    <label>
                        {t("Triangles / chunk", "三角形 / 块")}
                        <select
                            value={settings.maxTriangles}
                            onChange={(event) =>
                                void playground.changeSettings({
                                    ...settings,
                                    maxTriangles: Number(event.target.value)
                                })
                            }
                        >
                            {[450, 1000, 10000, 100000].map((count) => (
                                <option key={count} value={count}>
                                    {count.toLocaleString()}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        {t("Position precision", "位置精度")}
                        <select
                            value={settings.positionBits}
                            onChange={(event) =>
                                void playground.changeSettings({
                                    ...settings,
                                    positionBits: Number(event.target.value)
                                })
                            }
                        >
                            {[...new Set([8, 10, 12, 14, 16, 20, 24, 30, settings.positionBits])]
                                .sort((a, b) => a - b)
                                .map((bits) => (
                                    <option key={bits} value={bits}>
                                        {bits} bit
                                    </option>
                                ))}
                        </select>
                    </label>
                </fieldset>
                <details className="preview-advanced">
                    <summary>{t("Normals & UV precision", "法线与 UV 精度")}</summary>
                    <fieldset className="preview-settings" disabled={!!busy || !source}>
                        <legend className="preview-file-input">{t("Attribute precision", "属性精度")}</legend>
                        {(["normalBits", "uvBits"] as const).map((key) => (
                            <label key={key}>
                                {key === "normalBits" ? t("Normals", "法线") : "UV"}
                                <select
                                    value={settings[key]}
                                    onChange={(event) =>
                                        void playground.changeSettings({
                                            ...settings,
                                            [key]: Number(event.target.value)
                                        })
                                    }
                                >
                                    {[
                                        ...new Set([
                                            8,
                                            10,
                                            12,
                                            14,
                                            16,
                                            20,
                                            24,
                                            key === "normalBits" ? MAX_NORMAL_BITS : 30,
                                            settings[key]
                                        ])
                                    ]
                                        .sort((a, b) => a - b)
                                        .map((bits) => (
                                            <option key={bits} value={bits}>
                                                {bits} bit
                                            </option>
                                        ))}
                                </select>
                            </label>
                        ))}
                    </fieldset>
                </details>
                {source && (
                    <p className="preview-grid-note">
                        {t("Shared position grid step", "共享位置网格步长")}:{" "}
                        <strong>
                            {settings.positionBits === 0
                                ? t("disabled (full precision)", "关闭量化（原始精度）")
                                : (source.positionRange / (2 ** settings.positionBits - 1)).toPrecision(3)}
                        </strong>{" "}
                        {settings.positionBits !== 0 && t("model units", "模型单位")}
                        <br />
                        {t("Geometry buffers", "几何缓冲区")}: {formatBytes(geometryBytes(source.geometry))} ·{" "}
                        {source.geometry.normal ? t("normals", "有法线") : t("no normals", "无法线")} ·{" "}
                        {source.geometry.uv ? "UV" : t("no UV", "无 UV")}
                        {source.sourceBytes !== undefined && (
                            <>
                                {" "}
                                · {t("Input file", "输入文件")}: {formatBytes(source.sourceBytes)}
                            </>
                        )}
                        {source.header && (
                            <>
                                <br />
                                {t(
                                    "Imported chunk boundaries are preserved; export uses the settings above.",
                                    "保留导入文件的分块边界；再次导出使用上方设置。"
                                )}
                                <br />
                                {t("Stored position / normal / UV bits", "文件位置 / 法线 / UV 位数")}:{" "}
                                {source.header.quantization.positionBits} / {source.header.quantization.normalBits} /{" "}
                                {source.header.quantization.uvBits}
                            </>
                        )}
                    </p>
                )}
                {busy && (
                    <div className="preview-progress" role="status" aria-live="polite">
                        <span>
                            {busyText}
                            {progress ? ` · ${progress.completedChunks}/${progress.totalChunks}` : "…"}
                        </span>
                        {progress && (
                            <progress
                                value={progress.completedChunks}
                                max={progress.totalChunks}
                                aria-label={busyText}
                            />
                        )}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={playground.cancel}
                            aria-label={t("Cancel operation", "取消操作")}
                        >
                            <X size={14} />
                            {t("Cancel", "取消")}
                        </Button>
                    </div>
                )}
                {error && (
                    <p className="preview-error" role="alert">
                        {errorText}
                    </p>
                )}
                {result && (
                    <div className="preview-result">
                        <div>
                            <strong>MQLT · {formatBytes(result.bytes.byteLength)}</strong>
                            <span>
                                {(result.inputBytes / result.bytes.byteLength).toFixed(2)}×{" "}
                                {t("vs geometry buffers", "相对几何缓冲区")} · {result.elapsed.toFixed(0)} ms ·{" "}
                                {result.header.chunkCount} {t("chunks", "块")}
                            </span>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={!!busy}
                            onClick={() => void playground.previewEncoded()}
                        >
                            {t("Preview encoded result", "预览编码结果")}
                        </Button>
                        {playground.decoded && (
                            <div
                                className="preview-view-toggle"
                                role="group"
                                aria-label={t("Geometry comparison", "几何对比")}
                            >
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    aria-pressed={playground.view === "original"}
                                    disabled={!!busy}
                                    onClick={() => playground.setView("original")}
                                >
                                    {t("Original", "原始")}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    aria-pressed={playground.view === "decoded"}
                                    disabled={!!busy}
                                    onClick={() => playground.setView("decoded")}
                                >
                                    {t("Decoded", "解码后")}
                                </Button>
                            </div>
                        )}
                    </div>
                )}
                <p className="preview-footnote">
                    {t(
                        "Geometry only: positions, normals and UVs. Materials, textures and animations are not exported. Quantization is lossy; timings describe this run.",
                        "仅保存位置、法线和 UV，材质、贴图及动画不导出。量化有损；耗时仅代表本次运行。"
                    )}
                </p>
            </div>
        </div>
    );
}
