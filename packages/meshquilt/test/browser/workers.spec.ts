import { createDecoderModule } from "draco3d";
import { decodeGeometry } from "meshquilt";
import { decodeDracoChunk } from "meshquilt/draco";
import type { DracoDecoderModule } from "meshquilt/draco";
import { test, expect } from "./fixtures";

test("library browser checks run on intercepted assets without a website server", async ({ page }) => {
    // Only the fixture's synthetic origin is allowed; no Vite preview is involved.
    expect(new URL(page.url()).hostname).toBe("meshquilt.test");
    const result = await page.evaluate(async () => {
        const { grid, encodeDracoInWorker } = window.meshquilt;
        const prefix = new URL("./", window.location.href).href;
        const bytes = await encodeDracoInWorker(grid(1), {
            workerUrl: `${prefix}worker.js`,
            encoderScriptUrl: `${prefix}draco_encoder.js`
        });
        return Array.from(bytes.subarray(0, 4));
    });
    expect(result).toEqual([77, 81, 76, 84]);
});

test("pooled and whole-pipeline Workers preserve bytes, seams, progress and buffer ownership", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const result = await page.evaluate(async () => {
        const { grid, encodeGeometry, createDracoWorkerPool, encodeDracoInWorker } = window.meshquilt;
        const input = grid(2);
        const prefix = new URL("./", window.location.href).href;
        const settings = { encodeSpeed: 3, decodeSpeed: 7 };
        const pool = await createDracoWorkerPool({
            workerUrl: `${prefix}worker.js`,
            encoderScriptUrl: `${prefix}draco_encoder.js`,
            size: 2,
            settings
        });
        let baseline: Uint8Array;
        try {
            baseline = await encodeGeometry(input, { maxTriangles: 4, concurrency: 2, encodeChunk: pool.encodeChunk });
        } finally {
            pool.dispose();
        }
        const whole = [];
        for (const transferInput of [false, true]) {
            const geometry = structuredClone(input);
            const progress: number[] = [];
            const bytes = await encodeDracoInWorker(geometry, {
                workerUrl: `${prefix}worker.js`,
                encoderScriptUrl: `${prefix}draco_encoder.js`,
                transferInput,
                maxTriangles: 4,
                settings,
                onProgress(event) {
                    progress.push(event.completedChunks);
                }
            });
            whole.push({ bytes: Array.from(bytes), detached: geometry.position.byteLength === 0, progress });
        }
        return { baseline: Array.from(baseline), inputOwned: input.position.byteLength > 0, whole };
    });
    expect(errors).toEqual([]);
    expect(result.inputOwned).toBe(true);
    for (const [index, sample] of result.whole.entries()) {
        expect(sample.detached).toBe(index === 1);
        expect(sample.bytes).toEqual(result.baseline);
        expect(sample.progress).toEqual([0, 1, 2]);
    }
    const decoder = (await createDecoderModule({})) as unknown as DracoDecoderModule;
    const decoded = await decodeGeometry(new Uint8Array(result.baseline), (bytes) => decodeDracoChunk(decoder, bytes));
    expect(decoded.chunks).toHaveLength(2);
    expect(decoded.chunks.reduce((sum, chunk) => sum + chunk.index.length / 3, 0)).toBe(8);
    const points = decoded.chunks.map((chunk) =>
        Array.from({ length: chunk.position.length / 3 }, (_, i) =>
            Array.from(chunk.position.subarray(i * 3, i * 3 + 3)).join(",")
        )
    );
    expect(points[0]!.filter((point) => points[1]!.includes(point)).length).toBeGreaterThan(0);
});
