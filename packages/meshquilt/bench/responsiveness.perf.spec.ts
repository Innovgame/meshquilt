import { test, expect } from "../test/browser/fixtures";
import { median } from "./fixtures";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const cases = [
    { name: "100k-indexed", cells: 224, soup: false },
    { name: "1m-indexed", cells: 708, soup: false },
    { name: "1m-soup", cells: 708, soup: true },
    { name: "2m-indexed", cells: 1000, soup: false }
];
const modes = [0, 1, 2, 4, "pipeline-copy", "pipeline-transfer"] as const;

for (const fixture of cases)
    for (const mode of modes) {
        test(`${fixture.name} / ${mode === 0 ? "direct" : mode}`, async ({ page }, testInfo) => {
            const result = await page.evaluate(
                async ({ cells, soup, mode }) => {
                    const {
                        grid,
                        triangleSoup,
                        encodeGeometry,
                        decodeContainer,
                        createDracoChunkEncoder,
                        createDracoWorkerPool,
                        encodeDracoInWorker
                    } = window.meshquilt;
                    const indexed = grid(cells);
                    const geometry = soup ? triangleSoup(indexed) : indexed;
                    const prefix = new URL("./", window.location.href).href;
                    const whole = typeof mode === "string";
                    const poolStart = performance.now();
                    const pool =
                        mode && !whole
                            ? await createDracoWorkerPool({
                                  workerUrl: `${prefix}worker.js`,
                                  encoderScriptUrl: `${prefix}draco_encoder.js`,
                                  size: mode,
                                  timeoutMs: 120_000
                              })
                            : undefined;
                    const module =
                        mode === 0
                            ? await window.DracoEncoderModule({ locateFile: (file) => `${prefix}${file}` })
                            : undefined;
                    const startupMs = performance.now() - poolStart;
                    const codec = pool?.encodeChunk ?? (module ? createDracoChunkEncoder(module) : undefined);
                    const encode = (input: typeof geometry) =>
                        whole
                            ? encodeDracoInWorker(input, {
                                  workerUrl: `${prefix}worker.js`,
                                  encoderScriptUrl: `${prefix}draco_encoder.js`,
                                  maxTriangles: 100_000,
                                  transferInput: mode === "pipeline-transfer",
                                  timeoutMs: 120_000
                              })
                            : encodeGeometry(input, {
                                  maxTriangles: 100_000,
                                  concurrency: typeof mode === "number" ? mode || 1 : 1,
                                  encodeChunk: codec!
                              });
                    const samples = [];
                    try {
                        await encode(grid(64));
                        for (let iteration = 0; iteration < 3; iteration++) {
                            // Input preparation is outside timing and responsiveness observation.
                            const input = mode === "pipeline-transfer" ? structuredClone(geometry) : geometry;
                            await new Promise((resolve) => setTimeout(resolve, 50));
                            const longTasks: number[] = [];
                            const observer = new PerformanceObserver((list) => {
                                for (const task of list.getEntries()) longTasks.push(task.duration);
                            });
                            observer.observe({ type: "longtask" });
                            let maxTimerDelayMs = 0;
                            let previous = performance.now();
                            const timer = setInterval(() => {
                                const now = performance.now();
                                maxTimerDelayMs = Math.max(maxTimerDelayMs, now - previous - 5);
                                previous = now;
                            }, 5);
                            window.benchPeakWasm = [...window.benchHeaps.values()].reduce(
                                (sum, bytes) => sum + bytes,
                                0
                            );
                            const start = performance.now();
                            const bytes = await encode(input);
                            const encodeMs = performance.now() - start;
                            await new Promise((resolve) => setTimeout(resolve, 30));
                            clearInterval(timer);
                            observer.disconnect();
                            samples.push({
                                encodeMs,
                                maxTimerDelayMs,
                                longTaskCount: longTasks.length,
                                maxLongTaskMs: Math.max(0, ...longTasks),
                                wasmHeapBytes: module?.HEAPU8.byteLength ?? window.benchPeakWasm,
                                outputBytes: bytes.length,
                                chunkCount: decodeContainer(bytes, { copyChunks: false }).header.chunkCount,
                                inputDetached: input.position.byteLength === 0
                            });
                        }
                    } finally {
                        pool?.dispose();
                    }
                    return {
                        startupMs,
                        triangles: (geometry.index?.length ?? geometry.position.length / 3) / 3,
                        samples
                    };
                },
                { ...fixture, mode }
            );
            expect(new Set(result.samples.map((sample) => sample.outputBytes)).size).toBe(1);
            for (const sample of result.samples) expect(sample.inputDetached).toBe(mode === "pipeline-transfer");
            const summary = {
                name: fixture.name,
                mode,
                triangles: result.triangles,
                startupMs: result.startupMs,
                encodeMs: median(result.samples.map((sample) => sample.encodeMs)),
                maxTimerDelayMs: median(result.samples.map((sample) => sample.maxTimerDelayMs)),
                longTaskCount: median(result.samples.map((sample) => sample.longTaskCount)),
                wasmHeapBytes: median(result.samples.map((sample) => sample.wasmHeapBytes)),
                outputBytes: result.samples[0]!.outputBytes
            };
            console.log(JSON.stringify(summary));
            const artifact = testInfo.outputPath("performance.json");
            await mkdir(dirname(artifact), { recursive: true });
            await writeFile(artifact, JSON.stringify({ ...summary, samples: result.samples }, null, 2));
            await testInfo.attach("performance", { path: artifact, contentType: "application/json" });
        });
    }
