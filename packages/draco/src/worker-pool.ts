import type { ChunkGeometry, SharedQuantization } from "@meshquilt/core";
import { MeshQuiltError } from "@meshquilt/core";

export interface DracoWorkerPoolOptions {
    workerUrl: string | URL;
    encoderScriptUrl: string;
    size?: number;
}

export interface DracoWorkerPool {
    encodeChunk(chunk: ChunkGeometry, quant: SharedQuantization): Promise<Uint8Array>;
    dispose(): void;
}

interface ReadyMessage {
    type: "ready";
    error?: string;
}

interface EncodedMessage {
    id: number;
    buffer?: ArrayBuffer;
    error?: string;
}

/**
 * One Draco module per worker. The encoder wasm is not re-entrant, and a single
 * huge mesh is what runs the tab out of memory. Keep `size` at 2-4.
 */
export async function createDracoWorkerPool(options: DracoWorkerPoolOptions): Promise<DracoWorkerPool> {
    if (typeof Worker === "undefined") throw new MeshQuiltError("Worker is not available");
    const size = options.size ?? 2;
    if (!Number.isInteger(size) || size < 1) throw new MeshQuiltError("worker pool size must be an integer >= 1");

    const workers = Array.from({ length: size }, () => new Worker(options.workerUrl));
    await Promise.all(workers.map((worker) => initWorker(worker, options.encoderScriptUrl)));

    const idle = [...workers];
    const waiters: Array<(worker: Worker) => void> = [];
    let nextId = 1;
    const pending = new Map<number, { resolve: (buffer: Uint8Array) => void; reject: (error: Error) => void }>();

    for (const worker of workers) {
        worker.addEventListener("message", (event: MessageEvent<EncodedMessage>) => {
            if (!("id" in event.data)) return;
            const task = pending.get(event.data.id);
            if (!task) return;
            pending.delete(event.data.id);
            if (event.data.error) task.reject(new MeshQuiltError(event.data.error));
            else task.resolve(new Uint8Array(event.data.buffer!));
        });
    }

    function acquire(): Promise<Worker> {
        const worker = idle.pop();
        if (worker) return Promise.resolve(worker);
        return new Promise((resolve) => waiters.push(resolve));
    }

    function release(worker: Worker): void {
        const waiter = waiters.shift();
        if (waiter) waiter(worker);
        else idle.push(worker);
    }

    return {
        async encodeChunk(chunk, quant) {
            const worker = await acquire();
            try {
                return await postChunk(worker, nextId++, chunk, quant, pending);
            } finally {
                release(worker);
            }
        },
        dispose() {
            for (const worker of workers) worker.terminate();
            for (const task of pending.values()) task.reject(new MeshQuiltError("worker pool disposed"));
            pending.clear();
        }
    };
}

function initWorker(worker: Worker, encoderScriptUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const onMessage = (event: MessageEvent<ReadyMessage>) => {
            if (event.data.type !== "ready") return;
            worker.removeEventListener("message", onMessage);
            if (event.data.error) reject(new MeshQuiltError(event.data.error));
            else resolve();
        };
        worker.addEventListener("message", onMessage);
        worker.addEventListener("error", () => reject(new MeshQuiltError("Draco worker failed to start")), {
            once: true
        });
        worker.postMessage({ type: "init", encoderScriptUrl });
    });
}

function postChunk(
    worker: Worker,
    id: number,
    chunk: ChunkGeometry,
    quant: SharedQuantization,
    pending: Map<number, { resolve: (buffer: Uint8Array) => void; reject: (error: Error) => void }>
): Promise<Uint8Array> {
    const position = new Float32Array(chunk.position);
    const index = new Uint32Array(chunk.index);
    const normal = chunk.normal ? new Float32Array(chunk.normal) : undefined;
    const uv = chunk.uv ? new Float32Array(chunk.uv) : undefined;
    const transfer: Transferable[] = [position.buffer, index.buffer];
    if (normal) transfer.push(normal.buffer);
    if (uv) transfer.push(uv.buffer);

    return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        worker.postMessage({ type: "encode", id, chunk: { position, index, normal, uv }, quant }, transfer);
    });
}
