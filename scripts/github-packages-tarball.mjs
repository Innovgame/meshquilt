import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function githubPackagesName(owner) {
    const scope = owner.trim().toLowerCase();
    if (!/^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$/.test(scope)) {
        throw new Error(`GitHub Packages owner is invalid: ${owner}`);
    }
    return `@${scope}/meshquilt`;
}

export async function rewriteGitHubPackagesTarball(tarball, output, owner) {
    const name = githubPackagesName(owner);
    const root = await mkdtemp(join(tmpdir(), "meshquilt-gpr-"));
    try {
        const extracted = spawnSync("tar", ["-xzf", resolve(tarball), "-C", root], { encoding: "utf8" });
        if (extracted.status !== 0) throw new Error(extracted.stderr || "Failed to read the package tarball.");
        const manifestPath = join(root, "package", "package.json");
        const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
        if (manifest.name !== "meshquilt") throw new Error(`Expected package name meshquilt, found ${manifest.name}.`);
        manifest.name = name;
        await writeFile(manifestPath, `${JSON.stringify(manifest, null, 4)}\n`);
        const packed = spawnSync("tar", ["-czf", resolve(output), "-C", root, "package"], { encoding: "utf8" });
        if (packed.status !== 0) throw new Error(packed.stderr || "Failed to write the GitHub Packages tarball.");
        return name;
    } finally {
        await rm(root, { recursive: true, force: true });
    }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const [tarball, output, owner] = process.argv.slice(2);
    if (!tarball || !output || !owner) {
        console.error("Usage: node scripts/github-packages-tarball.mjs <tarball> <output> <owner>");
        process.exitCode = 1;
    } else {
        const name = await rewriteGitHubPackagesTarball(tarball, output, owner);
        console.log(name);
    }
}
