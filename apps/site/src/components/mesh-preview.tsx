import { lazy, Suspense, useState } from "react";
import { Maximize2, Pause, Play, RotateCcw, Box } from "lucide-react";
import { useSite } from "@/lib/site-context";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";

const MeshCanvas = lazy(() => import("./mesh-canvas"));

export function MeshPreview() {
    const { t } = useSite();
    const [explode, setExplode] = useState(12);
    const [wireframe, setWireframe] = useState(false);
    const [rotate, setRotate] = useState(false);

    return (
        <div className="mesh-preview">
            <div className="preview-top">
                <span className="live-indicator" />
                {t("Live geometry", "实时几何预览")}
                <span className="preview-format">indexed mesh</span>
            </div>
            <div className="preview-stage">
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
                    <MeshCanvas explode={explode} wireframe={wireframe} rotate={rotate} />
                </Suspense>
                <div className="preview-caption">
                    <span>{t("Drag to orbit", "拖动旋转")}</span>
                    <span>
                        torus-knot.mesh <span className="illustration-tag">{t("preview", "预览")}</span>
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
                        <strong>16</strong> {t("chunks", "块")}
                    </span>
                    <span>
                        <strong>7,200</strong> {t("triangles", "三角形")}
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
                        onClick={() => {
                            setExplode(0);
                            setWireframe(false);
                            setRotate(false);
                        }}
                        aria-label={t("Reset preview controls", "重置预览参数")}
                        title={t("Reset controls", "重置参数")}
                    >
                        <RotateCcw size={15} />
                    </Button>
                </div>
            </div>
        </div>
    );
}
