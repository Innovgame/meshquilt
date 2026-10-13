import { encodeContainer, decodeContainer } from "./container";
import { computeSharedQuantization, type QuantBits } from "./quant";
import { splitGeometry } from "./split";
import {
    MeshQuiltError,
    type ChunkDecoder,
    type ChunkEncoder,
    type ChunkGeometry,
    type GeometryBuffers,
    type QuantVolume,
    type QuiltHeader,
    type SharedQuantization
} from "./types";

export interface EncodeGeometryOptions extends QuantBits {
    maxTriangles?: number;
    positionVolume?: QuantVolume;
    uvVolume?: QuantVolume;
    concurrency?: number;
    encodeChunk: ChunkEncoder;
}

export async function encodeGeometry(geometry: GeometryBuffers, options: EncodeGeometryOptions): Promise<Uint8Array> {
    const quant = computeSharedQuantization(geometry, options);
    if (options.positionVolume) quant.position = options.positionVolume;
    if (options.uvVolume) quant.uv = options.uvVolume;
    if (geometry.uv && !quant.uv) throw new MeshQuiltError("uv quantization volume is missing");

    const pieces = splitGeometry(geometry, options.maxTriangles ?? 100_000);
    const encoded = await mapPool(pieces, options.concurrency ?? 1, (chunk, index) =>
        options.encodeChunk(chunk, quant, index)
    );
    const header: QuiltHeader = {
        version: 1,
        hasNormal: geometry.normal !== undefined,
        hasUv: geometry.uv !== undefined,
        chunkCount: encoded.length,
        quantization: quant
    };
    return encodeContainer(header, encoded);
}

export async function decodeGeometry(
    buffer: Uint8Array,
    decodeChunk: ChunkDecoder,
    concurrency = 1
): Promise<{ header: QuiltHeader; chunks: ChunkGeometry[] }> {
    const packed = decodeContainer(buffer);
    const chunks = await mapPool(packed.chunks, concurrency, (bytes, index) =>
        decodeChunk(bytes, packed.header.quantization, index)
    );
    return { header: packed.header, chunks };
}

export async function mapPool<T, R>(
    items: readonly T[],
    concurrency: number,
    fn: (item: T, index: number) => R | Promise<R>
): Promise<R[]> {
    if (!Number.isInteger(concurrency) || concurrency < 1) {
        throw new MeshQuiltError("concurrency must be an integer >= 1");
    }
    const results = new Array<R>(items.length);
    let next = 0;
    const lanes = Math.min(concurrency, items.length);
    await Promise.all(
        Array.from({ length: lanes }, async () => {
            while (next < items.length) {
                const index = next++;
                results[index] = await fn(items[index]!, index);
            }
        })
    );
    return results;
}

export function quantizationOf(geometry: GeometryBuffers, bits?: QuantBits): SharedQuantization {
    return computeSharedQuantization(geometry, bits);
}
