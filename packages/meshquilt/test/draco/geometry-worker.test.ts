import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as draco from "meshquilt/draco";

class GeometryWorker extends EventTarget {
    static instances: GeometryWorker[] = [];
    messages: Array<{ message: { type: string }; transfer?: Transferable[] }> = [];
    terminated = false;
    constructor() {
        super();
        GeometryWorker.instances.push(this);
    }
    postMessage(message: { type: string }, transfer?: Transferable[]) {
        this.messages.push({ message, transfer });
        if (message.type === "init") queueMicrotask(() => this.reply({ type: "ready" }));
    }
    reply(data: object) {
        this.dispatchEvent(new MessageEvent("message", { data }));
    }
    terminate() {
        this.terminated = true;
    }
}

beforeEach(() => {
    GeometryWorker.instances = [];
    vi.stubGlobal("Worker", GeometryWorker);
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
});
const geometry = () => ({ position: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), index: new Uint16Array([0, 1, 2]) });
const options = { workerUrl: "worker", encoderScriptUrl: "encoder" };

it("exports a whole-pipeline Worker encoder", () => {
    expect(typeof draco.encodeDracoInWorker).toBe("function");
});

it("preserves input ownership by default and forwards progress", async () => {
    const events: number[] = [];
    const result = draco.encodeDracoInWorker(geometry(), {
        ...options,
        onProgress(event) {
            events.push(event.completedChunks);
        }
    });
    await Promise.resolve();
    const worker = GeometryWorker.instances[0]!;
    expect(worker.messages[1]!.message.type).toBe("encodeGeometry");
    expect(worker.messages[1]!.transfer).toEqual([]);
    worker.reply({ type: "progress", id: 1, progress: { stage: "encode", completedChunks: 0, totalChunks: 1 } });
    worker.reply({ type: "progress", id: 1, progress: { stage: "encode", completedChunks: 1, totalChunks: 1 } });
    worker.reply({ id: 1, buffer: new Uint8Array([1, 2]).buffer });
    await expect(result).resolves.toEqual(new Uint8Array([1, 2]));
    expect(events).toEqual([0, 1]);
    expect(worker.terminated).toBe(true);
});

it("transfers caller buffers only when explicitly requested", async () => {
    const input = geometry();
    const result = draco.encodeDracoInWorker(input, { ...options, transferInput: true });
    await Promise.resolve();
    const worker = GeometryWorker.instances[0]!;
    expect(worker.messages[1]!.transfer).toEqual([input.position.buffer, input.index.buffer]);
    worker.reply({ id: 1, buffer: new Uint8Array([1]).buffer });
    await result;
});

it("terminates all work when the caller aborts", async () => {
    const controller = new AbortController();
    const result = draco.encodeDracoInWorker(geometry(), { ...options, signal: controller.signal });
    const check = expect(result).rejects.toThrow(/aborted/);
    controller.abort();
    await check;
    expect(GeometryWorker.instances[0]!.terminated).toBe(true);
});

it("terminates the Worker if a progress observer throws", async () => {
    const result = draco.encodeDracoInWorker(geometry(), {
        ...options,
        onProgress() {
            throw new Error("observer failed");
        }
    });
    const check = expect(result).rejects.toThrow("observer failed");
    await Promise.resolve();
    GeometryWorker.instances[0]!.reply({
        type: "progress",
        id: 1,
        progress: { stage: "encode", completedChunks: 1, totalChunks: 1 }
    });
    await check;
    expect(GeometryWorker.instances[0]!.terminated).toBe(true);
});

it("rejects an initialization error without transferring input", async () => {
    const input = geometry();
    const result = draco.encodeDracoInWorker(input, { ...options, transferInput: true });
    const check = expect(result).rejects.toThrow("encoder load failed");
    GeometryWorker.instances[0]!.reply({ type: "ready", error: "encoder load failed" });
    await check;
    expect(GeometryWorker.instances[0]!.messages).toHaveLength(1);
    expect(input.position.byteLength).toBe(36);
    expect(GeometryWorker.instances[0]!.terminated).toBe(true);
});

it("terminates a whole-pipeline job on timeout", async () => {
    vi.useFakeTimers();
    const result = draco.encodeDracoInWorker(geometry(), { ...options, timeoutMs: 10 });
    const check = expect(result).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(10);
    await check;
    expect(GeometryWorker.instances[0]!.terminated).toBe(true);
});
