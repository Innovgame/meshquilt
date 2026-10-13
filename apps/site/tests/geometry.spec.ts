import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import {
    decodeContainer,
    decodeGeometry,
    encodeGeometry,
    encodeContainer
} from "../../../packages/meshquilt/src/index.js";
import { createDracoChunkEncoder, decodeDracoChunk } from "../../../packages/meshquilt/src/codecs/draco/index.js";
import type { DracoDecoderModule, DracoEncoderModule } from "../../../packages/meshquilt/src/codecs/draco/index.js";

const draco: {
    createDecoderModule: () => Promise<DracoDecoderModule>;
    createEncoderModule: () => Promise<DracoEncoderModule>;
} = createRequire(import.meta.url)("draco3d");

const stl = `solid triangle
facet normal 0 0 1
outer loop
vertex 10 0 0
vertex 12 0 0
vertex 10 2 0
endloop
endfacet
endsolid triangle`;
const obj = "v 10 0 0\nv 12 0 0\nv 10 2 0\nf 1 2 3\n";

function triangleGlb() {
    const json = Buffer.from(
        JSON.stringify({
            asset: { version: "2.0" },
            scene: 0,
            scenes: [{ nodes: [0] }],
            nodes: [{ mesh: 0, translation: [10, 0, 0] }],
            meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
            buffers: [{ byteLength: 36 }],
            bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }],
            accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3", min: [0, 0, 0], max: [2, 2, 0] }]
        })
    );
    const padded = Math.ceil(json.length / 4) * 4;
    const glb = Buffer.alloc(12 + 8 + padded + 8 + 36);
    glb.writeUInt32LE(0x46546c67, 0);
    glb.writeUInt32LE(2, 4);
    glb.writeUInt32LE(glb.length, 8);
    glb.writeUInt32LE(padded, 12);
    glb.writeUInt32LE(0x4e4f534a, 16);
    glb.fill(0x20, 20, 20 + padded);
    json.copy(glb, 20);
    glb.writeUInt32LE(36, 20 + padded);
    glb.writeUInt32LE(0x004e4942, 24 + padded);
    [0, 0, 0, 2, 0, 0, 0, 2, 0].forEach((value, i) => glb.writeFloatLE(value, 28 + padded + i * 4));
    return glb;
}

for (const [name, buffer] of [
    ["triangle.stl", Buffer.from(stl)],
    ["triangle.obj", Buffer.from(obj)],
    ["triangle.glb", triangleGlb()]
] as const) {
    test(`${name} imports and survives a real Draco download/reimport`, async ({ page }) => {
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto("./#/playground");
        await expect(page.getByLabel("Import model file")).toBeEnabled();
        await page
            .getByLabel("Import model file")
            .setInputFiles({ name, mimeType: "application/octet-stream", buffer });
        await expect(page.locator(".preview-model-name")).toHaveText(name);
        await expect(page.locator(".preview-stats")).toContainText("1 triangles");
        await expect(page.locator(".mesh-canvas canvas")).toBeVisible();
        const downloadPromise = page.waitForEvent("download");
        await page.getByRole("button", { name: "Encode & download" }).click();
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toBe("triangle.mqlt");
        const bytes = await readFile((await download.path())!);
        const packed = decodeContainer(new Uint8Array(bytes));
        expect(packed.header.chunkCount).toBe(1);
        expect(packed.header.quantization.position.origin).toEqual([10, 0, 0]);
        expect(packed.header.quantization.position.range).toBe(2);
        const decoder = await draco.createDecoderModule();
        const geometry = await decodeGeometry(new Uint8Array(bytes), (chunk) => decodeDracoChunk(decoder, chunk));
        expect(geometry.chunks[0]!.index.length).toBe(3);
        const positions = geometry.chunks[0]!.position;
        const x = Array.from(positions).filter((_, i) => i % 3 === 0);
        const y = Array.from(positions).filter((_, i) => i % 3 === 1);
        expect(Math.min(...x)).toBeCloseTo(10, 3);
        expect(Math.max(...x)).toBeCloseTo(12, 3);
        expect(Math.min(...y)).toBeCloseTo(0, 3);
        expect(Math.max(...y)).toBeCloseTo(2, 3);
        await expect(page.locator(".preview-result")).toContainText("MQLT");
        await page.getByRole("button", { name: "Preview encoded result" }).click();
        await expect(page.getByRole("button", { name: "Decoded", exact: true })).toHaveAttribute(
            "aria-pressed",
            "true"
        );
        await page
            .getByLabel("Import model file")
            .setInputFiles({ name: "roundtrip.mqlt", mimeType: "application/octet-stream", buffer: bytes });
        await expect(page.locator(".preview-model-name")).toHaveText("roundtrip.mqlt");
        await expect(page.locator(".preview-stats")).toContainText("1 triangles");
        await expect(page.locator(".mesh-canvas canvas")).toBeVisible();
        expect(errors).toEqual([]);
    });
}

test("invalid imports retain the last model and show an actionable error", async ({ page }) => {
    await page.goto("./#/playground");
    await expect(page.getByLabel("Import model file")).toBeEnabled();
    await page
        .getByLabel("Import model file")
        .setInputFiles({ name: "broken.mqlt", mimeType: "application/octet-stream", buffer: Buffer.from("MQLT") });
    await expect(page.locator(".preview-error")).toBeVisible();
    await expect(page.locator(".preview-model-name")).toHaveText("torus-knot.mesh");
    await expect(page.locator(".preview-stats")).toContainText("7,200");
    await page
        .getByLabel("Import model file")
        .setInputFiles({ name: "empty.obj", mimeType: "text/plain", buffer: Buffer.from("# empty") });
    await expect(page.locator(".preview-error")).toBeVisible();
    await expect(page.locator(".preview-model-name")).toHaveText("torus-knot.mesh");
});

test("encoding can be cancelled during codec startup and retried", async ({ page }) => {
    await page.goto("./#/playground");
    await expect(page.getByLabel("Import model file")).toBeEnabled();
    await page
        .getByLabel("Import model file")
        .setInputFiles({ name: "triangle.obj", mimeType: "text/plain", buffer: Buffer.from(obj) });
    await expect(page.locator(".preview-model-name")).toHaveText("triangle.obj");
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
        release = resolve;
    });
    await page.route("**/draco_encoder.wasm", async (route) => {
        await gate;
        await route.abort();
    });
    await page.getByRole("button", { name: "Encode & download" }).click();
    await page.getByRole("button", { name: "Cancel operation" }).click();
    await expect(page.getByRole("button", { name: "Encode & download" })).toBeEnabled();
    await expect(page.locator(".preview-result")).toHaveCount(0);
    release();
    await page.unrouteAll({ behavior: "wait" });
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Encode & download" }).click();
    await download;
    await expect(page.locator(".preview-result")).toBeVisible();
});

test("chunk and precision changes update export and preserve imported MQLT boundaries", async ({ page }) => {
    await page.goto("./#/playground");
    await expect(page.getByLabel("Import model file")).toBeEnabled();
    await expect(page.locator(".preview-stats")).toContainText("16 chunks");
    await page.getByLabel("Triangles / chunk").selectOption("1000");
    await expect(page.locator(".preview-stats")).toContainText("8 chunks");
    await page.getByLabel("Position precision").selectOption("12");
    let downloading = page.waitForEvent("download");
    await page.getByRole("button", { name: "Encode & download" }).click();
    const bytes = await readFile((await (await downloading).path())!);
    const packed = decodeContainer(new Uint8Array(bytes));
    expect(packed.header.chunkCount).toBe(8);
    expect(packed.header.quantization.positionBits).toBe(12);
    expect(packed.header.hasNormal).toBe(true);
    expect(packed.header.hasUv).toBe(true);
    await page.getByRole("button", { name: "Preview encoded result" }).click();
    await expect(page.getByRole("button", { name: "Decoded", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".preview-stats")).toContainText("7,200 triangles");
    await page.getByLabel("Position precision").selectOption("16");
    await expect(page.locator(".preview-result")).toHaveCount(0);
    downloading = page.waitForEvent("download");
    await page.getByRole("button", { name: "Encode & download" }).click();
    const changed = await readFile((await (await downloading).path())!);
    expect(decodeContainer(new Uint8Array(changed)).header.quantization.positionBits).toBe(16);
    await page
        .getByLabel("Import model file")
        .setInputFiles({ name: "eight-chunks.mqlt", mimeType: "application/octet-stream", buffer: bytes });
    await expect(page.locator(".preview-model-name")).toHaveText("eight-chunks.mqlt");
    await expect(page.locator(".preview-stats")).toContainText("8 chunks");
    await expect(page.getByLabel("Position precision")).toHaveValue("12");
    await page.getByLabel("Triangles / chunk").selectOption("450");
    await expect(page.locator(".preview-stats")).toContainText("8 chunks");
    downloading = page.waitForEvent("download");
    await page.getByRole("button", { name: "Encode & download" }).click();
    const reencoded = await readFile((await (await downloading).path())!);
    expect(decodeContainer(new Uint8Array(reencoded)).header.chunkCount).toBe(16);
});

test("the highest supported normal precision produces a downloadable and decodable model", async ({ page }) => {
    await page.goto("./#/playground");
    await expect(page.getByLabel("Import model file")).toBeEnabled();
    await expect(page.getByRole("button", { name: "Encode & download" })).toBeEnabled();
    await page.locator(".preview-advanced summary").click();
    const normals = page.getByRole("combobox", { name: "Normals", exact: true });
    const highest = await normals.locator("option").last().getAttribute("value");
    await normals.selectOption(highest!);
    const downloading = page.waitForEvent("download");
    await page.getByRole("button", { name: "Encode & download" }).click();
    const bytes = await readFile((await (await downloading).path())!);
    expect(decodeContainer(new Uint8Array(bytes)).header.quantization.normalBits).toBe(Number(highest));
    await page.getByRole("button", { name: "Preview encoded result" }).click();
    await expect(page.getByRole("button", { name: "Decoded", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("MQLT encoding rejects settings whose output could not be reimported", async ({ page }) => {
    test.setTimeout(60000);
    const encoder = await draco.createEncoderModule();
    const index = Uint32Array.from({ length: 900 * 3 }, (_, i) => i % 3);
    const small = await encodeGeometry(
        { position: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), index },
        {
            maxTriangles: 100000,
            encodeChunk: createDracoChunkEncoder(encoder)
        }
    );
    const packed = decodeContainer(small);
    const bytes = encodeContainer(
        { ...packed.header, chunkCount: 501 },
        Array.from({ length: 501 }, () => packed.chunks[0]!)
    );
    await page.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
            value: function (this: HTMLCanvasElement, ...args: Parameters<typeof original>) {
                if (String(args[0]).startsWith("webgl")) return null;
                return original.apply(this, args);
            }
        });
    });
    await page.goto("./#/playground");
    await expect(page.getByLabel("Import model file")).toBeEnabled();
    await expect(page.getByRole("button", { name: "Encode & download" })).toBeEnabled();
    await page
        .getByLabel("Import model file")
        .setInputFiles({ name: "large.mqlt", mimeType: "application/octet-stream", buffer: Buffer.from(bytes) });
    await expect(page.locator(".preview-model-name")).toHaveText("large.mqlt");
    await page.getByLabel("Triangles / chunk").selectOption("450");
    await expect(page.locator(".preview-error")).toContainText("1,000 chunks", { timeout: 3000 });
    await expect(page.getByLabel("Triangles / chunk")).toHaveValue("10000");
    await expect(page.locator(".preview-result")).toHaveCount(0);
});

test("whole mesh display survives MQLT reimport and does not change encoding chunks", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("./#/playground");
    await expect(page.getByLabel("Import model file")).toBeEnabled();
    const slider = page.getByRole("slider", { name: "Chunk separation" });
    await slider.focus();
    await page.keyboard.press("End");
    await page.getByRole("button", { name: "Whole mesh", exact: true }).click({ timeout: 3000 });
    await expect(page.getByRole("button", { name: "Whole mesh", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(slider).toHaveAttribute("aria-valuenow", "0");
    await expect(slider).toHaveAttribute("data-disabled");
    await expect(page.locator(".preview-display-note")).toContainText("1 mesh");
    await expect(page.locator(".preview-stats")).toContainText("16 chunks");
    await expect(page.locator(".mesh-canvas canvas")).toBeVisible();
    await page.getByRole("button", { name: "Chunks", exact: true }).click();
    await expect(slider).toHaveAttribute("aria-valuenow", "0");
    await expect(slider).not.toHaveAttribute("data-disabled");
    await slider.focus();
    await page.keyboard.press("End");
    await expect(slider).toHaveAttribute("aria-valuenow", "100");
    await page.getByRole("button", { name: "Whole mesh", exact: true }).click();
    const downloading = page.waitForEvent("download");
    await page.getByRole("button", { name: "Encode & download" }).click();
    const bytes = await readFile((await (await downloading).path())!);
    const packed = decodeContainer(new Uint8Array(bytes));
    expect(packed.header.chunkCount).toBe(16);
    expect(packed.header.hasNormal).toBe(true);
    expect(packed.header.hasUv).toBe(true);
    await page.getByRole("button", { name: "Preview encoded result" }).click();
    await expect(page.getByRole("button", { name: "Decoded", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Whole mesh", exact: true })).toHaveAttribute("aria-pressed", "true");
    const viewport = page.viewportSize()!;
    await page.setViewportSize({ ...viewport, height: 1800 });
    await page.getByRole("button", { name: "Whole mesh", exact: true }).focus();
    await page.locator(".mesh-preview").screenshot({ path: `../../.tmp/whole-mesh-${test.info().project.name}.png` });
    await page.setViewportSize(viewport);
    await page
        .getByLabel("Import model file")
        .setInputFiles({ name: "whole-preview.mqlt", mimeType: "application/octet-stream", buffer: bytes });
    await expect(page.locator(".preview-model-name")).toHaveText("whole-preview.mqlt");
    await expect(page.getByRole("button", { name: "Whole mesh", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".preview-stats")).toContainText("16 chunks");
    await page.getByRole("button", { name: "Chunks", exact: true }).click();
    await expect(page.getByRole("button", { name: "Chunks", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".preview-stats")).toContainText("7,200 triangles");
    await page.getByRole("button", { name: "Whole mesh", exact: true }).click();
    await page.getByRole("button", { name: "Use demo", exact: true }).click();
    await expect(page.getByLabel("Import model file")).toBeEnabled();
    await page.getByRole("button", { name: "Chunks", exact: true }).click();
    await expect(slider).toHaveAttribute("aria-valuenow", "0");
    await page.getByRole("button", { name: "Whole mesh", exact: true }).click();
    await page.getByRole("button", { name: "Switch to Chinese" }).click();
    await expect(page.getByRole("button", { name: "整体", exact: true })).toHaveAttribute("aria-pressed", "true");
    expect(errors).toEqual([]);
});
