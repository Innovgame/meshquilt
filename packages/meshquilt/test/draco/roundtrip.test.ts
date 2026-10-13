import { beforeAll, expect, it } from "vitest";
import { createEncoderModule, createDecoderModule } from "draco3d";
import { encodeGeometry, decodeGeometry } from "meshquilt";
import { createDracoChunkEncoder, decodeDracoChunk } from "meshquilt/draco";
import type { DracoEncoderModule, DracoDecoderModule } from "meshquilt/draco";

let encoder: DracoEncoderModule;
let decoder: DracoDecoderModule;
beforeAll(async () => {
    // DefinitelyTyped's 1.4 declarations do not describe the 1.5.7 WASM bindings.
    encoder = (await createEncoderModule({})) as unknown as DracoEncoderModule;
    decoder = (await createDecoderModule({})) as unknown as DracoDecoderModule;
});

const geometry = {
    position: new Float32Array([0.1, 0.2, 0.3, 2.7, 0.2, 0.3, 2.7, 3.4, 0.3, 0.1, 3.4, 0.3]),
    normal: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
    uv: new Float32Array([0.1, 0.2, 0.8, 0.2, 0.8, 0.9, 0.1, 0.9]),
    index: new Uint32Array([0, 1, 2, 0, 2, 3])
};

it.each([0, 8, 14, 30])(
    "round-trips real Draco chunks with coincident seams at %s position bits",
    async (positionBits) => {
        const bytes = await encodeGeometry(geometry, {
            maxTriangles: 1,
            positionBits,
            encodeChunk: createDracoChunkEncoder(encoder)
        });
        const decoded = await decodeGeometry(bytes, (chunk) => decodeDracoChunk(decoder, chunk));
        expect(decoded.chunks).toHaveLength(2);
        const [first, second] = decoded.chunks;
        const points = (array: Float32Array) =>
            Array.from({ length: array.length / 3 }, (_, i) => Array.from(array.subarray(i * 3, i * 3 + 3)).join(","));
        expect(points(first!.position).filter((point) => points(second!.position).includes(point))).toHaveLength(2);
        for (const chunk of decoded.chunks) {
            expect(chunk.index).toHaveLength(3);
            expect(chunk.normal).toHaveLength(9);
            expect(chunk.uv).toHaveLength(6);
            for (const value of chunk.normal!) expect(Number.isFinite(value)).toBe(true);
        }
    }
);

it("rejects corrupt Draco bytes with a useful error", () => {
    expect(() => decodeDracoChunk(decoder, new Uint8Array([1, 2, 3]))).toThrow(/Draco/);
});
