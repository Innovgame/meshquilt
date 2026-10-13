import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const pnpmCli = process.env.npm_execpath;
if (!pnpmCli) throw new Error("Run through pnpm test:packages.");
const consumer = await mkdtemp(join(tmpdir(), "meshquilt-package-check-"));
const run = (args, cwd = root) => execFileSync(process.execPath, args, { cwd, stdio: "pipe" });
try {
    const workspace = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
    const folder = join(root, "packages/meshquilt");
    const metadata = JSON.parse(await readFile(join(folder, "package.json"), "utf8"));
    assert.equal(metadata.version, workspace.version, "workspace and library versions must match");
    assert.equal(metadata.name, "meshquilt");
    assert.equal(metadata.private, undefined, "library must be publishable");
    assert.deepEqual(Object.keys(metadata.exports), [".", "./draco", "./worker"]);
    assert.equal(metadata.dependencies, undefined, "root package has no runtime dependencies");
    assert.equal(metadata.peerDependencies, undefined, "Three.js must not be a published peer dependency");
    run([pnpmCli, "pack", "--pack-destination", consumer], folder);
    const archive = join(consumer, `meshquilt-${metadata.version}.tgz`);
    await writeFile(
        join(consumer, "package.json"),
        JSON.stringify({
            private: true,
            type: "module",
            dependencies: {
                meshquilt: `file:${archive}`,
                "typescript-compiler": workspace.devDependencies["typescript-compiler"]
            }
        })
    );
    run([pnpmCli, "install", "--ignore-scripts"], consumer);
    await writeFile(
        join(consumer, "check.mjs"),
        `
import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { encodeGeometry, decodeGeometry, splitGeometry } from "meshquilt";
import { createDracoChunkEncoder, createDracoWorkerPool, encodeDracoInWorker } from "meshquilt/draco";
const geometry = { position: new Float32Array([0,0,0,1,0,0,0,1,0]) };
const chunks = splitGeometry(geometry, 1);
assert.deepEqual(chunks[0].index, new Uint32Array([0,1,2]));
const bytes = await encodeGeometry(geometry, { encodeChunk: () => new Uint8Array([7]) });
const decoded = await decodeGeometry(bytes, () => chunks[0]);
assert.equal(decoded.chunks.length, 1);
assert.equal(typeof createDracoChunkEncoder, "function");
assert.equal(typeof createDracoWorkerPool, "function");
assert.equal(typeof encodeDracoInWorker, "function");
assert.equal(globalThis.onmessage, undefined, "import must not install worker handlers");
assert.throws(() => import.meta.resolve("meshquilt/three"), /not defined by "exports"/);
assert.throws(() => import.meta.resolve("three"), /Cannot find package/);
await access(new URL(import.meta.resolve("meshquilt/worker")));
await access(new URL("./node_modules/meshquilt/LICENSE", import.meta.url));
console.log("Packed meshquilt: root/draco/worker exports, triangle soup, no Three dependency or import side effects passed.");
`
    );
    process.stdout.write(run([join(consumer, "check.mjs")], consumer));
    await writeFile(
        join(consumer, "check.ts"),
        `
import { encodeGeometry, decodeGeometry } from "meshquilt";
import type { GeometryInput, GeometryProgress, EncodeGeometryOptions, DecodeGeometryOptions, QuantBits } from "meshquilt";
import type { DracoWorkerPoolOptions, DracoGeometryWorkerOptions } from "meshquilt/draco";
const geometry: GeometryInput = { position: new Float32Array(9), index: new Uint16Array([0,1,2]) };
const quant: QuantBits = { positionBits: 14 };
const progress = (event: GeometryProgress) => { void event.completedChunks; };
const encode: EncodeGeometryOptions = { ...quant, encodeChunk: () => new Uint8Array([1]), onProgress: progress };
const decode: DecodeGeometryOptions = { copyChunks: false, onProgress: progress };
const worker: DracoWorkerPoolOptions = { workerUrl: "worker.js", encoderScriptUrl: "encoder.js" };
const wholeWorker: DracoGeometryWorkerOptions = { ...worker, transferInput: true };
void [geometry, encode, decode, worker, wholeWorker, encodeGeometry, decodeGeometry];
`
    );
    run(
        [
            join(consumer, "node_modules/typescript-compiler/bin/tsc"),
            "--noEmit",
            "--strict",
            "--target",
            "ES2022",
            "--module",
            "NodeNext",
            "--moduleResolution",
            "NodeNext",
            "check.ts"
        ],
        consumer
    );
    console.log("Packed meshquilt: TypeScript 7 NodeNext consumer declarations passed without Three.js types.");
} finally {
    if (/^meshquilt-package-check-[A-Za-z0-9]+$/.test(relative(tmpdir(), consumer)))
        await rm(consumer, { recursive: true, force: true });
    else {
        console.error(`Refusing unsafe temporary cleanup: ${consumer}`);
        process.exitCode = 1;
    }
}
