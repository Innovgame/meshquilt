import { expect, it } from "vitest";
import { mergeChunks } from "../src/lib/mesh-model.js";
import { createDisplayPieces } from "../src/lib/mesh-display.js";
import type { ChunkGeometry } from "meshquilt";

// The same positions have different normals/UVs at this intentional hard edge.
const chunks: ChunkGeometry[] = [
    {
        position: new Float32Array([0, 0, 0, 2, 0, 0, 0, 2, 0]),
        normal: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
        uv: new Float32Array([0, 0, 1, 0, 0, 1]),
        index: new Uint32Array([0, 1, 2])
    },
    {
        position: new Float32Array([0, 0, 0, 2, 0, 0, 0, 0, 2]),
        normal: new Float32Array([0, -1, 0, 0, -1, 0, 0, -1, 0]),
        uv: new Float32Array([0.25, 0.25, 0.75, 0.25, 0.25, 0.75]),
        index: new Uint32Array([0, 1, 2])
    }
];

it("whole display preserves separate seam vertices, normals and UVs in one mesh", () => {
    const merged = mergeChunks(chunks);
    const pieces = createDisplayPieces({ geometry: merged, chunks }, "whole");
    try {
        expect(pieces).toHaveLength(1);
        const geometry = pieces[0]!.mesh.geometry;
        expect(geometry.getAttribute("position").count).toBe(6);
        expect(Array.from(geometry.index!.array)).toEqual([0, 1, 2, 3, 4, 5]);
        expect(Array.from(geometry.getAttribute("normal").array)).toEqual([
            0, 0, 1, 0, 0, 1, 0, 0, 1, 0, -1, 0, 0, -1, 0, 0, -1, 0
        ]);
        expect(Array.from(geometry.getAttribute("uv").array)).toEqual([
            0, 0, 1, 0, 0, 1, 0.25, 0.25, 0.75, 0.25, 0.25, 0.75
        ]);
        expect(Array.from(merged.position)).toEqual([0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2]);
        expect(geometry.getAttribute("position").array).not.toBe(merged.position);
        expect(geometry.getAttribute("normal").array).not.toBe(merged.normal);
        expect(geometry.getAttribute("uv").array).not.toBe(merged.uv);
    } finally {
        for (const piece of pieces) {
            piece.mesh.geometry.dispose();
            piece.material.dispose();
        }
    }
});

it("chunk display preserves source attributes and gives chunks independent colors", () => {
    const pieces = createDisplayPieces({ geometry: mergeChunks(chunks), chunks }, "chunks");
    try {
        expect(pieces).toHaveLength(2);
        expect(pieces[0]!.material.color.equals(pieces[1]!.material.color)).toBe(false);
        expect(Array.from(pieces[1]!.mesh.geometry.getAttribute("uv").array)).toEqual([
            0.25, 0.25, 0.75, 0.25, 0.25, 0.75
        ]);
        expect(Array.from(pieces[1]!.mesh.geometry.getAttribute("normal").array)).toEqual([
            0, -1, 0, 0, -1, 0, 0, -1, 0
        ]);
    } finally {
        for (const piece of pieces) {
            piece.mesh.geometry.dispose();
            piece.material.dispose();
        }
    }
});

it("missing normals are generated only for display without modifying export buffers", () => {
    const input: ChunkGeometry = {
        position: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
        index: new Uint32Array([0, 1, 2])
    };
    const pieces = createDisplayPieces({ geometry: input, chunks: [input] }, "whole");
    try {
        expect(Array.from(pieces[0]!.mesh.geometry.getAttribute("normal").array)).toEqual([0, 0, 1, 0, 0, 1, 0, 0, 1]);
        expect(input.normal).toBeUndefined();
        expect(input.uv).toBeUndefined();
    } finally {
        for (const piece of pieces) {
            piece.mesh.geometry.dispose();
            piece.material.dispose();
        }
    }
});
