import type { GeometryBuffers, GeometryInput } from "meshquilt";

export interface IndexedFixture extends GeometryBuffers {
    normal: Float32Array;
    uv: Float32Array;
}

export function grid(cells: number): IndexedFixture {
    const side = cells + 1;
    const count = side * side;
    const position = new Float32Array(count * 3);
    const normal = new Float32Array(count * 3);
    const uv = new Float32Array(count * 2);
    for (let y = 0; y <= cells; y++) {
        for (let x = 0; x <= cells; x++) {
            const vertex = y * side + x;
            const u = x / cells;
            const v = y / cells;
            position[vertex * 3] = u * 100;
            position[vertex * 3 + 1] = Math.sin(u * 8) * Math.cos(v * 6) * 4;
            position[vertex * 3 + 2] = v * 100;
            const nx = -0.32 * Math.cos(u * 8) * Math.cos(v * 6);
            const nz = 0.24 * Math.sin(u * 8) * Math.sin(v * 6);
            const length = Math.hypot(nx, 1, nz);
            normal.set([nx / length, 1 / length, nz / length], vertex * 3);
            uv.set([u, v], vertex * 2);
        }
    }
    const index = new Uint32Array(cells * cells * 6);
    let cursor = 0;
    for (let y = 0; y < cells; y++) {
        for (let x = 0; x < cells; x++) {
            const a = y * side + x;
            index[cursor++] = a;
            index[cursor++] = a + side;
            index[cursor++] = a + 1;
            index[cursor++] = a + 1;
            index[cursor++] = a + side;
            index[cursor++] = a + side + 1;
        }
    }
    return { position, normal, uv, index };
}

export function triangleSoup(input: IndexedFixture): GeometryInput {
    const position = new Float32Array(input.index.length * 3);
    const normal = new Float32Array(position.length);
    const uv = new Float32Array(input.index.length * 2);
    for (let i = 0; i < input.index.length; i++) {
        const source = input.index[i];
        for (let component = 0; component < 3; component++) {
            position[i * 3 + component] = input.position[source * 3 + component];
            normal[i * 3 + component] = input.normal[source * 3 + component];
        }
        uv[i * 2] = input.uv[source * 2];
        uv[i * 2 + 1] = input.uv[source * 2 + 1];
    }
    return { position, normal, uv };
}

export function bytesOf(geometry: GeometryInput): number {
    return Object.values(geometry).reduce((sum, attribute) => sum + (attribute?.byteLength ?? 0), 0);
}

export function median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)]!;
}
