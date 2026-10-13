import type { ChunkGeometry, GeometryProgress } from "meshquilt";
import type { MeshModel } from "./mesh-model.js";

export type ModelWorkerRequest =
    | { type: "demo" }
    | { type: "split"; name: string; geometry: ChunkGeometry; maxTriangles: number; sourceBytes?: number }
    | { type: "import"; name: string; buffer: ArrayBuffer; maxTriangles: number }
    | { type: "decode"; name: string; buffer: ArrayBuffer; decoderUrl: string; wasmUrl: string };

export function codecUrl(name: string) {
    return new URL(`${import.meta.env.BASE_URL}assets/codec/${name}`, window.location.origin).href;
}

export function runModelWorker(
    request: ModelWorkerRequest,
    signal: AbortSignal,
    onProgress?: (progress: GeometryProgress) => void
): Promise<MeshModel> {
    if (signal.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
    return new Promise((resolve, reject) => {
        const worker = new Worker(new URL("./mesh-worker.ts", import.meta.url), { type: "module" });
        const finish = (error?: Error, model?: MeshModel) => {
            clearTimeout(timer);
            signal.removeEventListener("abort", abort);
            worker.terminate();
            if (error) reject(error);
            else resolve(model!);
        };
        const abort = () => finish(new DOMException("Aborted", "AbortError"));
        const timer = window.setTimeout(() => finish(new Error("timeout")), 120_000);
        signal.addEventListener("abort", abort, { once: true });
        worker.onmessage = ({ data }) => {
            if (data.type === "progress") onProgress?.(data.progress);
            else if (data.type === "error") finish(new Error(data.code));
            else if (data.type === "result") finish(undefined, data.model);
        };
        worker.onerror = () => finish(new Error("worker"));
        worker.onmessageerror = () => finish(new Error("worker"));
        try {
            worker.postMessage(request, "buffer" in request ? [request.buffer] : []);
        } catch (error) {
            finish(error instanceof Error ? error : new Error("worker"));
        }
    });
}
