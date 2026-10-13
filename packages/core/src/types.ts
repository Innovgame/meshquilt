export class MeshQuiltError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "MeshQuiltError";
    }
}

/** Indexed triangle mesh. Attributes are per vertex, matching THREE.BufferGeometry. */
export interface GeometryBuffers {
    position: Float32Array;
    index: Uint32Array;
    normal?: Float32Array;
    uv?: Float32Array;
}

export type ChunkGeometry = GeometryBuffers;

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
