import { describe, expect, it } from "vitest";
import { decodeContainer, decodeGeometry, encodeGeometry, splitGeometry } from "meshquilt";
import type { ChunkGeometry, GeometryInput, GeometryProgress } from "meshquilt";

const position = new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]);

describe("array-first geometry input", () => {
    it("accepts Uint16 indices and normalizes output without mutating the source", async () => {
        const index = new Uint16Array([0, 1, 2, 0, 2, 3]);
        const input: GeometryInput = { position, index };
        const chunks = splitGeometry(input, 10);
        expect(chunks[0]!.index).toBeInstanceOf(Uint32Array);
        expect(chunks[0]!.index).toEqual(new Uint32Array(index));
        expect(input.index).toBe(index);
        const encoded = await encodeGeometry(input, { maxTriangles: 1, encodeChunk: () => new Uint8Array([1]) });
        expect(decodeContainer(encoded).header.chunkCount).toBe(2);
    });

    it("splits triangle soup and carries per-vertex attributes without a full input index", async () => {
        const input: GeometryInput = {
            position: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0]),
            uv: new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1])
        };
        const chunks = splitGeometry(input, 1);
        expect(chunks).toHaveLength(2);
        for (const chunk of chunks) expect(chunk.index).toEqual(new Uint32Array([0, 1, 2]));
        expect(chunks[1]!.uv).toEqual(new Float32Array([0, 0, 1, 1, 0, 1]));
        expect(input.index).toBeUndefined();
        const bytes = await encodeGeometry(input, { maxTriangles: 1, encodeChunk: () => new Uint8Array([1]) });
        expect(decodeContainer(bytes).header.chunkCount).toBe(2);
    });

    it("rejects nonindexed positions that do not form complete triangles", () => {
        expect(() => splitGeometry({ position }, 1)).toThrow(/triangle/);
    });
});

it("reports typed progress after completed encode and decode chunks", async () => {
    const events: GeometryProgress[] = [];
    const input = { position, index: new Uint32Array([0, 1, 2, 0, 2, 3]) };
    const chunks: ChunkGeometry[] = [];
    const bytes = await encodeGeometry(input, {
        maxTriangles: 1,
        concurrency: 2,
        encodeChunk(chunk) {
            chunks.push(chunk);
            return new Uint8Array([chunks.length - 1]);
        },
        onProgress(event) {
            events.push(event);
        }
    });
    expect(events).toEqual([
        { stage: "encode", completedChunks: 0, totalChunks: 2 },
        { stage: "encode", completedChunks: 1, totalChunks: 2 },
        { stage: "encode", completedChunks: 2, totalChunks: 2 }
    ]);
    events.length = 0;
    await decodeGeometry(bytes, (payload) => chunks[payload[0]!]!, 2, {
        onProgress(event) {
            events.push(event);
        }
    });
    expect(events).toEqual([
        { stage: "decode", completedChunks: 0, totalChunks: 2 },
        { stage: "decode", completedChunks: 1, totalChunks: 2 },
        { stage: "decode", completedChunks: 2, totalChunks: 2 }
    ]);
});

it("waits for active codecs when a progress observer throws", async () => {
    let finish!: () => void;
    const active = new Promise<void>((resolve) => {
        finish = resolve;
    });
    const error = new Error("progress observer failed");
    const started: number[] = [];
    const input = { position, index: new Uint32Array([0, 1, 2, 0, 2, 3, 0, 1, 3]) };
    let returned = false;
    const operation = encodeGeometry(input, {
        maxTriangles: 1,
        concurrency: 2,
        async encodeChunk(_chunk, _quant, index) {
            started.push(index);
            if (index === 1) await active;
            return new Uint8Array([index]);
        },
        onProgress({ completedChunks }) {
            if (completedChunks > 0) throw error;
        }
    });
    const settled = operation.catch(() => {
        returned = true;
    });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(returned).toBe(false);
    finish();
    await expect(operation).rejects.toBe(error);
    await settled;
    expect(started).toEqual([0, 1]);
});
