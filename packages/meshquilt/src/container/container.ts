import { MeshQuiltError, type QuiltHeader, type SharedQuantization } from "../types.js";
import { validateQuantization } from "../quantization/quant.js";

export const QUILT_MAGIC = "MQLT";
export const QUILT_VERSION = 1;
const HEADER_BYTES = 44;

const FLAG_NORMAL = 1;
const FLAG_UV = 2;

export function encodeContainer(header: QuiltHeader, chunks: Uint8Array[]): Uint8Array {
    if (header.version !== QUILT_VERSION) throw new MeshQuiltError(`unsupported version ${header.version}`);
    if (chunks.length !== header.chunkCount) {
        throw new MeshQuiltError(`header chunkCount ${header.chunkCount} does not match ${chunks.length} buffers`);
    }
    if (!Number.isInteger(header.chunkCount) || header.chunkCount < 1 || header.chunkCount > 0xffffffff) {
        throw new MeshQuiltError("chunkCount must be an integer from 1 to 4294967295");
    }
    validateQuantization(header.quantization);
    if (header.hasUv && !header.quantization.uv) throw new MeshQuiltError("UV quantization volume is missing");
    let size = HEADER_BYTES;
    for (const chunk of chunks) {
        if (chunk.byteLength > 0xffffffff) throw new MeshQuiltError("chunk exceeds uint32 byte length");
        size += 4 + chunk.byteLength;
    }
    if (!Number.isSafeInteger(size)) throw new MeshQuiltError("container byte length exceeds safe integer range");
    const buffer = new ArrayBuffer(size);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    bytes.set([0x4d, 0x51, 0x4c, 0x54], 0);
    view.setUint16(4, QUILT_VERSION, true);
    let flags = 0;
    if (header.hasNormal) flags |= FLAG_NORMAL;
    if (header.hasUv) flags |= FLAG_UV;
    view.setUint16(6, flags, true);
    view.setUint32(8, header.chunkCount, true);
    bytes[12] = header.quantization.positionBits;
    bytes[13] = header.quantization.normalBits;
    bytes[14] = header.quantization.uvBits;
    writeVolume(view, 16, header.quantization.position, 3);
    writeVolume(view, 32, header.quantization.uv ?? { origin: [0, 0], range: 0 }, 2);

    let offset = HEADER_BYTES;
    for (const chunk of chunks) {
        view.setUint32(offset, chunk.byteLength, true);
        offset += 4;
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return bytes;
}

export interface DecodeContainerOptions {
    /** Default true. False returns views: keep the input alive and do not mutate or transfer it. */
    copyChunks?: boolean;
}

export function decodeContainer(
    buffer: Uint8Array,
    options: DecodeContainerOptions = {}
): { header: QuiltHeader; chunks: Uint8Array[] } {
    if (buffer.byteLength < HEADER_BYTES) throw new MeshQuiltError("quilt buffer is too small");
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const magic = String.fromCharCode(buffer[0]!, buffer[1]!, buffer[2]!, buffer[3]!);
    if (magic !== QUILT_MAGIC) throw new MeshQuiltError(`bad quilt magic ${magic}`);
    const version = view.getUint16(4, true);
    if (version !== QUILT_VERSION) throw new MeshQuiltError(`unsupported quilt version ${version}`);
    const flags = view.getUint16(6, true);
    if ((flags & ~(FLAG_NORMAL | FLAG_UV)) !== 0 || buffer[15] !== 0)
        throw new MeshQuiltError("unsupported quilt flags or reserved byte");
    const chunkCount = view.getUint32(8, true);
    if (chunkCount < 1 || chunkCount > Math.floor((buffer.byteLength - HEADER_BYTES) / 4)) {
        throw new MeshQuiltError("invalid quilt chunk count");
    }
    const quantization: SharedQuantization = {
        positionBits: buffer[12]!,
        normalBits: buffer[13]!,
        uvBits: buffer[14]!,
        position: readVolume(view, 16, 3)
    };
    const hasUv = (flags & FLAG_UV) !== 0;
    if (hasUv) quantization.uv = readVolume(view, 32, 2);
    validateQuantization(quantization);

    const chunks: Uint8Array[] = [];
    let offset = HEADER_BYTES;
    for (let i = 0; i < chunkCount; i++) {
        if (offset + 4 > buffer.byteLength) throw new MeshQuiltError("quilt chunk length is truncated");
        const length = view.getUint32(offset, true);
        offset += 4;
        if (offset + length > buffer.byteLength) throw new MeshQuiltError("quilt chunk is truncated");
        chunks.push(
            options.copyChunks === false
                ? buffer.subarray(offset, offset + length)
                : buffer.slice(offset, offset + length)
        );
        offset += length;
    }
    if (offset !== buffer.byteLength) throw new MeshQuiltError("unexpected trailing quilt bytes");
    return {
        header: {
            version: 1,
            hasNormal: (flags & FLAG_NORMAL) !== 0,
            hasUv,
            chunkCount,
            quantization
        },
        chunks
    };
}

function writeVolume(view: DataView, offset: number, volume: { origin: number[]; range: number }, dims: number): void {
    for (let i = 0; i < dims; i++) view.setFloat32(offset + i * 4, volume.origin[i] ?? 0, true);
    view.setFloat32(offset + dims * 4, volume.range, true);
}

function readVolume(view: DataView, offset: number, dims: number): { origin: number[]; range: number } {
    const origin = [];
    for (let i = 0; i < dims; i++) origin.push(view.getFloat32(offset + i * 4, true));
    return { origin, range: view.getFloat32(offset + dims * 4, true) };
}
