import { computeVolume, normalizeVolume, resolveQuantBits, type QuantBits } from "../quantization/quant.js";
import type { GeometryInput, QuantVolume, SharedQuantization } from "../types.js";
import { validateFiniteAttribute, validateGeometryShape, validateIndices } from "./validate.js";

interface PrepareGeometryOptions extends QuantBits {
    positionVolume?: QuantVolume;
    uvVolume?: QuantVolume;
}

/**
 * Internal encoder boundary. Checks every attribute once, folding position/UV
 * validation into bounds calculation unless an explicit shared volume is given.
 * Inputs remain caller-owned: downstream work must finish before any mutation.
 */
export function prepareGeometry(geometry: GeometryInput, options: PrepareGeometryOptions = {}): SharedQuantization {
    validateGeometryShape(geometry);
    const bits = resolveQuantBits(options);
    // Reject malformed options before scanning model-sized buffers.
    const position = options.positionVolume ? normalizeVolume(options.positionVolume, 3) : undefined;
    const uv = options.uvVolume ? normalizeVolume(options.uvVolume, 2) : undefined;
    validateIndices(geometry);
    if (geometry.normal) validateFiniteAttribute("normal", geometry.normal);
    if (position) validateFiniteAttribute("position", geometry.position);
    if (geometry.uv && uv) validateFiniteAttribute("uv", geometry.uv);

    const quant: SharedQuantization = {
        ...bits,
        position: position ?? computeVolume(geometry.position, 3)
    };
    if (uv) quant.uv = uv;
    else if (geometry.uv) quant.uv = computeVolume(geometry.uv, 2);
    return quant;
}
