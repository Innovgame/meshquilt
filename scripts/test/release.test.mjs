import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const script = fileURLToPath(new URL("../release-check.mjs", import.meta.url));
const changelog = "# Changelog\n\n## Unreleased\n\n## 1.2.3\n\n- A documented change.\n";

async function fixture(run, overrides = {}) {
    const root = await mkdtemp(join(tmpdir(), "meshquilt-release-test-"));
    const packageFolder = join(root, "packages/meshquilt");
    await mkdir(packageFolder, { recursive: true });
    const manifest = { name: "meshquilt", version: "1.2.3", ...overrides.manifest };
    await writeFile(
        join(root, "package.json"),
        JSON.stringify({ private: true, version: overrides.workspaceVersion ?? "1.2.3" })
    );
    await writeFile(join(packageFolder, "package.json"), JSON.stringify(manifest));
    await writeFile(join(root, "CHANGELOG.md"), overrides.changelog ?? changelog);
    const invoke = (args = [], repository = "") =>
        spawnSync(process.execPath, [script, "v1.2.3", ...args], {
            env: { ...process.env, MESHQUILT_RELEASE_ROOT: root, GITHUB_REPOSITORY: repository, GITHUB_OUTPUT: "" },
            encoding: "utf8"
        });
    try {
        await run({ invoke, packageFolder, manifest });
    } finally {
        await rm(root, { recursive: true, force: true });
    }
}

test("valid release checks are read-only and report the npm channel", async () => {
    await fixture(async ({ invoke, packageFolder, manifest }) => {
        const result = invoke();
        assert.equal(result.status, 0, result.stderr);
        assert.match(result.stdout, /meshquilt@1\.2\.3.*latest/);
        assert.deepEqual(JSON.parse(await readFile(join(packageFolder, "package.json"), "utf8")), manifest);
    });
});

test("tag must match the package version exactly", async () => {
    await fixture(async ({ invoke }) => {
        const result = invoke(["--tag", "v1.2.4"]);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /tag.*version/i);
    });
});

test("workspace and published versions must agree", async () => {
    await fixture(
        async ({ invoke }) => {
            const result = invoke();
            assert.notEqual(result.status, 0);
            assert.match(result.stderr, /workspace.*version/i);
        },
        { workspaceVersion: "1.2.4" }
    );
});

test("unreleased changes cannot be accidentally published under an old tag", async () => {
    await fixture(
        async ({ invoke }) => {
            const result = invoke();
            assert.notEqual(result.status, 0);
            assert.match(result.stderr, /Unreleased/);
        },
        { changelog: changelog.replace("## Unreleased\n", "## Unreleased\n\n- Not released yet.\n") }
    );
});

test("a release needs its own nonempty changelog entry", async () => {
    await fixture(
        async ({ invoke }) => {
            const result = invoke();
            assert.notEqual(result.status, 0);
            assert.match(result.stderr, /changelog/i);
        },
        { changelog: "# Changelog\n\n## Unreleased\n\n## 1.2.3\n" }
    );
});

test("only the intended public package is accepted", async () => {
    await fixture(
        async ({ invoke }) => {
            const result = invoke();
            assert.notEqual(result.status, 0);
            assert.match(result.stderr, /publishable.*meshquilt/i);
        },
        { manifest: { name: "@meshquilt/example-three", private: true } }
    );
});

test("metadata preparation uses the actual GitHub repository", async () => {
    await fixture(async ({ invoke, packageFolder }) => {
        const result = invoke(["--prepare"], "example-owner/meshquilt");
        assert.equal(result.status, 0, result.stderr);
        const metadata = JSON.parse(await readFile(join(packageFolder, "package.json"), "utf8"));
        assert.deepEqual(metadata.repository, {
            type: "git",
            url: "git+https://github.com/example-owner/meshquilt.git",
            directory: "packages/meshquilt"
        });
        assert.equal(metadata.bugs.url, "https://github.com/example-owner/meshquilt/issues");
        assert.equal(metadata.homepage, "https://github.com/example-owner/meshquilt#readme");
    });
});

test("metadata preparation fails before writing if the repository is unknown", async () => {
    await fixture(async ({ invoke, packageFolder, manifest }) => {
        const result = invoke(["--prepare"]);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /GITHUB_REPOSITORY/);
        assert.deepEqual(JSON.parse(await readFile(join(packageFolder, "package.json"), "utf8")), manifest);
    });
});

test("prerelease versions use the next npm tag", async () => {
    await fixture(
        async ({ invoke }) => {
            const result = invoke(["--tag", "v1.2.3-rc.1"]);
            assert.equal(result.status, 0, result.stderr);
            assert.match(result.stdout, /next/);
        },
        {
            workspaceVersion: "1.2.3-rc.1",
            manifest: { version: "1.2.3-rc.1" },
            changelog: changelog.replace("## 1.2.3", "## 1.2.3-rc.1")
        }
    );
});

test("release versions with leading zeroes are rejected", async () => {
    await fixture(
        async ({ invoke }) => {
            const result = invoke(["--tag", "v01.2.3"]);
            assert.notEqual(result.status, 0);
            assert.match(result.stderr, /version/i);
        },
        {
            workspaceVersion: "01.2.3",
            manifest: { version: "01.2.3" },
            changelog: changelog.replace("## 1.2.3", "## 01.2.3")
        }
    );
});

test("repository path segments cannot escape the owner/repository URL", async () => {
    await fixture(async ({ invoke, packageFolder, manifest }) => {
        const result = invoke(["--prepare"], "../meshquilt");
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /GITHUB_REPOSITORY/);
        assert.deepEqual(JSON.parse(await readFile(join(packageFolder, "package.json"), "utf8")), manifest);
    });
});
