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
        for (const value of values) {
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
    const indexCount = geometry.index?.length ?? geometry.position.length / 3;
    const triangleCount = indexCount / 3;
    if (triangleCount <= maxTriangles) {
        if (isNormalized(geometry)) yield geometry;
        else
            yield {
                ...geometry,
                index: geometry.index
                    ? new Uint32Array(geometry.index)
                    : Uint32Array.from({ length: indexCount }, (_, index) => index)
            };
        return;
    }

    const vertexMap = new Map<number, number>();
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
        vertexMap.clear();
        localVertices = 0;
        localTriangles = 0;
        return chunk;
    };

    for (let i = 0; i < indexCount; i += 3) {
        for (let corner = 0; corner < 3; corner++) {
            const source = geometry.index?.[i + corner] ?? i + corner;
            let local = vertexMap.get(source);
            if (local === undefined) {
                local = localVertices++;
                vertexMap.set(source, local);
                positions.set(geometry.position.subarray(source * 3, source * 3 + 3), local * 3);
                if (normals && geometry.normal) {
                    normals.set(geometry.normal.subarray(source * 3, source * 3 + 3), local * 3);
                }
                if (uvs && geometry.uv) {
                    uvs.set(geometry.uv.subarray(source * 2, source * 2 + 2), local * 2);
                }
            }
            indices[localTriangles * 3 + corner] = local;
        }
        localTriangles++;
        if (localTriangles >= maxTriangles) yield flush();
    }
    if (localTriangles > 0) yield flush();
}

function isNormalized(geometry: GeometryInput): geometry is ChunkGeometry {
    return geometry.index instanceof Uint32Array;
}
