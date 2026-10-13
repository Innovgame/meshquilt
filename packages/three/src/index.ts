import {
    BufferAttribute,
    BufferGeometry,
    Group,
    Mesh,
    type BufferAttribute as BufferAttributeType,
    type InterleavedBufferAttribute,
    type Material
} from "three";
import {
    decodeGeometry,
    encodeGeometry,
    MeshQuiltError,
    type ChunkDecoder,
    type ChunkEncoder,
    type ChunkGeometry,
    type GeometryBuffers,
    type QuantVolume
} from "@meshquilt/core";

type FloatAttribute = BufferAttributeType | InterleavedBufferAttribute;

export interface EncodeMeshOptions {
    maxTriangles?: number;
    positionBits?: number;
    normalBits?: number;
    uvBits?: number;
    positionVolume?: QuantVolume;
    uvVolume?: QuantVolume;
    concurrency?: number;
    encodeChunk: ChunkEncoder;
}

export function meshToGeometry(mesh: Mesh): GeometryBuffers {
    const positionAttr = mesh.geometry.getAttribute("position");
    if (!positionAttr) throw new MeshQuiltError("mesh has no position attribute");
    if (positionAttr.itemSize !== 3) throw new MeshQuiltError("position itemSize must be 3");

    const geometry: GeometryBuffers = {
        position: readFloatAttribute(positionAttr, 3),
        index: readIndex(mesh.geometry, positionAttr.count)
    };
    const normalAttr = mesh.geometry.getAttribute("normal");
    if (normalAttr) {
        if (normalAttr.itemSize !== 3) throw new MeshQuiltError("normal itemSize must be 3");
        geometry.normal = readFloatAttribute(normalAttr, 3);
    }
    const uvAttr = mesh.geometry.getAttribute("uv");
    if (uvAttr) {
        if (uvAttr.itemSize !== 2) throw new MeshQuiltError("uv itemSize must be 2");
        geometry.uv = readFloatAttribute(uvAttr, 2);
    }
    return geometry;
}

export function chunkToGeometry(chunk: ChunkGeometry): BufferGeometry {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(chunk.position, 3));
    geometry.setIndex(new BufferAttribute(chunk.index, 1));
    if (chunk.normal) geometry.setAttribute("normal", new BufferAttribute(chunk.normal, 3));
    if (chunk.uv) geometry.setAttribute("uv", new BufferAttribute(chunk.uv, 2));
    return geometry;
}

/** Draw chunks as siblings. Do not merge them back into one buffer. */
export function chunksToGroup(chunks: ChunkGeometry[], source: Mesh): Group {
    const material = singleMaterial(source);
    const group = new Group();
    group.name = source.name;
    group.position.copy(source.position);
    group.quaternion.copy(source.quaternion);
    group.scale.copy(source.scale);
    for (const chunk of chunks) group.add(new Mesh(chunkToGeometry(chunk), material));
    return group;
}

export function encodeMesh(mesh: Mesh, options: EncodeMeshOptions): Promise<Uint8Array> {
    return encodeGeometry(meshToGeometry(mesh), options);
}

export async function decodeMesh(
    buffer: Uint8Array,
    decodeChunk: ChunkDecoder,
    source: Mesh,
    concurrency = 1
): Promise<Group> {
    const decoded = await decodeGeometry(buffer, decodeChunk, concurrency);
    return chunksToGroup(decoded.chunks, source);
}

function singleMaterial(source: Mesh): Material {
    if (Array.isArray(source.material)) {
        throw new MeshQuiltError("split multi-material meshes into one mesh per material before encoding");
    }
    return source.material;
}

function readIndex(geometry: BufferGeometry, vertexCount: number): Uint32Array {
    const index = geometry.getIndex();
    if (!index) {
        if (vertexCount % 3 !== 0) throw new MeshQuiltError("non-indexed position count must be divisible by 3");
        const generated = new Uint32Array(vertexCount);
        for (let i = 0; i < vertexCount; i++) generated[i] = i;
        return generated;
    }
    const out = new Uint32Array(index.count);
    for (let i = 0; i < index.count; i++) out[i] = index.getX(i);
    return out;
}

function readFloatAttribute(attribute: FloatAttribute, itemSize: number): Float32Array {
    const out = new Float32Array(attribute.count * itemSize);
    for (let i = 0; i < attribute.count; i++) {
        for (let component = 0; component < itemSize; component++) {
            out[i * itemSize + component] = attribute.getComponent(i, component);
        }
    }
    return out;
}
