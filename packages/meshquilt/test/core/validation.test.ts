import { expect, it } from "vitest";
import { encodeGeometry, decodeContainer, encodeContainer, validateGeometry, computeVolume } from "meshquilt";
import type { GeometryBuffers } from "meshquilt";

const geometry: GeometryBuffers = {
    position: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    normal: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
    uv: new Float32Array([0, 0, 1, 0, 0, 1]),
    index: new Uint32Array([0, 1, 2])
};
const encodeChunk = () => new Uint8Array([1, 2]);

it.each(["position", "normal", "uv"] as const)("rejects non-finite %s before encoding", async (attribute) => {
    const invalid = { ...geometry, [attribute]: new Float32Array(geometry[attribute]!) };
    invalid[attribute]![0] = NaN;
    expect(() => validateGeometry(invalid)).toThrow(/finite/);
    await expect(encodeGeometry(invalid, { encodeChunk })).rejects.toThrow(/finite/);
});

it.each([0, -1, Infinity, NaN, 1e40, 1e-50])("rejects invalid explicit range %s", async (range) => {
    await expect(
        encodeGeometry(geometry, { positionVolume: { origin: [0, 0, 0], range }, encodeChunk })
    ).rejects.toThrow();
});

it("rejects incomplete origins and non-integer strides", async () => {
    await expect(
        encodeGeometry(geometry, { positionVolume: { origin: [0], range: 1 }, encodeChunk })
    ).rejects.toThrow();
    expect(() => computeVolume(new Float32Array(), 1.5)).toThrow();
});

it("rejects sparse origins instead of silently writing zero coordinates", async () => {
    await expect(
        encodeGeometry(geometry, { positionVolume: { origin: new Array<number>(3), range: 1 }, encodeChunk })
    ).rejects.toThrow();
});

it("gives the encoder exactly the volume that the container stores", async () => {
    let seen;
    const buffer = await encodeGeometry(geometry, {
        positionVolume: { origin: [0.1, 0.2, 0.3], range: 1.1 },
        encodeChunk(_chunk, quant) {
            seen = quant;
            return encodeChunk();
        }
    });
    expect(seen).toEqual(decodeContainer(buffer).header.quantization);
});

it.each(["bits", "range", "flags", "reserved", "trailing"])("rejects a corrupt container %s", async (field) => {
    const original = await encodeGeometry(geometry, { encodeChunk });
    const buffer = new Uint8Array(original.length + (field === "trailing" ? 1 : 0));
    buffer.set(original);
    const view = new DataView(buffer.buffer);
    if (field === "bits") buffer[12] = 255;
    if (field === "range") view.setFloat32(28, NaN, true);
    if (field === "flags") view.setUint16(6, 128, true);
    if (field === "reserved") buffer[15] = 1;
    expect(() => decodeContainer(buffer)).toThrow();
});

it("rejects a UV header without a UV volume", async () => {
    const buffer = await encodeGeometry(geometry, { encodeChunk });
    const packed = decodeContainer(buffer);
    delete packed.header.quantization.uv;
    expect(() => encodeContainer(packed.header, packed.chunks)).toThrow();
});

it("offers an explicit zero-copy decode without changing default ownership", async () => {
    const buffer = await encodeGeometry(geometry, { encodeChunk });
    expect(decodeContainer(buffer).chunks[0]!.buffer).not.toBe(buffer.buffer);
    const packed = decodeContainer(buffer, { copyChunks: false });
    expect(packed.chunks[0]!.buffer).toBe(buffer.buffer);
    expect(packed.chunks[0]).toEqual(new Uint8Array([1, 2]));
});
