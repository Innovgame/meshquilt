import { encodeContainer, decodeContainer, type DecodeContainerOptions } from "./container.js";
import { computeSharedQuantization, normalizeVolume, DEFAULT_MAX_TRIANGLES, type QuantBits } from "./quant.js";
import { iterateGeometry } from "./split.js";
import {
    MeshQuiltError,
    type ChunkDecoder,
    type ChunkEncoder,
    type ChunkGeometry,
    type GeometryBuffers,
    type QuantVolume,
    type QuiltHeader,
    type SharedQuantization
} from "./types.js";

export interface EncodeGeometryOptions extends QuantBits {
    maxTriangles?: number;
    positionVolume?: QuantVolume;
    uvVolume?: QuantVolume;
    concurrency?: number;
    encodeChunk: ChunkEncoder;
    /** Stops scheduling new chunks; in-flight codec calls are awaited before rejection. */
    signal?: AbortSignal;
}

export async function encodeGeometry(geometry: GeometryBuffers, options: EncodeGeometryOptions): Promise<Uint8Array> {
    if (options.signal?.aborted) throw new MeshQuiltError("operation aborted");
    const quant = computeSharedQuantization(geometry, options);
    if (options.positionVolume) quant.position = normalizeVolume(options.positionVolume, 3);
    if (options.uvVolume) quant.uv = normalizeVolume(options.uvVolume, 2);
    if (geometry.uv && !quant.uv) throw new MeshQuiltError("uv quantization volume is missing");

    const pieces = iterateGeometry(geometry, options.maxTriangles ?? DEFAULT_MAX_TRIANGLES);
    const encoded = await mapPool(
        pieces,
        options.concurrency ?? 1,
        (chunk, index) => options.encodeChunk(chunk, quant, index),
        { signal: options.signal }
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
    concurrency = 1,
    options: DecodeContainerOptions & MapPoolOptions = {}
): Promise<{ header: QuiltHeader; chunks: ChunkGeometry[] }> {
    if (options.signal?.aborted) throw new MeshQuiltError("operation aborted");
    const packed = decodeContainer(buffer, options);
    const chunks = await mapPool(
        packed.chunks,
        concurrency,
        (bytes, index) => decodeChunk(bytes, packed.header.quantization, index),
        options
    );
    return { header: packed.header, chunks };
}

export interface MapPoolOptions {
    signal?: AbortSignal;
}

export async function mapPool<T, R>(
    items: Iterable<T>,
    concurrency: number,
    fn: (item: T, index: number) => R | Promise<R>,
    options: MapPoolOptions = {}
): Promise<R[]> {
    if (!Number.isInteger(concurrency) || concurrency < 1) {
        throw new MeshQuiltError("concurrency must be an integer >= 1");
    }
    const results: R[] = [];
    const iterator = items[Symbol.iterator]();
    let next = 0;
    const lanes = Array.isArray(items) ? Math.min(concurrency, items.length) : concurrency;
    let failed = false;
    let failure: unknown;
    await Promise.all(
        Array.from({ length: lanes }, async () => {
            while (!failed) {
                try {
                    if (options.signal?.aborted) throw new MeshQuiltError("operation aborted");
                    const item = iterator.next();
                    if (item.done) break;
                    const index = next++;
                    results[index] = await fn(item.value, index);
                } catch (error) {
                    if (!failed) failure = error;
                    failed = true;
                }
            }
        })
    );
    if (failed) {
        iterator.return?.();
        throw failure;
    }
    if (options.signal?.aborted) throw new MeshQuiltError("operation aborted");
    return results;
}

export function quantizationOf(geometry: GeometryBuffers, bits?: QuantBits): SharedQuantization {
    return computeSharedQuantization(geometry, bits);
}
