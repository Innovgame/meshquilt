import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// Exercise packed exports in an isolated consumer, rather than workspace source aliases.
const root = fileURLToPath(new URL("../", import.meta.url));
const consumer = await mkdtemp(join(tmpdir(), "meshquilt-package-check-"));
const pnpmCli = process.env.npm_execpath;
if (!pnpmCli) throw new Error("Run through pnpm test:packages so the package manager CLI is known.");
const run = (command, args, cwd = root) => execFileSync(command, args, { cwd, stdio: "pipe" });
try {
    const archives = [];
    const workspace = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
    const threePackage = JSON.parse(await readFile(join(root, "packages/three/package.json"), "utf8"));
    for (const name of ["core", "draco", "three"]) {
        const folder = join(root, "packages", name);
        const metadata = JSON.parse(await readFile(join(folder, "package.json"), "utf8"));
        if (metadata.version !== workspace.version) throw new Error(`${name} version differs from root`);
        run(process.execPath, [pnpmCli, "pack", "--pack-destination", consumer], folder);
        archives.push(join(consumer, `meshquilt-${name}-${metadata.version}.tgz`));
    }
    await writeFile(
        join(consumer, "package.json"),
        JSON.stringify({
            private: true,
            type: "module",
            dependencies: {
                "@meshquilt/core": `file:${archives[0]}`,
                "@meshquilt/draco": `file:${archives[1]}`,
                "@meshquilt/three": `file:${archives[2]}`,
                three: threePackage.devDependencies.three,
                "@types/three": threePackage.devDependencies["@types/three"],
                "typescript-compiler": workspace.devDependencies["typescript-compiler"]
            },
            pnpm: { overrides: { "@meshquilt/core": `file:${archives[0]}` } }
        })
    );
    run(process.execPath, [pnpmCli, "install", "--ignore-scripts"], consumer);
    await writeFile(
        join(consumer, "check.mjs"),
        `
import { splitGeometry } from "@meshquilt/core";
import { createDracoChunkEncoder, createDracoWorkerPool } from "@meshquilt/draco";
import { meshToGeometry } from "@meshquilt/three";
import { BoxGeometry, Mesh, MeshBasicMaterial } from "three";
import { access } from "node:fs/promises";
const geometry = meshToGeometry(new Mesh(new BoxGeometry(), new MeshBasicMaterial()));
if (splitGeometry(geometry, 4).length !== 3) throw Error("packed split failed");
if (typeof createDracoChunkEncoder !== "function" || typeof createDracoWorkerPool !== "function") throw Error("Draco exports missing");
await access(new URL(import.meta.resolve("@meshquilt/draco/worker")));
console.log("Packed packages: native ESM imports and geometry conversion passed.");
`
    );
    process.stdout.write(run(process.execPath, [join(consumer, "check.mjs")], consumer));
    await writeFile(
        join(consumer, "check.ts"),
        `
import type { EncodeGeometryOptions, QuantBits, DecodeContainerOptions, MapPoolOptions } from "@meshquilt/core";
import type { EncodeMeshOptions } from "@meshquilt/three";
import type { DracoWorkerPoolOptions } from "@meshquilt/draco";
const quant: QuantBits = { positionBits: 14 };
const encode: EncodeGeometryOptions = { ...quant, encodeChunk: () => new Uint8Array([1]) };
const mesh: EncodeMeshOptions = encode;
const decode: DecodeContainerOptions = { copyChunks: false };
const pool: MapPoolOptions = {};
const worker: DracoWorkerPoolOptions = { workerUrl: "worker.js", encoderScriptUrl: "encoder.js" };
void [mesh, decode, pool, worker];
`
    );
    const tsc = join(consumer, "node_modules", "typescript-compiler", "bin", "tsc");
    run(
        process.execPath,
        [
            tsc,
            "--noEmit",
            "--strict",
            "--skipLibCheck",
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
    console.log("Packed package declarations: NodeNext consumer passed.");
} finally {
    if (/^meshquilt-package-check-[A-Za-z0-9]+$/.test(relative(tmpdir(), consumer))) {
        await rm(consumer, { recursive: true, force: true });
    } else {
        console.error(`Refusing cleanup outside the task's temporary directory: ${consumer}`);
        process.exitCode = 1;
    }
}
