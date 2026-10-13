import * as THREE from "three";
import type { MeshModel } from "./mesh-model.js";

export type MeshDisplayMode = "chunks" | "whole";
const colors = ["#8daedb", "#b3c9e6", "#ecaa88", "#6fae9c", "#5079b1", "#e5c5a9", "#93b8af", "#7a9bcc"];

/** Build GPU copies only; seam vertices, normals and UVs remain independent. */
export function createDisplayPieces(model: Pick<MeshModel, "geometry" | "chunks">, mode: MeshDisplayMode) {
    const bounds = new THREE.Box3().setFromBufferAttribute(new THREE.BufferAttribute(model.geometry.position, 3));
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const scale = 3.1 / (Math.max(size.x, size.y, size.z) || 1);
    return (mode === "whole" ? [model.geometry] : model.chunks).map((chunk, index) => {
        const geometry = new THREE.BufferGeometry();
        const positions = chunk.position.slice();
        for (let i = 0; i < positions.length; i += 3) {
            positions[i] = (positions[i]! - center.x) * scale;
            positions[i + 1] = (positions[i + 1]! - center.y) * scale;
            positions[i + 2] = (positions[i + 2]! - center.z) * scale;
        }
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geometry.setIndex(new THREE.BufferAttribute(chunk.index.slice(), 1));
        if (chunk.normal) geometry.setAttribute("normal", new THREE.BufferAttribute(chunk.normal.slice(), 3));
        else geometry.computeVertexNormals();
        if (chunk.uv) geometry.setAttribute("uv", new THREE.BufferAttribute(chunk.uv.slice(), 2));
        geometry.computeBoundingBox();
        const direction = geometry.boundingBox!.getCenter(new THREE.Vector3()).normalize();
        const material = new THREE.MeshStandardMaterial({
            color: colors[index % colors.length],
            roughness: 0.48,
            metalness: 0.05,
            side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(geometry, material);
        return { mesh, direction, material };
    });
}
