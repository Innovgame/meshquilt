import { describe, expect, it } from "vitest";
import { MeshQuiltError, splitGeometry } from "meshquilt";

const quad = {
    position: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]),
    normal: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
    uv: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
    index: new Uint32Array([0, 1, 2, 0, 2, 3])
};

describe("splitGeometry", () => {
    it("keeps a small mesh in one chunk", () => {
        const chunks = splitGeometry(quad, 8);
        expect(chunks).toHaveLength(1);
        expect(chunks[0]).toBe(quad);
    });

    it("copies the shared edge into both chunks with its normal and uv", () => {
        const chunks = splitGeometry(quad, 1);
        expect(chunks).toHaveLength(2);
        expect(chunks[0]!.index).toEqual(new Uint32Array([0, 1, 2]));
        expect(chunks[1]!.index).toEqual(new Uint32Array([0, 1, 2]));
        expect(Array.from(chunks[0]!.position)).toEqual([0, 0, 0, 1, 0, 0, 1, 1, 0]);
        expect(Array.from(chunks[1]!.position)).toEqual([0, 0, 0, 1, 1, 0, 0, 1, 0]);
        expect(Array.from(chunks[1]!.normal!)).toEqual([0, 0, 1, 0, 0, 1, 0, 0, 1]);
        expect(Array.from(chunks[1]!.uv!)).toEqual([0, 0, 1, 1, 0, 1]);
    });

    it("rejects a broken index", () => {
        expect(() => splitGeometry({ position: quad.position, index: new Uint32Array([0, 1]) }, 1)).toThrow(
            MeshQuiltError
        );
    });
});
