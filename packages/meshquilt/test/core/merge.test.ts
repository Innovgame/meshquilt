import { describe, expect, it } from "vitest";
import { mergeGeometry, MeshQuiltError, splitGeometry } from "meshquilt";
import type { GeometryInput } from "meshquilt";

const triangle: GeometryInput = {
    position: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    index: new Uint16Array([0, 1, 2]),
    normal: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
    uv: new Float32Array([0, 0, 1, 0, 0, 1])
};

describe("mergeGeometry", () => {
    it("preserves coincident hard-edge/UV seam vertices and all their attributes", () => {
        const second: GeometryInput = {
            position: new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1]),
            index: new Uint32Array([0, 1, 2]),
            normal: new Float32Array([0, -1, 0, 0, -1, 0, 0, -1, 0]),
            uv: new Float32Array([0.25, 0.25, 0.75, 0.25, 0.25, 0.75])
        };
        const merged = mergeGeometry([triangle, second]);
        expect(Array.from(merged.position)).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
        expect(Array.from(merged.index)).toEqual([0, 1, 2, 3, 4, 5]);
        expect(Array.from(merged.normal!)).toEqual([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, -1, 0, 0, -1, 0, 0, -1, 0]);
        expect(Array.from(merged.uv!)).toEqual([0, 0, 1, 0, 0, 1, 0.25, 0.25, 0.75, 0.25, 0.25, 0.75]);
    });

    it("offsets by full vertex count for mixed Uint16, triangle soup and Uint32 inputs", () => {
        const inputs: readonly GeometryInput[] = [
            { position: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 9, 9, 9]), index: new Uint16Array([0, 2, 1]) },
            { position: new Float32Array([2, 0, 0, 3, 0, 0, 2, 1, 0]) },
            { position: new Float32Array([4, 0, 0, 5, 0, 0, 4, 1, 0]), index: new Uint32Array([1, 2, 0]) }
        ];
        const merged = mergeGeometry(inputs);
        expect(merged.index).toBeInstanceOf(Uint32Array);
        expect(Array.from(merged.index)).toEqual([0, 2, 1, 4, 5, 6, 8, 9, 7]);
        expect(Array.from(merged.position)).toEqual([
            0, 0, 0, 1, 0, 0, 0, 1, 0, 9, 9, 9, 2, 0, 0, 3, 0, 0, 2, 1, 0, 4, 0, 0, 5, 0, 0, 4, 1, 0
        ]);
        expect(merged.normal).toBeUndefined();
        expect(merged.uv).toBeUndefined();
        expect(inputs[1]!.index).toBeUndefined();
    });

    it("always returns independent buffers, including a single normalized input", () => {
        const input = { ...triangle, index: new Uint32Array([0, 1, 2]) };
        const merged = mergeGeometry([input]);
        merged.position[0] = 99;
        merged.index[0] = 2;
        merged.normal![0] = 1;
        merged.uv![0] = 0.5;
        expect(input.position[0]).toBe(0);
        expect(input.index[0]).toBe(0);
        expect(input.normal![0]).toBe(0);
        expect(input.uv![0]).toBe(0);
        expect(merged.position.buffer).not.toBe(input.position.buffer);
        expect(merged.index.buffer).not.toBe(input.index.buffer);
        expect(merged.normal!.buffer).not.toBe(input.normal!.buffer);
        expect(merged.uv!.buffer).not.toBe(input.uv!.buffer);
    });

    it("keeps offsets beyond Uint16 range without wrapping", () => {
        const merged = mergeGeometry([
            { position: new Float32Array(65538 * 3), index: new Uint16Array([0, 1, 2]) },
            { position: triangle.position, index: new Uint16Array([0, 1, 2]) }
        ]);
        expect(Array.from(merged.index)).toEqual([0, 1, 2, 65538, 65539, 65540]);
    });

    it.each(["normal", "uv"] as const)("rejects mixed %s presence in either input order", (attribute) => {
        const incomplete = { ...triangle, [attribute]: undefined };
        for (const inputs of [
            [triangle, incomplete],
            [incomplete, triangle]
        ]) {
            expect(() => mergeGeometry(inputs)).toThrow(MeshQuiltError);
            expect(() => mergeGeometry(inputs)).toThrow(new RegExp(attribute));
        }
    });

    it("validates each input's local indices before applying offsets", () => {
        expect(() => mergeGeometry([{ ...triangle, index: new Uint32Array([0, 1, 3]) }, triangle])).toThrow(/index/);
    });

    it.each([
        { ...triangle, position: new Float32Array([NaN, 0, 0, 1, 0, 0, 0, 1, 0]) },
        { ...triangle, normal: new Float32Array([Infinity, 0, 1, 0, 0, 1, 0, 0, 1]) },
        { ...triangle, uv: new Float32Array([0, 0, NaN, 0, 0, 1]) },
        { ...triangle, uv: new Float32Array(4) },
        { position: new Float32Array(6) },
        { position: new Float32Array(0) }
    ])("rejects invalid geometry without returning a partial merge (%#)", (input) => {
        expect(() => mergeGeometry([triangle, input])).toThrow(MeshQuiltError);
    });

    it("rejects an empty list", () => {
        expect(() => mergeGeometry([])).toThrow(MeshQuiltError);
    });

    it("combines split chunks without changing face order or welding the shared edge", () => {
        const quad: GeometryInput = {
            position: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]),
            index: new Uint32Array([0, 1, 2, 0, 2, 3])
        };
        const merged = mergeGeometry(splitGeometry(quad, 1));
        expect(Array.from(merged.position)).toEqual([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0]);
        expect(Array.from(merged.index)).toEqual([0, 1, 2, 3, 4, 5]);
    });
});
