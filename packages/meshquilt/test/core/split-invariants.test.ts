import { expect, it } from "vitest";
import { splitGeometry } from "meshquilt";
import type { GeometryInput } from "meshquilt";

it.each([12, 1000])("preserves triangle order and every attribute for %s source vertices", (vertices) => {
    const position = Float32Array.from({ length: vertices * 3 }, (_, i) => i / 7);
    const normal = Float32Array.from(position, (value) => value / 10);
    const uv = Float32Array.from({ length: vertices * 2 }, (_, i) => i / 13);
    const index = Uint32Array.from({ length: 150 }, (_, i) => (i * 17 + (i % 7)) % vertices);
    const source: GeometryInput = { position, normal, uv, index };
    for (const budget of [1, 3, 17, 100]) {
        const chunks = splitGeometry(source, budget);
        const restored = { position: [] as number[], normal: [] as number[], uv: [] as number[] };
        for (const chunk of chunks) {
            expect(chunk.index.length / 3).toBeLessThanOrEqual(budget);
            for (const local of chunk.index) {
                restored.position.push(...chunk.position.slice(local * 3, local * 3 + 3));
                restored.normal.push(...chunk.normal!.slice(local * 3, local * 3 + 3));
                restored.uv.push(...chunk.uv!.slice(local * 2, local * 2 + 2));
            }
        }
        expect(restored.position).toEqual(
            Array.from(index).flatMap((vertex) => Array.from(position.slice(vertex * 3, vertex * 3 + 3)))
        );
        expect(restored.normal).toEqual(
            Array.from(index).flatMap((vertex) => Array.from(normal.slice(vertex * 3, vertex * 3 + 3)))
        );
        expect(restored.uv).toEqual(
            Array.from(index).flatMap((vertex) => Array.from(uv.slice(vertex * 2, vertex * 2 + 2)))
        );
    }
});
