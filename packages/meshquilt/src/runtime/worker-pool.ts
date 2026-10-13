import type { ChunkGeometry, SharedQuantization } from "../types.js";
import { MeshQuiltError } from "../types.js";
import type { DracoEncodeSettings } from "../codecs/draco/encode-chunk.js";
import type { WorkerRequest } from "./protocol.js";

export interface DracoWorkerPoolOptions {
    workerUrl: string | URL;
    encoderScriptUrl: string;
    size?: number;
    /** Startup and individual encoding timeout. Defaults to 30 seconds. */
    timeoutMs?: number;
    /** Aborting terminates the pool and rejects all queued and running work. */
    signal?: AbortSignal;
    /** Same encode/decode speeds as createDracoChunkEncoder. */
    settings?: DracoEncodeSettings;
    /** Optional explicit URL for the encoder's WASM binary. */
    wasmUrl?: string;
}

export interface DracoWorkerPool {
    encodeChunk(chunk: ChunkGeometry, quant: SharedQuantization): Promise<Uint8Array>;
    dispose(): void;
}

interface Job {
    id: number;
    chunk: ChunkGeometry;
    quant: SharedQuantization;
    resolve: (bytes: Uint8Array) => void;
    reject: (error: Error) => void;
}
interface Lane {
    worker: Worker;
    ready: boolean;
    job?: Job;
    timer?: ReturnType<typeof setTimeout>;
    rejectReady: (error: Error) => void;
    cleanup: () => void;
}

/** A runtime worker failure closes the entire pool; codec errors reject only their job. */
export async function createDracoWorkerPool(options: DracoWorkerPoolOptions): Promise<DracoWorkerPool> {
    if (typeof Worker === "undefined") throw new MeshQuiltError("Worker is not available");
    const size = options.size ?? 2;
    const timeoutMs = options.timeoutMs ?? 30_000;
    if (!Number.isInteger(size) || size < 1) throw new MeshQuiltError("worker pool size must be an integer >= 1");
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new MeshQuiltError("timeoutMs must be finite and > 0");
    if (options.signal?.aborted) throw new MeshQuiltError("worker pool aborted");
    const lanes: Lane[] = [];
    const queue: Job[] = [];
    let failure: Error | undefined;
    let nextId = 1;

    function close(error: Error) {
        if (failure) return;
        failure = error;
        options.signal?.removeEventListener("abort", abort);
        for (const lane of lanes) {
            clearTimeout(lane.timer);
            lane.cleanup();
            lane.worker.terminate();
            lane.rejectReady(error);
            lane.job?.reject(error);
            lane.job = undefined;
        }
        for (const job of queue.splice(0)) job.reject(error);
    }
    function abort() {
        close(new MeshQuiltError("worker pool aborted"));
    }
    function dispatch() {
        if (failure) return;
        for (const lane of lanes) {
            if (!lane.ready || lane.job) continue;
            const job = queue.shift();
            if (!job) break;
            lane.job = job;
            lane.timer = setTimeout(() => close(new MeshQuiltError("Draco encoding timed out")), timeoutMs);
            try {
                // Preserve caller ownership; transfer only the in-flight copy.
                const position = new Float32Array(job.chunk.position);
                const index = new Uint32Array(job.chunk.index);
                const normal = job.chunk.normal ? new Float32Array(job.chunk.normal) : undefined;
                const uv = job.chunk.uv ? new Float32Array(job.chunk.uv) : undefined;
                const transfer: Transferable[] = [position.buffer, index.buffer];
                if (normal) transfer.push(normal.buffer);
                if (uv) transfer.push(uv.buffer);
                const message: WorkerRequest = {
                    type: "encode",
                    id: job.id,
                    chunk: { position, index, normal, uv },
                    quant: job.quant
                };
                lane.worker.postMessage(message, transfer);
            } catch (error) {
                close(new MeshQuiltError(`failed to send Draco chunk: ${String(error)}`));
                return;
            }
        }
    }
    options.signal?.addEventListener("abort", abort, { once: true });
    const starts: Promise<void>[] = [];
    try {
        for (let i = 0; i < size; i++) {
            const worker = new Worker(options.workerUrl);
            let resolveReady!: () => void;
            let rejectReady!: (error: Error) => void;
            const started = new Promise<void>((resolve, reject) => {
                resolveReady = resolve;
                rejectReady = reject;
            });
            // A later Worker constructor can fail before Promise.all attaches handlers.
            void started.catch(() => {});
            starts.push(started);
            const lane: Lane = { worker, ready: false, rejectReady, cleanup: () => {} };
            lanes.push(lane);
            const onFailure = () => close(new MeshQuiltError("Draco worker failed"));
            const onMessage = (event: MessageEvent) => {
                if (failure) return;
                const data: unknown = event.data;
                if (!data || typeof data !== "object") {
                    close(new MeshQuiltError("invalid Draco worker response"));
                    return;
                }
                if ("type" in data && data.type === "ready" && !lane.ready) {
                    clearTimeout(lane.timer);
                    if ("error" in data) {
                        close(new MeshQuiltError(String(data.error)));
                        return;
                    }
                    lane.ready = true;
                    resolveReady();
                    return;
                }
                if (!lane.job || !("id" in data) || data.id !== lane.job.id) {
                    close(new MeshQuiltError("unexpected Draco worker response"));
                    return;
                }
                const job = lane.job;
                clearTimeout(lane.timer);
                if ("error" in data) job.reject(new MeshQuiltError(String(data.error)));
                else if ("buffer" in data && data.buffer instanceof ArrayBuffer)
                    job.resolve(new Uint8Array(data.buffer));
                else {
                    close(new MeshQuiltError("invalid Draco worker buffer"));
                    return;
                }
                lane.job = undefined;
                dispatch();
            };
            lane.cleanup = () => {
                worker.removeEventListener("message", onMessage);
                worker.removeEventListener("error", onFailure);
                worker.removeEventListener("messageerror", onFailure);
            };
            worker.addEventListener("message", onMessage);
            worker.addEventListener("error", onFailure);
            worker.addEventListener("messageerror", onFailure);
            lane.timer = setTimeout(
                () => close(new MeshQuiltError("Draco worker initialization timed out")),
                timeoutMs
            );
            const message: WorkerRequest = {
                type: "init",
                encoderScriptUrl: options.encoderScriptUrl,
                wasmUrl: options.wasmUrl,
                settings: options.settings
            };
            worker.postMessage(message);
        }
        await Promise.all(starts);
        if (failure) throw failure;
    } catch (error) {
        close(error instanceof Error ? error : new MeshQuiltError(String(error)));
        throw failure;
    }
    return {
        encodeChunk(chunk, quant) {
            if (failure) return Promise.reject(failure);
            return new Promise((resolve, reject) => {
                queue.push({ id: nextId++, chunk, quant, resolve, reject });
                dispatch();
            });
        },
        dispose() {
            close(new MeshQuiltError("worker pool disposed"));
        }
    };
}
