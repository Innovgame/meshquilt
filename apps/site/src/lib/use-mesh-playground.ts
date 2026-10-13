import { useEffect, useRef, useState } from "react";
import { decodeContainer } from "meshquilt";
import type { GeometryProgress, QuiltHeader } from "meshquilt";
import type { MeshModel } from "./mesh-model.js";
import { geometryBytes, triangleCount } from "./mesh-metrics.js";
import { MAX_CHUNKS, MAX_FILE_BYTES, MAX_NORMAL_BITS } from "./mesh-limits.js";
import { codecUrl, runModelWorker } from "./mesh-worker-client.js";

interface Settings {
    maxTriangles: number;
    positionBits: number;
    normalBits: number;
    uvBits: number;
}
interface EncodedResult {
    bytes: Uint8Array<ArrayBuffer>;
    name: string;
    elapsed: number;
    inputBytes: number;
    header: QuiltHeader;
}
const defaults: Settings = { maxTriangles: 450, positionBits: 14, normalBits: 8, uvBits: 10 };

export function useMeshPlayground() {
    const [source, setSource] = useState<MeshModel | null>(null);
    const [decoded, setDecoded] = useState<MeshModel | null>(null);
    const [view, setView] = useState<"original" | "decoded">("original");
    const [settings, setSettings] = useState<Settings>(defaults);
    const [result, setResult] = useState<EncodedResult | null>(null);
    const [busy, setBusy] = useState<"demo" | "import" | "encode" | "decode" | "split" | null>("demo");
    const [progress, setProgress] = useState<GeometryProgress | null>(null);
    const [error, setError] = useState<string | null>(null);
    const operation = useRef<AbortController | null>(null);
    const urls = useRef(new Set<string>());
    const downloads = useRef(new Set<number>());

    async function perform(kind: NonNullable<typeof busy>, task: (controller: AbortController) => Promise<void>) {
        if (operation.current) return;
        const controller = new AbortController();
        operation.current = controller;
        setBusy(kind);
        setProgress(null);
        setError(null);
        try {
            await task(controller);
        } catch (failure) {
            if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "invalid");
        } finally {
            if (operation.current === controller) {
                operation.current = null;
                setBusy(null);
                setProgress(null);
            }
        }
    }

    function cancel() {
        operation.current?.abort();
        operation.current = null;
        setBusy(null);
        setProgress(null);
    }

    function invalidate() {
        setResult(null);
        setDecoded(null);
        setView("original");
    }

    function accept(model: MeshModel, nextSettings: Settings) {
        setSource(model);
        setSettings(nextSettings);
        invalidate();
    }

    useEffect(() => {
        void perform("demo", async (controller) => {
            const model = await runModelWorker({ type: "demo" }, controller.signal);
            if (!controller.signal.aborted) accept(model, defaults);
        });
        const activeUrls = urls.current;
        const activeTimers = downloads.current;
        return () => {
            operation.current?.abort();
            operation.current = null;
            for (const timer of activeTimers) window.clearTimeout(timer);
            for (const url of activeUrls) URL.revokeObjectURL(url);
            activeTimers.clear();
            activeUrls.clear();
        };
    }, []);

    async function importFile(file: File) {
        return perform("import", async (controller) => {
            if (file.size > MAX_FILE_BYTES) throw new Error("limit");
            const extension = file.name.split(".").pop()?.toLowerCase();
            if (!["stl", "obj", "glb", "mqlt"].includes(extension ?? "")) throw new Error("unsupported");
            const buffer = await file.arrayBuffer();
            if (controller.signal.aborted) return;
            const model = await runModelWorker(
                extension === "mqlt"
                    ? {
                          type: "decode",
                          name: file.name,
                          buffer,
                          decoderUrl: codecUrl("draco_decoder.js"),
                          wasmUrl: codecUrl("draco_decoder.wasm")
                      }
                    : { type: "import", name: file.name, buffer, maxTriangles: 10_000 },
                controller.signal,
                setProgress
            );
            if (controller.signal.aborted) return;
            accept(model, {
                ...defaults,
                maxTriangles: 10_000,
                positionBits: model.header?.quantization.positionBits ?? defaults.positionBits,
                normalBits: Math.min(model.header?.quantization.normalBits ?? defaults.normalBits, MAX_NORMAL_BITS),
                uvBits: model.header?.quantization.uvBits ?? defaults.uvBits
            });
        });
    }

    async function resetDemo() {
        return perform("demo", async (controller) => {
            const model = await runModelWorker({ type: "demo" }, controller.signal);
            if (!controller.signal.aborted) accept(model, defaults);
        });
    }

    async function changeSettings(next: Settings) {
        if (operation.current || !source) return;
        if (Math.ceil(triangleCount(source.geometry) / next.maxTriangles) > MAX_CHUNKS) {
            setError("limit");
            return;
        }
        if (next.normalBits < 0 || next.normalBits > MAX_NORMAL_BITS) {
            setError("precision");
            return;
        }
        setError(null);
        if (next.maxTriangles === settings.maxTriangles || source.header) {
            setSettings(next);
            invalidate();
            return;
        }
        return perform("split", async (controller) => {
            const model = await runModelWorker(
                {
                    type: "split",
                    name: source.name,
                    geometry: source.geometry,
                    maxTriangles: next.maxTriangles,
                    sourceBytes: source.sourceBytes
                },
                controller.signal
            );
            if (!controller.signal.aborted) accept(model, next);
        });
    }

    function download(encoded: EncodedResult) {
        const url = URL.createObjectURL(new Blob([encoded.bytes], { type: "application/octet-stream" }));
        urls.current.add(url);
        const link = document.createElement("a");
        link.href = url;
        link.download = encoded.name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        const timer = window.setTimeout(() => {
            URL.revokeObjectURL(url);
            urls.current.delete(url);
            downloads.current.delete(timer);
        }, 60_000);
        downloads.current.add(timer);
    }

    async function encode() {
        if (!source || operation.current) return;
        if (result) {
            download(result);
            return;
        }
        return perform("encode", async (controller) => {
            if (Math.ceil(triangleCount(source.geometry) / settings.maxTriangles) > MAX_CHUNKS)
                throw new Error("limit");
            if (settings.normalBits < 0 || settings.normalBits > MAX_NORMAL_BITS) throw new Error("precision");
            const { encodeDracoInWorker } = await import("meshquilt/draco");
            if (controller.signal.aborted) return;
            const started = performance.now();
            const bytes = await encodeDracoInWorker(source.geometry, {
                ...settings,
                workerUrl: codecUrl("encode.worker.js"),
                encoderScriptUrl: codecUrl("draco_encoder.js"),
                wasmUrl: codecUrl("draco_encoder.wasm"),
                transferInput: false,
                signal: controller.signal,
                timeoutMs: 120_000,
                onProgress: setProgress
            });
            if (controller.signal.aborted) return;
            // Keep downloads within the same byte limit as reimports.
            if (bytes.byteLength > MAX_FILE_BYTES) throw new Error("limit");
            const encoded: EncodedResult = {
                bytes: new Uint8Array(bytes),
                name: source.name.replace(/\.[^.]+$/, "") + ".mqlt",
                elapsed: performance.now() - started,
                inputBytes: geometryBytes(source.geometry),
                header: decodeContainer(bytes, { copyChunks: false }).header
            };
            setResult(encoded);
            download(encoded);
        });
    }

    async function previewEncoded() {
        if (!result || operation.current) return;
        if (decoded) {
            setView("decoded");
            return;
        }
        return perform("decode", async (controller) => {
            const model = await runModelWorker(
                {
                    type: "decode",
                    name: result.name,
                    buffer: result.bytes.slice().buffer,
                    decoderUrl: codecUrl("draco_decoder.js"),
                    wasmUrl: codecUrl("draco_decoder.wasm")
                },
                controller.signal,
                setProgress
            );
            if (!controller.signal.aborted) {
                setDecoded(model);
                setView("decoded");
            }
        });
    }

    return {
        source,
        model: view === "decoded" ? decoded : source,
        decoded,
        view,
        setView,
        settings,
        result,
        busy,
        progress,
        error,
        importFile,
        resetDemo,
        changeSettings,
        encode,
        previewEncoded,
        cancel
    };
}
