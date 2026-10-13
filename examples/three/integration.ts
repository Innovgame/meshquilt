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
    type EncodeGeometryOptions,
    type DecodeGeometryOptions,
    type ChunkGeometry,
    type GeometryBuffers,
    validateGeometry
} from "meshquilt";

type FloatAttribute = BufferAttributeType | InterleavedBufferAttribute;

export interface EncodeMeshOptions extends EncodeGeometryOptions {
    encodeChunk: EncodeGeometryOptions["encodeChunk"];
}

export function meshToGeometry(mesh: Mesh): GeometryBuffers {
    assertSupportedMesh(mesh);
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
    validateGeometry(geometry);
    return geometry;
}

export function chunkToGeometry(chunk: ChunkGeometry): BufferGeometry {
    validateGeometry(chunk);
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
    group.matrixAutoUpdate = source.matrixAutoUpdate;
    if (!source.matrixAutoUpdate) group.matrix.copy(source.matrix);
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
    concurrency = 1,
    options: DecodeGeometryOptions = {}
): Promise<Group> {
    singleMaterial(source);
    const decoded = await decodeGeometry(buffer, decodeChunk, concurrency, options);
    return chunksToGroup(decoded.chunks, source);
}

function singleMaterial(source: Mesh): Material {
    if (Array.isArray(source.material)) {
        throw new MeshQuiltError("split multi-material meshes into one mesh per material before encoding");
    }
    return source.material;
}

function assertSupportedMesh(mesh: Mesh): void {
    singleMaterial(mesh);
    if (("isSkinnedMesh" in mesh && mesh.isSkinnedMesh) || ("isInstancedMesh" in mesh && mesh.isInstancedMesh)) {
        throw new MeshQuiltError("skinned and instanced meshes must be baked into a static mesh before encoding");
    }
    if (Object.values(mesh.geometry.morphAttributes).some((attributes) => attributes && attributes.length > 0)) {
        throw new MeshQuiltError("morph attributes must be baked into a static mesh before encoding");
    }
    const total = mesh.geometry.index?.count ?? mesh.geometry.getAttribute("position")?.count ?? 0;
    const { start, count } = mesh.geometry.drawRange;
    if (start !== 0 || count < total || Number.isNaN(count)) {
        throw new MeshQuiltError("partial drawRange must be extracted into a separate geometry before encoding");
    }
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
        out[i * itemSize] = attribute.getX(i);
        out[i * itemSize + 1] = attribute.getY(i);
        if (itemSize === 3) out[i * itemSize + 2] = attribute.getZ(i);
    }
    return out;
}
