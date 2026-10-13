import { MeshQuiltError, type GeometryInput } from "../types.js";

/** Internal shape checks; no model-sized scans. */
export function validateGeometryShape(geometry: GeometryInput): void {
    if (geometry.position.length === 0 || geometry.position.length % 3 !== 0) {
        throw new MeshQuiltError("position must be a non-empty xyz float array");
    }
    if (geometry.index && (geometry.index.length === 0 || geometry.index.length % 3 !== 0)) {
        throw new MeshQuiltError("index must be a non-empty triangle list");
    }
    const vertexCount = geometry.position.length / 3;
    if (!geometry.index && vertexCount % 3 !== 0)
        throw new MeshQuiltError("nonindexed positions must form complete triangles");
    if (geometry.normal && geometry.normal.length !== geometry.position.length) {
        throw new MeshQuiltError("normal length must match position length");
    }
    if (geometry.uv && geometry.uv.length !== vertexCount * 2) {
        throw new MeshQuiltError("uv length must be twice the vertex count");
    }
}

/** Internal index scan, shared by public validation and encoder preparation. */
export function validateIndices(geometry: GeometryInput): void {
    const indices = geometry.index;
    if (!indices) return;
    const vertexCount = geometry.position.length / 3;
    for (let i = 0; i < indices.length; i++) {
        const vertex = indices[i]!;
        if (vertex < 0 || vertex >= vertexCount) {
            throw new MeshQuiltError(`index ${vertex} is outside 0..${vertexCount - 1}`);
        }
    }
}

export function validateFiniteAttribute(name: string, values: Float32Array): void {
    for (let i = 0; i < values.length; i++) {
        if (!Number.isFinite(values[i])) throw new MeshQuiltError(`${name} values must be finite`);
    }
}

export function validateGeometry(geometry: GeometryInput): void {
    validateGeometryShape(geometry);
    validateIndices(geometry);
    validateFiniteAttribute("position", geometry.position);
    if (geometry.normal) validateFiniteAttribute("normal", geometry.normal);
    if (geometry.uv) validateFiniteAttribute("uv", geometry.uv);
}
