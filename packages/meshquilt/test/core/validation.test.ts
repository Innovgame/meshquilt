import { expect, it, vi } from "vitest";
import { encodeGeometry, decodeContainer, encodeContainer, validateGeometry, computeVolume } from "meshquilt";
import type { GeometryBuffers } from "meshquilt";

const geometry: GeometryBuffers = {
    position: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    normal: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
    uv: new Float32Array([0, 0, 1, 0, 0, 1]),
    index: new Uint32Array([0, 1, 2])
};
const encodeChunk = () => new Uint8Array([1, 2]);

it.each([false, true])("reads each attribute once during preprocessing (explicit volumes: %s)", async (explicit) => {
    // Observe actual element reads rather than timing or private validator calls.
    // This normalized one-chunk fixture needs no attribute copying in the splitter.
    const observed = [geometry.position, geometry.normal!, geometry.uv!].map((values) => {
        let reads = 0;
        return {
            values: new Proxy(values, {
                get(target, key) {
                    if (typeof key === "string" && /^\d+$/.test(key)) reads++;
                    return Reflect.get(target, key, target);
                }
            }),
            reads: () => reads
        };
    });
    await encodeGeometry(
        {
            position: observed[0]!.values,
            normal: observed[1]!.values,
            uv: observed[2]!.values,
            index: geometry.index
        },
        {
            ...(explicit
                ? { positionVolume: { origin: [0, 0, 0], range: 1 }, uvVolume: { origin: [0, 0], range: 1 } }
                : {}),
            encodeChunk
        }
    );
    expect(observed.map((attribute) => attribute.reads())).toEqual([9, 9, 6]);
});

it.each(["position", "uv"] as const)(
    "uses an explicit %s volume without computing unused bounds",
    async (attribute) => {
        // Every input component is finite float32, but the automatically derived span
        // would overflow float32. With an explicit volume, the injected codec
        // owns the policy for finite values outside that volume.
        const input = { ...geometry, [attribute]: new Float32Array(geometry[attribute]!) };
        input[attribute]![0] = -3e38;
        input[attribute]![attribute === "position" ? 3 : 2] = 3e38;
        const options = {
            positionVolume: { origin: [0, 0, 0], range: 1 },
            uvVolume: { origin: [0, 0], range: 1 },
            encodeChunk
        };
        const bytes = await encodeGeometry(input, options);
        expect(decodeContainer(bytes).header.quantization).toEqual({
            positionBits: 14,
            normalBits: 8,
            uvBits: 10,
            position: options.positionVolume,
            uv: options.uvVolume
        });
    }
);

it.each(["position", "normal", "uv"] as const)(
    "still rejects non-finite %s with explicit volumes",
    async (attribute) => {
        const input = { ...geometry, [attribute]: new Float32Array(geometry[attribute]!) };
        input[attribute]![input[attribute]!.length - 1] = Infinity;
        const codec = vi.fn(encodeChunk);
        await expect(
            encodeGeometry(input, {
                positionVolume: { origin: [0, 0, 0], range: 1 },
                uvVolume: { origin: [0, 0], range: 1 },
                encodeChunk: codec
            })
        ).rejects.toThrow(/finite/);
        expect(codec).not.toHaveBeenCalled();
    }
);

it.each([
    { position: new Float32Array() },
    { position: new Float32Array(4) },
    { index: new Uint32Array() },
    { index: new Uint32Array([0, 1]) },
    { index: new Uint32Array([0, 1, 3]) },
    { normal: new Float32Array(3) },
    { uv: new Float32Array(2) }
])("rejects malformed geometry before invoking the codec: %o", async (invalid) => {
    const codec = vi.fn(encodeChunk);
    await expect(encodeGeometry({ ...geometry, ...invalid }, { encodeChunk: codec })).rejects.toThrow();
    expect(codec).not.toHaveBeenCalled();
});

it("revalidates mutable input on every encoding call", async () => {
    const input = { ...geometry, position: geometry.position.slice() };
    await encodeGeometry(input, { encodeChunk });
    input.position[0] = NaN;
    await expect(encodeGeometry(input, { encodeChunk })).rejects.toThrow(/finite/);
});

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
