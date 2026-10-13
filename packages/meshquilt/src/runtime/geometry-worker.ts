import { MeshQuiltError } from "../types.js";
import type { GeometryInput, GeometryProgress } from "../types.js";
import type { EncodeGeometryOptions } from "../pipeline.js";
import type { DracoWorkerPoolOptions } from "./worker-pool.js";
import type { WorkerRequest } from "./protocol.js";

export interface DracoGeometryWorkerOptions
    extends
        Omit<EncodeGeometryOptions, "encodeChunk" | "concurrency">,
        Pick<DracoWorkerPoolOptions, "workerUrl" | "encoderScriptUrl" | "wasmUrl" | "settings" | "timeoutMs"> {
    /** Default false. True transfers ownership after startup, detaching all input ArrayBuffers. */
    transferInput?: boolean;
}

/** Runs validation, quantization, splitting, encoding and packing in one dedicated Worker. */
export async function encodeDracoInWorker(
    geometry: GeometryInput,
    options: DracoGeometryWorkerOptions
): Promise<Uint8Array> {
    if (typeof Worker === "undefined") throw new MeshQuiltError("Worker is not available");
    if (options.signal?.aborted) throw new MeshQuiltError("geometry encoding aborted");
    const timeoutMs = options.timeoutMs ?? 30_000;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 0x7fffffff)
        throw new MeshQuiltError("timeoutMs must be > 0 and <= 2147483647");

    return new Promise((resolve, reject) => {
        const worker = new Worker(options.workerUrl);
        let started = false;
        let settled = false;
        const finish = (error?: Error, bytes?: Uint8Array) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            options.signal?.removeEventListener("abort", abort);
            worker.removeEventListener("message", message);
            worker.removeEventListener("error", failure);
            worker.removeEventListener("messageerror", failure);
            worker.terminate();
            if (error) reject(error);
            else resolve(bytes!);
        };
        const abort = () => finish(new MeshQuiltError("geometry encoding aborted"));
        const failure = () => finish(new MeshQuiltError("geometry encoding Worker failed"));
        const timer = setTimeout(() => finish(new MeshQuiltError("geometry encoding timed out")), timeoutMs);
        const message = (event: MessageEvent) => {
            try {
                const data: unknown = event.data;
                if (!data || typeof data !== "object") throw new MeshQuiltError("invalid geometry Worker response");
                if ("error" in data) throw new MeshQuiltError(String(data.error));
                if ("type" in data && data.type === "ready" && !started) {
                    started = true;
                    const { maxTriangles, positionBits, normalBits, uvBits, positionVolume, uvVolume } = options;
                    const request: WorkerRequest = {
                        type: "encodeGeometry",
                        id: 1,
                        geometry,
                        options: { maxTriangles, positionBits, normalBits, uvBits, positionVolume, uvVolume }
                    };
                    const transfers: Transferable[] = [];
                    if (options.transferInput) {
                        const buffers = new Set<ArrayBuffer>();
                        for (const attribute of Object.values(geometry))
                            if (attribute?.buffer instanceof ArrayBuffer) buffers.add(attribute.buffer);
                        transfers.push(...buffers);
                    }
                    // With no transfers, structured clone preserves the caller's inputs. SharedArrayBuffers
                    // remain shared; callers must not mutate them until the operation has completed.
                    worker.postMessage(request, transfers);
                    return;
                }
                if (!started || !("id" in data) || data.id !== 1)
                    throw new MeshQuiltError("unexpected geometry Worker response");
                if ("type" in data && data.type === "progress" && "progress" in data) {
                    const progress = data.progress as GeometryProgress;
                    if (
                        progress.stage !== "encode" ||
                        !Number.isInteger(progress.totalChunks) ||
                        progress.totalChunks < 1 ||
                        !Number.isInteger(progress.completedChunks) ||
                        progress.completedChunks < 0 ||
                        progress.completedChunks > progress.totalChunks
                    )
                        throw new MeshQuiltError("invalid geometry Worker progress");
                    options.onProgress?.(progress);
                } else if ("buffer" in data && data.buffer instanceof ArrayBuffer)
                    finish(undefined, new Uint8Array(data.buffer));
                else throw new MeshQuiltError("invalid geometry Worker buffer");
            } catch (error) {
                finish(error instanceof Error ? error : new MeshQuiltError(String(error)));
            }
        };
        worker.addEventListener("message", message);
        worker.addEventListener("error", failure);
        worker.addEventListener("messageerror", failure);
        options.signal?.addEventListener("abort", abort, { once: true });
        try {
            const request: WorkerRequest = {
                type: "init",
                encoderScriptUrl: options.encoderScriptUrl,
                wasmUrl: options.wasmUrl,
                settings: options.settings
            };
            worker.postMessage(request);
        } catch (error) {
            finish(error instanceof Error ? error : new MeshQuiltError(String(error)));
        }
    });
}
