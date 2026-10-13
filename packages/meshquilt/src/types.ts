export class MeshQuiltError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "MeshQuiltError";
    }
}

/** Triangle mesh input. Missing indices mean consecutive triples of vertices. */
export interface GeometryInput {
    position: Float32Array;
    index?: Uint16Array | Uint32Array;
    normal?: Float32Array;
    uv?: Float32Array;
}

/** Normalized indexed geometry passed to codecs and returned by decoders. */
export interface GeometryBuffers extends GeometryInput {
    index: Uint32Array;
}

export type ChunkGeometry = GeometryBuffers;

export interface GeometryProgress {
    stage: "encode" | "decode";
    completedChunks: number;
    totalChunks: number;
}

/** origin is the minimum corner. range is the largest axis span, shared by every component. */
export interface QuantVolume {
    origin: number[];
    range: number;
}

export interface SharedQuantization {
    positionBits: number;
    normalBits: number;
    uvBits: number;
    position: QuantVolume;
    uv?: QuantVolume;
}

export interface QuiltHeader {
    version: 1;
    hasNormal: boolean;
    hasUv: boolean;
    chunkCount: number;
    quantization: SharedQuantization;
}

export interface ChunkEncoder {
    (chunk: ChunkGeometry, quant: SharedQuantization, index: number): Uint8Array | Promise<Uint8Array>;
}

export interface ChunkDecoder {
    (bytes: Uint8Array, quant: SharedQuantization, index: number): ChunkGeometry | Promise<ChunkGeometry>;
}
