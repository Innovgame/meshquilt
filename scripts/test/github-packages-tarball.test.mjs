import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { githubPackagesName, rewriteGitHubPackagesTarball } from "../github-packages-tarball.mjs";

test("GitHub Packages uses the repository owner scope", () => {
    assert.equal(githubPackagesName("Innovgame"), "@innovgame/meshquilt");
    assert.throws(() => githubPackagesName("not a scope"), /invalid/i);
});

test("the packed archive is renamed without changing other metadata", async () => {
    const root = await mkdtemp(join(tmpdir(), "meshquilt-gpr-test-"));
    try {
        const source = join(root, "source");
        await mkdir(join(source, "package"), { recursive: true });
        await writeFile(
            join(source, "package", "package.json"),
            JSON.stringify({ name: "meshquilt", version: "0.2.0", license: "MIT" })
        );
        const input = join(root, "meshquilt-0.2.0.tgz");
        const output = join(root, "github-packages.tgz");
        const packed = spawnSync("tar", ["-czf", input, "-C", source, "package"], { encoding: "utf8" });
        assert.equal(packed.status, 0, packed.stderr);

        const name = await rewriteGitHubPackagesTarball(input, output, "Innovgame");
        assert.equal(name, "@innovgame/meshquilt");

        const extracted = await mkdtemp(join(tmpdir(), "meshquilt-gpr-out-"));
        try {
            const unpacked = spawnSync("tar", ["-xzf", output, "-C", extracted], { encoding: "utf8" });
            assert.equal(unpacked.status, 0, unpacked.stderr);
            const manifest = JSON.parse(await readFile(join(extracted, "package", "package.json"), "utf8"));
            assert.equal(manifest.name, "@innovgame/meshquilt");
            assert.equal(manifest.version, "0.2.0");
            assert.equal(manifest.license, "MIT");
        } finally {
            await rm(extracted, { recursive: true, force: true });
        }
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
