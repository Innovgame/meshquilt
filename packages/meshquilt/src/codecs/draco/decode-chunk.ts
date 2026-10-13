import { MeshQuiltError, type ChunkGeometry } from "../../types.js";
import type { DracoDecoder, DracoDecoderModule, DracoFloat32Array, DracoMesh } from "./types.js";

export function decodeDracoChunk(module: DracoDecoderModule, bytes: Uint8Array): ChunkGeometry {
    const decoder = new module.Decoder();
    const buffer = new module.DecoderBuffer();
    const mesh = new module.Mesh();
    try {
        buffer.Init(bytes, bytes.byteLength);
        if (decoder.GetEncodedGeometryType(buffer) !== module.TRIANGULAR_MESH) {
            throw new MeshQuiltError("Draco data is not a triangular mesh");
        }
        const status = decoder.DecodeBufferToMesh(buffer, mesh);
        if (!status.ok()) throw new MeshQuiltError(`Draco decoding failed: ${status.error_msg()}`);

        const position = readAttribute(module, decoder, mesh, module.POSITION, 3, "POSITION");
        const chunk: ChunkGeometry = {
            position,
            index: readFaces(module, decoder, mesh)
        };
        const normalId = decoder.GetAttributeId(mesh, module.NORMAL);
        if (normalId !== -1) chunk.normal = readAttribute(module, decoder, mesh, module.NORMAL, 3, "NORMAL");
        const uvId = decoder.GetAttributeId(mesh, module.TEX_COORD);
        if (uvId !== -1) chunk.uv = readAttribute(module, decoder, mesh, module.TEX_COORD, 2, "TEX_COORD");
        return chunk;
    } finally {
        module.destroy(mesh);
        module.destroy(buffer);
        module.destroy(decoder);
    }
}

function readAttribute(
    module: DracoDecoderModule,
    decoder: DracoDecoder,
    mesh: DracoMesh,
    attributeType: number,
    components: number,
    name: string
): Float32Array {
    const attributeId = decoder.GetAttributeId(mesh, attributeType);
    if (attributeId === -1) throw new MeshQuiltError(`Draco mesh has no ${name}`);
    const attribute = decoder.GetAttribute(mesh, attributeId);
    const length = mesh.num_points() * components;
    if (
        module._malloc &&
        module._free &&
        module.HEAPU8 &&
        module.DT_FLOAT32 !== undefined &&
        decoder.GetAttributeDataArrayForAllPoints
    ) {
        const byteLength = length * Float32Array.BYTES_PER_ELEMENT;
        const pointer = module._malloc(byteLength);
        if (!pointer && byteLength > 0) throw new MeshQuiltError("Draco attribute allocation failed");
        try {
            if (
                decoder.GetAttributeDataArrayForAllPoints(mesh, attribute, module.DT_FLOAT32, byteLength, pointer) ===
                false
            ) {
                throw new MeshQuiltError(`Draco failed to read ${name}`);
            }
            // Read the refreshed heap after a call that can grow WASM memory, then copy out.
            return new Float32Array(module.HEAPU8.buffer, pointer, length).slice();
        } finally {
            module._free(pointer);
        }
    }
    const values = new module.DracoFloat32Array();
    try {
        if (!decoder.GetAttributeFloatForAllPoints(mesh, attribute, values)) {
            throw new MeshQuiltError(`Draco failed to read ${name}`);
        }
        return copyFloats(values, length);
    } finally {
        module.destroy(values);
    }
}

function readFaces(module: DracoDecoderModule, decoder: DracoDecoder, mesh: DracoMesh): Uint32Array {
    if (module._malloc && module._free && module.HEAPU8 && decoder.GetTrianglesUInt32Array) {
        const length = mesh.num_faces() * 3;
        const byteLength = length * Uint32Array.BYTES_PER_ELEMENT;
        const pointer = module._malloc(byteLength);
        if (!pointer && byteLength > 0) throw new MeshQuiltError("Draco index allocation failed");
        try {
            if (decoder.GetTrianglesUInt32Array(mesh, byteLength, pointer) === false)
                throw new MeshQuiltError("Draco failed to read triangle indices");
            return new Uint32Array(module.HEAPU8.buffer, pointer, length).slice();
        } finally {
            module._free(pointer);
        }
    }
    const faces = new module.DracoInt32Array();
    try {
        const index = new Uint32Array(mesh.num_faces() * 3);
        for (let face = 0; face < mesh.num_faces(); face++) {
            decoder.GetFaceFromMesh(mesh, face, faces);
            index[face * 3] = faces.GetValue(0);
            index[face * 3 + 1] = faces.GetValue(1);
            index[face * 3 + 2] = faces.GetValue(2);
        }
        return index;
    } finally {
        module.destroy(faces);
    }
}

function copyFloats(values: DracoFloat32Array, length: number): Float32Array {
    const out = new Float32Array(length);
    for (let i = 0; i < length; i++) out[i] = values.GetValue(i);
    return out;
}
