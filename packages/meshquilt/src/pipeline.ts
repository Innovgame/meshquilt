import { encodeContainer, decodeContainer, type DecodeContainerOptions } from "./container/container.js";
import { computeSharedQuantization, DEFAULT_MAX_TRIANGLES, type QuantBits } from "./quantization/quant.js";
import { iterateValidatedGeometry } from "./geometry/split.js";
import { prepareGeometry } from "./geometry/prepare.js";
import {
    MeshQuiltError,
    type ChunkDecoder,
    type ChunkEncoder,
    type ChunkGeometry,
    type GeometryInput,
    type GeometryProgress,
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
    /** Called initially and after each successfully completed chunk. */
    onProgress?: (progress: GeometryProgress) => void;
}

export async function encodeGeometry(geometry: GeometryInput, options: EncodeGeometryOptions): Promise<Uint8Array> {
    if (options.signal?.aborted) throw new MeshQuiltError("operation aborted");
    const maxTriangles = options.maxTriangles ?? DEFAULT_MAX_TRIANGLES;
    if (!Number.isInteger(maxTriangles) || maxTriangles < 1)
        throw new MeshQuiltError("maxTriangles must be an integer >= 1");
    const concurrency = options.concurrency ?? 1;
    if (!Number.isInteger(concurrency) || concurrency < 1)
        throw new MeshQuiltError("concurrency must be an integer >= 1");
    const quant = prepareGeometry(geometry, options);
    const totalChunks = Math.ceil((geometry.index?.length ?? geometry.position.length / 3) / 3 / maxTriangles);
    let completedChunks = 0;
    const report = () => options.onProgress?.({ stage: "encode", completedChunks, totalChunks });
    report();

    const pieces = iterateValidatedGeometry(geometry, maxTriangles);
    const encoded = await mapPool(
        pieces,
        concurrency,
        async (chunk, index) => {
            const bytes = await options.encodeChunk(chunk, quant, index);
            completedChunks++;
            report();
            return bytes;
        },
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

export interface DecodeGeometryOptions extends DecodeContainerOptions, MapPoolOptions {
    onProgress?: (progress: GeometryProgress) => void;
}

export async function decodeGeometry(
    buffer: Uint8Array,
    decodeChunk: ChunkDecoder,
    concurrency = 1,
    options: DecodeGeometryOptions = {}
): Promise<{ header: QuiltHeader; chunks: ChunkGeometry[] }> {
    if (options.signal?.aborted) throw new MeshQuiltError("operation aborted");
    const packed = decodeContainer(buffer, options);
    let completedChunks = 0;
    const totalChunks = packed.header.chunkCount;
    const report = () => options.onProgress?.({ stage: "decode", completedChunks, totalChunks });
    report();
    const chunks = await mapPool(
        packed.chunks,
        concurrency,
        async (bytes, index) => {
            const chunk = await decodeChunk(bytes, packed.header.quantization, index);
            completedChunks++;
            report();
            return chunk;
        },
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

export function quantizationOf(geometry: GeometryInput, bits?: QuantBits): SharedQuantization {
    return computeSharedQuantization(geometry, bits);
}
