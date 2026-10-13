import { MeshQuiltError, type GeometryInput, type GeometryBuffers } from "../types.js";
import { validateGeometry } from "./validate.js";

/**
 * Concatenate triangle geometry in input order into independently owned buffers.
 * Optional attributes must be present on every input or absent from every input.
 * Keeps duplicate vertices and their normals/UVs; never welds or requantizes.
 */
export function mergeGeometry(inputs: readonly GeometryInput[]): GeometryBuffers {
    if (inputs.length === 0) throw new MeshQuiltError("mergeGeometry requires at least one geometry");
    const hasNormal = inputs[0]!.normal !== undefined;
    const hasUv = inputs[0]!.uv !== undefined;
    let vertices = 0;
    let indexCount = 0;
    for (const input of inputs) {
        validateGeometry(input);
        if ((input.normal !== undefined) !== hasNormal)
            throw new MeshQuiltError("normal must be present on every geometry or absent from every geometry");
        if ((input.uv !== undefined) !== hasUv)
            throw new MeshQuiltError("uv must be present on every geometry or absent from every geometry");
        vertices += input.position.length / 3;
        indexCount += input.index?.length ?? input.position.length / 3;
        if (!Number.isSafeInteger(vertices) || vertices > 0x1_0000_0000)
            throw new MeshQuiltError("merged vertex count exceeds Uint32 index range");
        if (!Number.isSafeInteger(indexCount))
            throw new MeshQuiltError("merged index count exceeds safe integer range");
    }
    const result: GeometryBuffers = {
        position: new Float32Array(vertices * 3),
        index: new Uint32Array(indexCount)
    };
    if (hasNormal) result.normal = new Float32Array(vertices * 3);
    if (hasUv) result.uv = new Float32Array(vertices * 2);
    let vertexOffset = 0;
    let indexOffset = 0;
    for (const input of inputs) {
        result.position.set(input.position, vertexOffset * 3);
        if (result.normal) result.normal.set(input.normal!, vertexOffset * 3);
        if (result.uv) result.uv.set(input.uv!, vertexOffset * 2);
        const count = input.index?.length ?? input.position.length / 3;
        for (let i = 0; i < count; i++) result.index[indexOffset + i] = vertexOffset + (input.index?.[i] ?? i);
        vertexOffset += input.position.length / 3;
        indexOffset += count;
    }
    return result;
}
