import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { test as base, expect } from "@playwright/test";
import type * as Core from "meshquilt";
import type * as Draco from "meshquilt/draco";
import type * as Fixtures from "../../bench/fixtures";

type EncoderModule = Draco.DracoEncoderModule & { HEAPU8: Uint8Array };
declare global {
    interface Window {
        meshquilt: typeof Core & typeof Draco & typeof Fixtures;
        DracoEncoderModule: (options: { locateFile: (file: string) => string }) => Promise<EncoderModule>;
        benchHeaps: Map<number, number>;
        benchPeakWasm: number;
    }
}

const require = createRequire(import.meta.url);
const packageFolder = fileURLToPath(new URL("../../", import.meta.url));
const dracoFolder = dirname(require.resolve("draco3d"));

// Benchmark-only instrumentation reports WASM heap capacity. Production sources are unchanged.
const heapInstrumentation = `
if (typeof WorkerGlobalScope !== "undefined" && globalThis instanceof WorkerGlobalScope) {
    const factory = globalThis.DracoEncoderModule;
    globalThis.DracoEncoderModule = async (options) => {
        const module = await factory(options);
        const notify = () => globalThis.postMessage({ __meshquiltBench: true, heapBytes: module.HEAPU8.byteLength });
        const encode = module.Encoder.prototype.EncodeMeshToDracoBuffer;
        module.Encoder.prototype.EncodeMeshToDracoBuffer = function (...args) {
            try { return encode.apply(this, args); } finally { notify(); }
        };
        notify();
        return module;
    };
}`;

export const test = base.extend<{ libraryPage: void }>({
    libraryPage: [
        async ({ page, context, baseURL }, use, testInfo) => {
            const api = await build({
                stdin: {
                    contents: `import * as core from "./src/index.ts";
import * as draco from "./src/codecs/draco/index.ts";
import * as fixtures from "./bench/fixtures.ts";
window.meshquilt = { ...core, ...draco, ...fixtures };`,
                    resolveDir: packageFolder
                },
                bundle: true,
                format: "iife",
                platform: "browser",
                write: false
            });
            const measureHeap = testInfo.project.name === "library-performance";
            const encoder = Buffer.concat([
                await readFile(join(dracoFolder, "draco_encoder_nodejs.js")),
                Buffer.from(measureHeap ? `\n${heapInstrumentation}` : "")
            ]);
            const prefix = new URL("perf/", baseURL!).pathname;
            const routes = new Map([
                [
                    prefix,
                    {
                        type: "text/html",
                        body: Buffer.from(
                            "<!doctype html><html><head><title>MeshQuilt browser checks</title></head><body></body></html>"
                        )
                    }
                ],
                [
                    `${prefix}worker.js`,
                    { type: "text/javascript", body: await readFile(join(packageFolder, "worker/encode.worker.js")) }
                ],
                [`${prefix}draco_encoder.js`, { type: "text/javascript", body: encoder }],
                [
                    `${prefix}draco_encoder.wasm`,
                    { type: "application/wasm", body: await readFile(join(dracoFolder, "draco_encoder.wasm")) }
                ]
            ]);
            await context.route("**/perf/**", async (route) => {
                const asset = routes.get(new URL(route.request().url()).pathname);
                await route.fulfill({
                    status: asset ? 200 : 404,
                    contentType: asset?.type ?? "text/plain",
                    body: asset?.body ?? "Not found"
                });
            });
            await page.goto(new URL("perf/", baseURL!).href);
            await page.addScriptTag({ url: `${prefix}draco_encoder.js` });
            await page.addScriptTag({ content: api.outputFiles[0]!.text });
            if (measureHeap)
                await page.evaluate(() => {
                    const NativeWorker = window.Worker;
                    window.benchHeaps = new Map();
                    window.benchPeakWasm = 0;
                    let nextWorker = 0;
                    window.Worker = class extends NativeWorker {
                        private readonly benchmarkId = ++nextWorker;
                        constructor(url: string | URL, options?: WorkerOptions) {
                            super(url, options);
                            this.addEventListener("message", (event) => {
                                if (!event.data?.__meshquiltBench) return;
                                event.stopImmediatePropagation();
                                window.benchHeaps.set(this.benchmarkId, event.data.heapBytes);
                                const total = [...window.benchHeaps.values()].reduce((sum, bytes) => sum + bytes, 0);
                                window.benchPeakWasm = Math.max(window.benchPeakWasm, total);
                            });
                        }
                        override terminate() {
                            window.benchHeaps.delete(this.benchmarkId);
                            super.terminate();
                        }
                    };
                });
            await use();
        },
        { auto: true }
    ]
});

export { expect };
