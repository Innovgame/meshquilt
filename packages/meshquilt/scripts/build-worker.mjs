import { build } from "esbuild";
import { fileURLToPath } from "node:url";

await build({
    entryPoints: [fileURLToPath(new URL("../src/runtime/worker.ts", import.meta.url))],
    outfile: fileURLToPath(new URL("../worker/encode.worker.js", import.meta.url)),
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2022",
    banner: { js: "// Generated from src/runtime/worker.ts. Run pnpm --filter meshquilt build; do not edit." }
});
