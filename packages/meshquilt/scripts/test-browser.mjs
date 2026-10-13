import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { build } from "esbuild";
import { chromium } from "@playwright/test";

const require = createRequire(import.meta.url);
const dracoFolder = dirname(require.resolve("draco3d"));
const packageFolder = fileURLToPath(new URL("../", import.meta.url));
const api = await build({
    stdin: {
        contents: `import { createDracoWorkerPool } from "./src/codecs/draco/index.ts";
import { encodeGeometry } from "meshquilt";
globalThis.meshquilt = { createDracoWorkerPool, encodeGeometry };`,
        resolveDir: packageFolder
    },
    bundle: true,
    format: "iife",
    platform: "browser",
    write: false
});
const routes = new Map([
    [
        "/",
        {
            type: "text/html",
            bytes: Buffer.from(
                '<!doctype html><html><head><title>Worker integration</title></head><body><script src="/api.js"></script></body></html>'
            )
        }
    ],
    ["/api.js", { type: "text/javascript", bytes: api.outputFiles[0].contents }],
    ["/worker.js", { type: "text/javascript", bytes: await readFile(join(packageFolder, "worker/encode.worker.js")) }],
    [
        "/draco/draco_encoder.js",
        { type: "text/javascript", bytes: await readFile(join(dracoFolder, "draco_encoder_nodejs.js")) }
    ],
    [
        "/draco/draco_encoder.wasm",
        { type: "application/wasm", bytes: await readFile(join(dracoFolder, "draco_encoder.wasm")) }
    ]
]);
const server = createServer((request, response) => {
    const route = routes.get(request.url);
    response.writeHead(route ? 200 : 404, { "Content-Type": route?.type ?? "text/plain" });
    response.end(route?.bytes ?? "Not found");
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
    browser = await chromium.launch();
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const result = await page.evaluate(async () => {
        const { createDracoWorkerPool, encodeGeometry } = globalThis.meshquilt;
        const geometry = {
            position: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]),
            normal: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
            uv: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
            index: new Uint32Array([0, 1, 2, 0, 2, 3])
        };
        const pool = await createDracoWorkerPool({
            workerUrl: "/worker.js",
            encoderScriptUrl: "/draco/draco_encoder.js",
            size: 2,
            settings: { encodeSpeed: 3, decodeSpeed: 7 }
        });
        try {
            const buffer = await encodeGeometry(geometry, {
                maxTriangles: 1,
                concurrency: 2,
                encodeChunk: pool.encodeChunk
            });
            return { bytes: Array.from(buffer), sourceStillOwned: geometry.position.byteLength === 48 };
        } finally {
            pool.dispose();
        }
    });
    assert.equal(result.sourceStillOwned, true);
    assert.deepEqual(errors, []);
    const { createDecoderModule } = await import("draco3d");
    const decoder = await createDecoderModule({});
    const { decodeDracoChunk } = await import("../dist/codecs/draco/index.js");
    const { decodeGeometry } = await import("meshquilt");
    const decoded = await decodeGeometry(new Uint8Array(result.bytes), (bytes) => decodeDracoChunk(decoder, bytes));
    assert.equal(decoded.chunks.length, 2);
    assert.deepEqual(
        decoded.chunks.map((chunk) => chunk.index.length),
        [3, 3]
    );
    const vertices = decoded.chunks.map((chunk) =>
        Array.from({ length: chunk.position.length / 3 }, (_, i) =>
            Array.from(chunk.position.subarray(i * 3, i * 3 + 3)).join(",")
        )
    );
    assert.equal(vertices[0].filter((point) => vertices[1].includes(point)).length, 2);
    console.log(
        "Real browser workers: relative Draco URLs, WASM, 2-worker encoding, ownership and coincident seams passed."
    );
} finally {
    await browser?.close();
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
