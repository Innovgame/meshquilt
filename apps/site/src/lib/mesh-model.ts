import * as THREE from "three";
import { computeVolume, splitGeometry, validateGeometry } from "meshquilt";
import type { ChunkGeometry, GeometryInput, QuiltHeader } from "meshquilt";
import { triangleCount } from "./mesh-metrics.js";
import { MAX_CHUNKS, MAX_TRIANGLES, MAX_VERTICES } from "./mesh-limits.js";
export class ModelError extends Error {
    constructor(public code: "empty" | "limit" | "unsupported" | "invalid") {
        super(code);
    }
}

export interface MeshModel {
    name: string;
    geometry: ChunkGeometry;
    chunks: ChunkGeometry[];
    header?: QuiltHeader;
    sourceBytes?: number;
    positionRange: number;
}

export function checkModel(geometry: GeometryInput) {
    if (!triangleCount(geometry)) throw new ModelError("empty");
    if (triangleCount(geometry) > MAX_TRIANGLES || geometry.position.length / 3 > MAX_VERTICES)
        throw new ModelError("limit");
    validateGeometry(geometry);
}

export function mergeChunks(chunks: GeometryInput[]): ChunkGeometry {
    if (!chunks.length) throw new ModelError("empty");
    const vertices = chunks.reduce((sum, chunk) => sum + chunk.position.length / 3, 0);
    const indices = chunks.reduce((sum, chunk) => sum + (chunk.index?.length ?? chunk.position.length / 3), 0);
    if (vertices > MAX_VERTICES || indices / 3 > MAX_TRIANGLES) throw new ModelError("limit");
    const result: ChunkGeometry = { position: new Float32Array(vertices * 3), index: new Uint32Array(indices) };
    if (chunks.every((chunk) => chunk.normal)) result.normal = new Float32Array(vertices * 3);
    if (chunks.every((chunk) => chunk.uv)) result.uv = new Float32Array(vertices * 2);
    let vertexOffset = 0;
    let indexOffset = 0;
    for (const chunk of chunks) {
        validateGeometry(chunk);
        result.position.set(chunk.position, vertexOffset * 3);
        if (result.normal && chunk.normal) result.normal.set(chunk.normal, vertexOffset * 3);
        if (result.uv && chunk.uv) result.uv.set(chunk.uv, vertexOffset * 2);
        const count = chunk.index?.length ?? chunk.position.length / 3;
        for (let i = 0; i < count; i++) result.index[indexOffset + i] = vertexOffset + (chunk.index?.[i] ?? i);
        vertexOffset += chunk.position.length / 3;
        indexOffset += count;
    }
    checkModel(result);
    return result;
}

export function geometryFromScene(scene: THREE.Object3D): ChunkGeometry {
    scene.updateMatrixWorld(true);
    const parts: GeometryInput[] = [];
    try {
        scene.traverse((object) => {
            if (!(object instanceof THREE.Mesh)) return;
            if (
                object instanceof THREE.SkinnedMesh ||
                object instanceof THREE.InstancedMesh ||
                Object.keys(object.geometry.morphAttributes).length
            )
                throw new ModelError("unsupported");
            const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
            try {
                const position = geometry.getAttribute("position");
                if (!position || !position.count) return;
                const read = (name: string, size: number) => {
                    const attribute = geometry.getAttribute(name);
                    if (!attribute) return undefined;
                    if (attribute.itemSize !== size || attribute.count !== position.count)
                        throw new ModelError("invalid");
                    const array = new Float32Array(attribute.count * size);
                    for (let i = 0; i < attribute.count; i++) {
                        array[i * size] = attribute.getX(i);
                        array[i * size + 1] = attribute.getY(i);
                        if (size === 3) array[i * size + 2] = attribute.getZ(i);
                    }
                    return array;
                };
                const index = geometry.index ? new Uint32Array(geometry.index.array) : undefined;
                const part: GeometryInput = {
                    position: read("position", 3)!,
                    index,
                    normal: read("normal", 3),
                    uv: read("uv", 2)
                };
                // A mirrored node reverses winding; keep its transformed normals consistent.
                if (object.matrixWorld.determinant() < 0) {
                    part.index ??= Uint32Array.from({ length: position.count }, (_, i) => i);
                    for (let i = 0; i < part.index.length; i += 3) {
                        const second = part.index[i + 1]!;
                        part.index[i + 1] = part.index[i + 2]!;
                        part.index[i + 2] = second;
                    }
                }
                parts.push(part);
            } finally {
                geometry.dispose();
            }
        });
        return mergeChunks(parts);
    } finally {
        scene.traverse((object) => {
            if (!(object instanceof THREE.Mesh)) return;
            object.geometry.dispose();
            for (const material of Array.isArray(object.material) ? object.material : [object.material])
                material.dispose();
        });
    }
}

export function makeModel(
    name: string,
    geometry: ChunkGeometry,
    maxTriangles: number,
    sourceBytes?: number
): MeshModel {
    checkModel(geometry);
    if (Math.ceil(triangleCount(geometry) / maxTriangles) > MAX_CHUNKS) throw new ModelError("limit");
    return {
        name,
        geometry,
        chunks: splitGeometry(geometry, maxTriangles),
        sourceBytes,
        positionRange: computeVolume(geometry.position, 3).range
    };
}

export function demoModel() {
    const source = new THREE.TorusKnotGeometry(1.15, 0.37, 180, 20, 2, 3);
    const mesh = new THREE.Mesh(source);
    return makeModel("torus-knot.mesh", geometryFromScene(mesh), 450);
}

export function modelErrorMessage(error: unknown): string {
    return error instanceof ModelError ? error.code : "invalid";
}
