import { beforeAll, describe, expect, test } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createEncoderModule, createDecoderModule } from "draco3d";
import { computeSharedQuantization, validateGeometry, splitGeometry, encodeGeometry, decodeGeometry } from "meshquilt";
import { createDracoChunkEncoder, decodeDracoChunk } from "meshquilt/draco";
import type * as CoreModule from "meshquilt";
import type * as DracoModule from "meshquilt/draco";
import type { DracoDecoderModule, DracoEncoderModule } from "meshquilt/draco";
import { grid, triangleSoup } from "./fixtures";

// Optional compiled baseline uses this same runner and fixture suite.
const baselineDir = process.env.MESHQUILT_BENCH_DIST;
const core = baselineDir
    ? ((await import(pathToFileURL(resolve(baselineDir, "index.js")).href)) as typeof CoreModule)
    : { computeSharedQuantization, validateGeometry, splitGeometry, encodeGeometry, decodeGeometry };
const draco = baselineDir
    ? ((await import(pathToFileURL(resolve(baselineDir, "codecs/draco/index.js")).href)) as typeof DracoModule)
    : { createDracoChunkEncoder, decodeDracoChunk };
const label = baselineDir ? "baseline" : "current";
// Resolve import getters before entering hot loops.
const measureVolume = core.computeSharedQuantization;
const validate = core.validateGeometry;
const split = core.splitGeometry;
const encode = core.encodeGeometry;
const decode = core.decodeGeometry;
const decodeChunk = draco.decodeDracoChunk;
let encoder: ReturnType<typeof createDracoChunkEncoder>;
let decoder: DracoDecoderModule;
beforeAll(async () => {
    encoder = draco.createDracoChunkEncoder((await createEncoderModule({})) as unknown as DracoEncoderModule);
    decoder = (await createDecoderModule({})) as unknown as DracoDecoderModule;
});

const cases = [
    { name: "100k-indexed", cells: 224, soup: false },
    { name: "500k-indexed", cells: 500, soup: false },
    { name: "1m-indexed", cells: 708, soup: false },
    { name: "1m-soup", cells: 708, soup: true },
    { name: "2m-indexed", cells: 1000, soup: false }
];

describe.each(cases)("$name / 14-8-10 bits / 100k triangles per chunk", ({ name, cells, soup }) => {
    test("geometry and codec stages", { timeout: 120_000 }, async ({ bench }) => {
        const indexed = grid(cells);
        const input = soup ? triangleSoup(indexed) : indexed;
        const triangles = (input.index?.length ?? input.position.length / 3) / 3;
        const options = { maxTriangles: 100_000, encodeChunk: encoder };
        const payload = await encode(input, options);
        const read = (bytes: Uint8Array) => decodeChunk(decoder, bytes);
        const decoded = await decode(payload, read);
        expect(decoded.chunks.reduce((sum, chunk) => sum + chunk.index.length / 3, 0)).toBe(triangles);
        decoded.chunks.length = 0;

        const stages = [
            {
                name: "shared-volume",
                run: () => {
                    measureVolume(input);
                }
            },
            {
                name: "validation",
                run: () => {
                    validate(input);
                }
            },
            {
                name: "split",
                run: () => {
                    split(input, 100_000);
                }
            },
            {
                name: "encode",
                run: async () => {
                    await encode(input, options);
                }
            },
            {
                name: "decode",
                run: async () => {
                    await decode(payload, read);
                }
            }
        ];
        for (const stage of stages) {
            const options = {
                iterations: 5,
                time: 300,
                warmupIterations: 1,
                warmupTime: 50
            };
            const registration = bench(
                stage.name,
                { writeResult: `.tmp/performance/vitest/${label}/${name}/${stage.name}.json` },
                stage.run
            );
            const savedBaseline = `.tmp/performance/vitest/baseline/${name}/${stage.name}.json`;
            if (!baselineDir && existsSync(savedBaseline))
                await bench.compare(bench.from("baseline", savedBaseline), registration, options);
            else await registration.run(options);
        }
    });
});
