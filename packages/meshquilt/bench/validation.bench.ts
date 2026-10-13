import { describe, expect, test } from "vitest";
import { computeSharedQuantization, validateGeometry } from "meshquilt";
import { normalizeVolume, validateQuantization } from "../src/quantization/quant";
import { prepareGeometry } from "../src/geometry/prepare";
import { grid, triangleSoup } from "./fixtures";

const measureQuantization = computeSharedQuantization;
const measureGeometryValidation = validateGeometry;
const measureQuantizationValidation = validateQuantization;
const measurePreparation = prepareGeometry;

describe.each([
    { name: "1m-indexed", soup: false },
    { name: "1m-soup", soup: true }
])("validation cost / $name", ({ name, soup }) => {
    test(
        "measure complete scans, repeated scans and constant-size parameter checks",
        { timeout: 120_000 },
        async ({ bench }) => {
            const input = soup ? triangleSoup(grid(708)) : grid(708);
            const quant = measureQuantization(input);
            const explicit = { positionVolume: quant.position, uvVolume: quant.uv };
            expect(() => measureGeometryValidation(input)).not.toThrow();
            expect(measurePreparation(input)).toEqual(quant);
            expect(measurePreparation(input, explicit)).toEqual(quant);
            const stages = [
                {
                    name: "full-geometry-validation",
                    run: () => {
                        measureGeometryValidation(input);
                    }
                },
                {
                    name: "separate-quant-plus-validation",
                    run: () => {
                        measureQuantization(input);
                        measureGeometryValidation(input);
                    }
                },
                {
                    name: "prepared-geometry",
                    run: () => {
                        measurePreparation(input);
                    }
                },
                {
                    name: "separate-explicit-volumes",
                    run: () => {
                        const computed = measureQuantization(input);
                        computed.position = normalizeVolume(explicit.positionVolume, 3);
                        if (explicit.uvVolume) computed.uv = normalizeVolume(explicit.uvVolume, 2);
                        measureGeometryValidation(input);
                    }
                },
                {
                    name: "prepared-explicit-volumes",
                    run: () => {
                        measurePreparation(input, explicit);
                    }
                },
                {
                    name: "repeated-position-uv-finiteness-only",
                    run: () => {
                        for (const values of [input.position, input.uv])
                            if (values)
                                for (let i = 0; i < values.length; i++) {
                                    if (!Number.isFinite(values[i])) throw new Error("invalid value");
                                }
                    }
                },
                {
                    name: "quantization-metadata-validation",
                    run: () => {
                        measureQuantizationValidation(quant);
                    }
                }
            ];
            for (const stage of stages) {
                await bench(
                    stage.name,
                    { writeResult: `.tmp/performance/validation/${name}/${stage.name}.json` },
                    stage.run
                ).run({ iterations: 20, time: 1000, warmupIterations: 20, warmupTime: 500 });
            }
        }
    );
});
