import { assertBits, computeSharedQuantization } from "./quant.js";

/** @deprecated Use computeSharedQuantization instead. Retained for existing callers. */
export const quantizationOf = computeSharedQuantization;

/**
 * @deprecated Illustrative float64 helper; not Draco's float32 quantizer.
 * Retained for existing callers. Use the codec for actual encoded coordinates.
 */
export function quantizeComponent(value: number, origin: number, range: number, bits: number): number {
    assertBits("bits", bits);
    if (bits <= 0) return value;
    const maxQ = (1 << bits) - 1;
    const safeRange = range === 0 ? 1 : range;
    let q = Math.floor((value - origin) * (maxQ / safeRange) + 0.5);
    if (q < 0) q = 0;
    if (q > maxQ) q = maxQ;
    return origin + q * (safeRange / maxQ);
}
