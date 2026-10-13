import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDracoWorkerPool } from "meshquilt/draco";
import { computeSharedQuantization } from "meshquilt";

const chunk = { position: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), index: new Uint32Array([0, 1, 2]) };
const quant = computeSharedQuantization(chunk);

class TestWorker extends EventTarget {
    static instances: TestWorker[] = [];
    static initError = false;
    static silent = false;
    static failConstructionAt = -1;
    static failSend = false;
    terminated = false;
    messages: Array<{ type: string; id?: number }> = [];
    constructor() {
        super();
        if (TestWorker.instances.length === TestWorker.failConstructionAt) throw new Error("construction failed");
        TestWorker.instances.push(this);
    }
    postMessage(message: { type: string; id?: number }) {
        if (TestWorker.failSend && message.type === "encode") throw new Error("clone failed");
        this.messages.push(message);
        if (message.type === "init" && !TestWorker.silent)
            queueMicrotask(() =>
                this.reply({ type: "ready", ...(TestWorker.initError ? { error: "init failed" } : {}) })
            );
    }
    reply(data: object) {
        this.dispatchEvent(new MessageEvent("message", { data }));
    }
    terminate() {
        this.terminated = true;
    }
}

async function outcome(promise: Promise<unknown>) {
    return Promise.race([
        promise.then(
            () => "resolved",
            () => "rejected"
        ),
        new Promise<string>((resolve) => setTimeout(() => resolve("pending"), 20))
    ]);
}

beforeEach(() => {
    TestWorker.instances = [];
    TestWorker.initError = false;
    TestWorker.silent = false;
    TestWorker.failConstructionAt = -1;
    TestWorker.failSend = false;
    vi.stubGlobal("Worker", TestWorker);
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe("Draco worker pool lifecycle", () => {
    it("cleans up partially constructed pools", async () => {
        TestWorker.failConstructionAt = 1;
        await expect(
            createDracoWorkerPool({ workerUrl: "worker", encoderScriptUrl: "encoder", size: 2 })
        ).rejects.toThrow("construction failed");
        expect(TestWorker.instances[0]!.terminated).toBe(true);
    });

    it("rejects send failures and closes the pool", async () => {
        const pool = await createDracoWorkerPool({ workerUrl: "worker", encoderScriptUrl: "encoder", size: 1 });
        TestWorker.failSend = true;
        await expect(pool.encodeChunk(chunk, quant)).rejects.toThrow("failed to send");
        expect(TestWorker.instances[0]!.terminated).toBe(true);
    });
    it("times out and cleans up a worker that never becomes ready", async () => {
        vi.useFakeTimers();
        TestWorker.silent = true;
        const ready = createDracoWorkerPool({
            workerUrl: "worker",
            encoderScriptUrl: "encoder",
            timeoutMs: 10,
            size: 1
        });
        const check = expect(ready).rejects.toThrow("initialization timed out");
        await vi.advanceTimersByTimeAsync(10);
        await check;
        expect(TestWorker.instances[0]!.terminated).toBe(true);
    });

    it("times out an encode job and rejects its queue", async () => {
        vi.useFakeTimers();
        const pool = await createDracoWorkerPool({
            workerUrl: "worker",
            encoderScriptUrl: "encoder",
            timeoutMs: 10,
            size: 1
        });
        const first = expect(pool.encodeChunk(chunk, quant)).rejects.toThrow("encoding timed out");
        const second = expect(pool.encodeChunk(chunk, quant)).rejects.toThrow("encoding timed out");
        await vi.advanceTimersByTimeAsync(10);
        await Promise.all([first, second]);
    });

    it("aborts running and queued jobs", async () => {
        const controller = new AbortController();
        const pool = await createDracoWorkerPool({
            workerUrl: "worker",
            encoderScriptUrl: "encoder",
            signal: controller.signal,
            size: 1
        });
        const first = expect(pool.encodeChunk(chunk, quant)).rejects.toThrow("aborted");
        const second = expect(pool.encodeChunk(chunk, quant)).rejects.toThrow("aborted");
        controller.abort();
        await Promise.all([first, second]);
        expect(TestWorker.instances[0]!.terminated).toBe(true);
    });
    it("rejects running, queued and future jobs on disposal", async () => {
        const pool = await createDracoWorkerPool({ workerUrl: "worker", encoderScriptUrl: "encoder", size: 1 });
        const running = pool.encodeChunk(chunk, quant);
        const queued = pool.encodeChunk(chunk, quant);
        const runningOutcome = outcome(running);
        const queuedOutcome = outcome(queued);
        await Promise.resolve();
        pool.dispose();
        pool.dispose();
        expect(await runningOutcome).toBe("rejected");
        expect(await queuedOutcome).toBe("rejected");
        expect(await outcome(pool.encodeChunk(chunk, quant))).toBe("rejected");
        expect(TestWorker.instances.every((worker) => worker.terminated)).toBe(true);
    });

    it.each(["error", "messageerror"])("rejects all work on a runtime %s", async (eventName) => {
        const pool = await createDracoWorkerPool({ workerUrl: "worker", encoderScriptUrl: "encoder", size: 1 });
        const first = outcome(pool.encodeChunk(chunk, quant));
        const second = outcome(pool.encodeChunk(chunk, quant));
        await Promise.resolve();
        TestWorker.instances[0]!.dispatchEvent(new Event(eventName));
        expect(await first).toBe("rejected");
        expect(await second).toBe("rejected");
        expect(TestWorker.instances[0]!.terminated).toBe(true);
        pool.dispose();
    });

    it("terminates every worker when initialization fails", async () => {
        TestWorker.initError = true;
        await expect(
            createDracoWorkerPool({ workerUrl: "worker", encoderScriptUrl: "encoder", size: 2 })
        ).rejects.toThrow("init failed");
        expect(TestWorker.instances.every((worker) => worker.terminated)).toBe(true);
    });

    it("continues queued work after a per-chunk codec error", async () => {
        const pool = await createDracoWorkerPool({ workerUrl: "worker", encoderScriptUrl: "encoder", size: 1 });
        const first = pool.encodeChunk(chunk, quant);
        const firstCheck = expect(first).rejects.toThrow("invalid chunk");
        const second = pool.encodeChunk(chunk, quant);
        await Promise.resolve();
        const worker = TestWorker.instances[0]!;
        worker.reply({ id: worker.messages.at(-1)!.id, error: "invalid chunk" });
        await firstCheck;
        await Promise.resolve();
        worker.reply({ id: worker.messages.at(-1)!.id, buffer: new Uint8Array([4, 5]).buffer });
        await expect(second).resolves.toEqual(new Uint8Array([4, 5]));
        pool.dispose();
    });
});
