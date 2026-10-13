import { MeshQuiltError, type GeometryBuffers, type QuantVolume, type SharedQuantization } from "./types";

export const DEFAULT_POSITION_BITS = 14;
export const DEFAULT_NORMAL_BITS = 8;
export const DEFAULT_UV_BITS = 10;
export const DEFAULT_MAX_TRIANGLES = 100_000;
export const MAX_QUANT_BITS = 30;

export interface QuantBits {
    positionBits?: number;
    normalBits?: number;
    uvBits?: number;
}

/**
 * Snap one component onto the Draco grid.
 * Draco uses `floor((value - origin) / range * maxQ + 0.5)` in float32.
 * This helper is float64 and exists so tests can show that a shared volume
 * keeps identical inputs identical. The encoder still does the real snap.
 */
export function quantizeComponent(value: number, origin: number, range: number, bits: number): number {
    if (bits <= 0) return value;
    const maxQ = (1 << bits) - 1;
    const safeRange = range === 0 ? 1 : range;
    let q = Math.floor((value - origin) * (maxQ / safeRange) + 0.5);
    if (q < 0) q = 0;
    if (q > maxQ) q = maxQ;
    return origin + q * (safeRange / maxQ);
}

export function computeVolume(values: Float32Array, stride: number): QuantVolume {
    if (stride < 1) throw new MeshQuiltError("stride must be >= 1");
    if (values.length % stride !== 0) {
        throw new MeshQuiltError(`attribute length ${values.length} is not divisible by ${stride}`);
    }
    const origin = new Array<number>(stride).fill(Number.POSITIVE_INFINITY);
    const max = new Array<number>(stride).fill(Number.NEGATIVE_INFINITY);
    if (values.length === 0) {
        return { origin: new Array<number>(stride).fill(0), range: 1 };
    }
    for (let i = 0; i < values.length; i += stride) {
        for (let c = 0; c < stride; c++) {
            const value = values[i + c]!;
            if (value < origin[c]!) origin[c] = value;
            if (value > max[c]!) max[c] = value;
        }
    }
    let range = 0;
    for (let c = 0; c < stride; c++) {
        const span = max[c]! - origin[c]!;
        if (span > range) range = span;
    }
    return { origin, range: range === 0 ? 1 : range };
}

export function assertBits(name: string, bits: number): void {
    if (!Number.isInteger(bits) || bits < 0 || bits > MAX_QUANT_BITS) {
        throw new MeshQuiltError(`${name} must be an integer from 0 to ${MAX_QUANT_BITS}`);
    }
}

export function computeSharedQuantization(geometry: GeometryBuffers, bits: QuantBits = {}): SharedQuantization {
    const positionBits = bits.positionBits ?? DEFAULT_POSITION_BITS;
    const normalBits = bits.normalBits ?? DEFAULT_NORMAL_BITS;
    const uvBits = bits.uvBits ?? DEFAULT_UV_BITS;
    assertBits("positionBits", positionBits);
    assertBits("normalBits", normalBits);
    assertBits("uvBits", uvBits);

    const quant: SharedQuantization = {
        positionBits,
        normalBits,
        uvBits,
        position: computeVolume(geometry.position, 3)
    };
    if (geometry.uv) quant.uv = computeVolume(geometry.uv, 2);
    return quant;
}
