import { MeshQuiltError, type ChunkGeometry, type GeometryInput } from "../types.js";

export function validateGeometry(geometry: GeometryInput): void {
    if (geometry.position.length === 0 || geometry.position.length % 3 !== 0) {
        throw new MeshQuiltError("position must be a non-empty xyz float array");
    }
    if (geometry.index && (geometry.index.length === 0 || geometry.index.length % 3 !== 0)) {
        throw new MeshQuiltError("index must be a non-empty triangle list");
    }
    const vertexCount = geometry.position.length / 3;
    if (!geometry.index && vertexCount % 3 !== 0)
        throw new MeshQuiltError("nonindexed positions must form complete triangles");
    for (let i = 0; i < (geometry.index?.length ?? 0); i++) {
        const vertex = geometry.index![i]!;
        if (vertex < 0 || vertex >= vertexCount) {
            throw new MeshQuiltError(`index ${vertex} is outside 0..${vertexCount - 1}`);
        }
    }
    if (geometry.normal && geometry.normal.length !== geometry.position.length) {
        throw new MeshQuiltError("normal length must match position length");
    }
    if (geometry.uv && geometry.uv.length !== vertexCount * 2) {
        throw new MeshQuiltError("uv length must be twice the vertex count");
    }
    for (const [name, values] of Object.entries({
        position: geometry.position,
        normal: geometry.normal,
        uv: geometry.uv
    })) {
        if (!values) continue;
        for (let i = 0; i < values.length; i++) {
            const value = values[i]!;
            if (!Number.isFinite(value)) throw new MeshQuiltError(`${name} values must be finite`);
        }
    }
}

/**
 * Split indexed or nonindexed triangle geometry into chunks of at most `maxTriangles`.
 * A vertex used by triangles in different chunks is copied into each chunk.
 * A small Uint32-indexed input is returned by reference; other small inputs normalize the index.
 */
export function splitGeometry(geometry: GeometryInput, maxTriangles: number): ChunkGeometry[] {
    return Array.from(iterateGeometry(geometry, maxTriangles));
}

/** Produces one chunk at a time; output indices are Uint32 and small input attributes are shared. */
export function* iterateGeometry(geometry: GeometryInput, maxTriangles: number): Generator<ChunkGeometry> {
    validateGeometry(geometry);
    if (!Number.isInteger(maxTriangles) || maxTriangles < 1) {
        throw new MeshQuiltError("maxTriangles must be an integer >= 1");
    }
    yield* iterateValidatedGeometry(geometry, maxTriangles);
}

/** Internal pipeline entry after validation. Never exported from the package root. */
export function* iterateValidatedGeometry(geometry: GeometryInput, maxTriangles: number): Generator<ChunkGeometry> {
    const indexCount = geometry.index?.length ?? geometry.position.length / 3;
    const triangleCount = indexCount / 3;
    if (triangleCount <= maxTriangles) {
        if (isNormalized(geometry)) yield geometry;
        else
            yield {
                ...geometry,
                index: geometry.index ? new Uint32Array(geometry.index) : sequentialIndex(indexCount)
            };
        return;
    }

    if (!geometry.index) {
        // Triangle soup has no shared vertex IDs to remap. Copy contiguous attributes directly.
        for (let start = 0; start < indexCount; start += maxTriangles * 3) {
            const end = Math.min(start + maxTriangles * 3, indexCount);
            const chunk: ChunkGeometry = {
                position: geometry.position.slice(start * 3, end * 3),
                index: sequentialIndex(end - start)
            };
            if (geometry.normal) chunk.normal = geometry.normal.slice(start * 3, end * 3);
            if (geometry.uv) chunk.uv = geometry.uv.slice(start * 2, end * 2);
            yield chunk;
        }
        return;
    }

    const vertexCount = geometry.position.length / 3;
    // A bounded dense lookup avoids Map entries/GC for locally indexed meshes. Sparse inputs
    // retain the Map path, so this cannot allocate an unbounded source-sized lookup table.
    const dense = vertexCount <= maxTriangles * 6 ? new Uint32Array(vertexCount) : undefined;
    const touched = dense ? new Uint32Array(Math.min(vertexCount, maxTriangles * 3)) : undefined;
    const vertexMap = dense ? undefined : new Map<number, number>();
    const positions = new Float32Array(maxTriangles * 9);
    const indices = new Uint32Array(maxTriangles * 3);
    const normals = geometry.normal ? new Float32Array(maxTriangles * 9) : undefined;
    const uvs = geometry.uv ? new Float32Array(maxTriangles * 6) : undefined;
    let localVertices = 0;
    let localTriangles = 0;

    const flush = () => {
        const chunk: ChunkGeometry = {
            position: positions.slice(0, localVertices * 3),
            index: indices.slice(0, localTriangles * 3)
        };
        if (normals && geometry.normal) chunk.normal = normals.slice(0, localVertices * 3);
        if (uvs && geometry.uv) chunk.uv = uvs.slice(0, localVertices * 2);
        if (dense && touched) {
            for (let i = 0; i < localVertices; i++) dense[touched[i]!] = 0;
        } else vertexMap!.clear();
        localVertices = 0;
        localTriangles = 0;
        return chunk;
    };

    for (let i = 0; i < indexCount; i += 3) {
        for (let corner = 0; corner < 3; corner++) {
            const source: number = geometry.index[i + corner]!;
            let local: number | undefined = dense
                ? dense[source]
                    ? dense[source]! - 1
                    : undefined
                : vertexMap!.get(source);
            if (local === undefined) {
                local = localVertices++;
                if (dense && touched) {
                    dense[source] = local + 1;
                    touched[local] = source;
                } else vertexMap!.set(source, local);
                const src = source * 3;
                const dst = local * 3;
                positions[dst] = geometry.position[src]!;
                positions[dst + 1] = geometry.position[src + 1]!;
                positions[dst + 2] = geometry.position[src + 2]!;
                if (normals && geometry.normal) {
                    normals[dst] = geometry.normal[src]!;
                    normals[dst + 1] = geometry.normal[src + 1]!;
                    normals[dst + 2] = geometry.normal[src + 2]!;
                }
                if (uvs && geometry.uv) {
                    uvs[local * 2] = geometry.uv[source * 2]!;
                    uvs[local * 2 + 1] = geometry.uv[source * 2 + 1]!;
                }
            }
            indices[localTriangles * 3 + corner] = local;
        }
        localTriangles++;
        if (localTriangles >= maxTriangles) yield flush();
    }
    if (localTriangles > 0) yield flush();
}

function sequentialIndex(count: number): Uint32Array {
    const index = new Uint32Array(count);
    for (let i = 0; i < count; i++) index[i] = i;
    return index;
}

function isNormalized(geometry: GeometryInput): geometry is ChunkGeometry {
    return geometry.index instanceof Uint32Array;
}
