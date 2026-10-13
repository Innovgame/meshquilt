import { describe, expect, it } from "vitest";
import {
    decodeContainer,
    decodeGeometry,
    encodeGeometry,
    type ChunkGeometry,
    type SharedQuantization
} from "meshquilt";

const geometry = {
    position: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]),
    normal: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
    uv: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
    index: new Uint32Array([0, 1, 2, 0, 2, 3])
};

function identityEncode(chunk: ChunkGeometry): Uint8Array {
    return new TextEncoder().encode(
        JSON.stringify({
            position: Array.from(chunk.position),
            index: Array.from(chunk.index),
            normal: chunk.normal ? Array.from(chunk.normal) : undefined,
            uv: chunk.uv ? Array.from(chunk.uv) : undefined
        })
    );
}

function identityDecode(bytes: Uint8Array): ChunkGeometry {
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as {
        position: number[];
        index: number[];
        normal?: number[];
        uv?: number[];
    };
    const chunk: ChunkGeometry = {
        position: Float32Array.from(parsed.position),
        index: Uint32Array.from(parsed.index)
    };
    if (parsed.normal) chunk.normal = Float32Array.from(parsed.normal);
    if (parsed.uv) chunk.uv = Float32Array.from(parsed.uv);
    return chunk;
}

describe("encodeGeometry", () => {
    it("gives every chunk the same position and uv volume", async () => {
        const seen: SharedQuantization[] = [];
        const buffer = await encodeGeometry(geometry, {
            maxTriangles: 1,
            concurrency: 2,
            encodeChunk(chunk, quant) {
                seen.push(quant);
                return identityEncode(chunk);
            }
        });
        expect(seen).toHaveLength(2);
        expect(seen[0]).toEqual(seen[1]);
        expect(seen[0]!.position.origin).toEqual([0, 0, 0]);
        expect(seen[0]!.position.range).toBe(1);
        expect(seen[0]!.uv!.origin).toEqual([0, 0]);

        const packed = decodeContainer(buffer);
        expect(packed.header.hasNormal).toBe(true);
        expect(packed.header.hasUv).toBe(true);
        expect(packed.chunks).toHaveLength(2);

        const decoded = await decodeGeometry(buffer, identityDecode);
        expect(decoded.chunks[1]!.uv).toEqual(new Float32Array([0, 0, 1, 1, 0, 1]));
    });
});
