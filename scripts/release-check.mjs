import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = process.env.MESHQUILT_RELEASE_ROOT ?? fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const tagged = args.indexOf("--tag");
const tag = tagged >= 0 ? args[tagged + 1] : args[0];
const prepare = args.includes("--prepare");

try {
    const folder = resolve(root, "packages/meshquilt");
    const manifestPath = resolve(folder, "package.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    const workspace = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
    if (manifest.name !== "meshquilt" || manifest.private)
        throw new Error("Release must use the publishable meshquilt package.");
    if (workspace.version !== manifest.version)
        throw new Error("Workspace version must match the published package version.");
    const versionMatch =
        /^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(tag ?? "");
    const invalidPrerelease = versionMatch?.[1]?.split(".").some((part) => /^0\d+$/.test(part));
    if (tag !== `v${manifest.version}` || !versionMatch || invalidPrerelease) {
        throw new Error(`Release tag must match version v${manifest.version} exactly.`);
    }

    const changelog = await readFile(resolve(root, "CHANGELOG.md"), "utf8");
    const sections = new Map();
    for (const match of changelog.matchAll(/^## ([^\r\n]+)\r?\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm)) {
        sections.set(match[1].trim(), match[2].trim());
    }
    if (!sections.has("Unreleased")) throw new Error("Changelog must contain an Unreleased section.");
    if (sections.get("Unreleased"))
        throw new Error("Move Unreleased changes into the release's changelog entry first.");
    const releaseNotes = sections.get(manifest.version);
    if (!releaseNotes || !/\S/.test(releaseNotes))
        throw new Error(`Changelog needs a nonempty ${manifest.version} release entry.`);

    if (prepare) {
        const repository = process.env.GITHUB_REPOSITORY;
        const [owner, name] = repository?.split("/") ?? [];
        if (
            !repository ||
            repository.split("/").length !== 2 ||
            !/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(owner ?? "") ||
            !/^[A-Za-z0-9_.-]{1,100}$/.test(name ?? "") ||
            name === "." ||
            name === ".."
        ) {
            throw new Error("Metadata preparation requires a valid GITHUB_REPOSITORY=owner/repo.");
        }
        const url = `https://github.com/${repository}`;
        manifest.repository = { type: "git", url: `git+${url}.git`, directory: "packages/meshquilt" };
        manifest.homepage = `${url}#readme`;
        manifest.bugs = { url: `${url}/issues` };
        await writeFile(manifestPath, `${JSON.stringify(manifest, null, 4)}\n`);
    }

    const npmTag = manifest.version.includes("-") ? "next" : "latest";
    console.log(`Release validated: meshquilt@${manifest.version}, npm tag ${npmTag}.`);
    if (process.env.GITHUB_OUTPUT) await writeFile(process.env.GITHUB_OUTPUT, `npm_tag=${npmTag}\n`, { flag: "a" });
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
}
