import { describe, expect, it } from "vitest";
import { createDracoChunkEncoder, type DracoEncoderModule } from "@meshquilt/draco";
import type { ChunkGeometry, SharedQuantization } from "@meshquilt/core";

describe("createDracoChunkEncoder", () => {
    it("quantizes position and uv on the shared volume, and normals by bit count", () => {
        const calls: unknown[][] = [];
        const module = createMockModule(calls);
        const encode = createDracoChunkEncoder(module);
        const chunk: ChunkGeometry = {
            position: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
            normal: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
            uv: new Float32Array([0, 0, 1, 0, 0, 1]),
            index: new Uint32Array([0, 1, 2])
        };
        const quant: SharedQuantization = {
            positionBits: 14,
            normalBits: 8,
            uvBits: 10,
            position: { origin: [0, 0, 0], range: 10 },
            uv: { origin: [0, 0], range: 1 }
        };

        const bytes = encode(chunk, quant);

        expect(bytes).toEqual(new Uint8Array([1, 2, 3, 4]));
        expect(calls).toContainEqual(["explicit", module.POSITION, 14, 3, [0, 0, 0], 10]);
        expect(calls).toContainEqual(["explicit", module.TEX_COORD, 10, 2, [0, 0], 1]);
        expect(calls).toContainEqual(["quant", module.NORMAL, 8]);
    });
});

function createMockModule(calls: unknown[][]): DracoEncoderModule {
    return {
        POSITION: 0,
        NORMAL: 1,
        TEX_COORD: 2,
        MESH_EDGEBREAKER_ENCODING: 1,
        Encoder: class {
            SetAttributeExplicitQuantization(...args: unknown[]) {
                calls.push(["explicit", ...args]);
            }
            SetAttributeQuantization(...args: unknown[]) {
                calls.push(["quant", ...args]);
            }
            SetSpeedOptions() {}
            SetEncodingMethod() {}
            EncodeMeshToDracoBuffer() {
                return 4;
            }
        },
        Mesh: class {},
        MeshBuilder: class {
            AddFloatAttributeToMesh() {
                return 0;
            }
            AddFacesToMesh() {}
        },
        DracoInt8Array: class {
            GetValue(index: number) {
                return index + 1;
            }
        },
        destroy() {}
    };
}
