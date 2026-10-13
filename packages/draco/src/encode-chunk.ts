import type { ChunkGeometry, SharedQuantization } from "@meshquilt/core";
import { MeshQuiltError } from "@meshquilt/core";
import type { DracoEncoderModule } from "./types.js";

export interface DracoEncodeSettings {
    encodeSpeed?: number;
    decodeSpeed?: number;
}

/**
 * Encode one chunk. POSITION and TEX_COORD use the shared volume so neighboring
 * chunks land on the same grid. NORMAL uses Draco's octahedral grid, which is
 * already global for a given bit count.
 *
 * One module is not re-entrant. Use a worker pool when encoding in parallel.
 */
export function createDracoChunkEncoder(module: DracoEncoderModule, settings: DracoEncodeSettings = {}) {
    const encodeSpeed = settings.encodeSpeed ?? 5;
    const decodeSpeed = settings.decodeSpeed ?? 5;

    return function encodeDracoChunk(chunk: ChunkGeometry, quant: SharedQuantization): Uint8Array {
        const encoder = new module.Encoder();
        const builder = new module.MeshBuilder();
        const mesh = new module.Mesh();
        const encoded = new module.DracoInt8Array();
        try {
            const pointCount = chunk.position.length / 3;
            const faceCount = chunk.index.length / 3;
            addAttribute(builder, mesh, module.POSITION, pointCount, 3, chunk.position, "POSITION");
            if (chunk.normal) {
                addAttribute(builder, mesh, module.NORMAL, pointCount, 3, chunk.normal, "NORMAL");
            }
            if (chunk.uv) {
                addAttribute(builder, mesh, module.TEX_COORD, pointCount, 2, chunk.uv, "TEX_COORD");
            }
            builder.AddFacesToMesh(mesh, faceCount, chunk.index);

            if (quant.positionBits > 0) {
                encoder.SetAttributeExplicitQuantization(
                    module.POSITION,
                    quant.positionBits,
                    3,
                    quant.position.origin,
                    quant.position.range
                );
            }
            if (chunk.normal && quant.normalBits > 0) {
                encoder.SetAttributeQuantization(module.NORMAL, quant.normalBits);
            }
            if (chunk.uv && quant.uvBits > 0) {
                if (!quant.uv) throw new MeshQuiltError("UV quantization volume is missing");
                encoder.SetAttributeExplicitQuantization(
                    module.TEX_COORD,
                    quant.uvBits,
                    2,
                    quant.uv.origin,
                    quant.uv.range
                );
            }

            encoder.SetSpeedOptions(encodeSpeed, decodeSpeed);
            encoder.SetEncodingMethod(module.MESH_EDGEBREAKER_ENCODING);
            const length = encoder.EncodeMeshToDracoBuffer(mesh, encoded);
            if (length <= 0) throw new MeshQuiltError("Draco encoding failed");
            const out = new Uint8Array(length);
            for (let i = 0; i < length; i++) out[i] = encoded.GetValue(i) & 0xff;
            return out;
        } finally {
            module.destroy(encoded);
            module.destroy(mesh);
            module.destroy(builder);
            module.destroy(encoder);
        }
    };
}

function addAttribute(
    builder: { AddFloatAttributeToMesh: DracoEncoderModule["MeshBuilder"]["prototype"]["AddFloatAttributeToMesh"] },
    mesh: unknown,
    attribute: number,
    count: number,
    components: number,
    data: Float32Array,
    name: string
): void {
    if (builder.AddFloatAttributeToMesh(mesh, attribute, count, components, data) === -1) {
        throw new MeshQuiltError(`Draco failed to add ${name}`);
    }
}
