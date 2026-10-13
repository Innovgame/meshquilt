import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { build } from "esbuild";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";
import type { Plugin } from "vite";

function codecAssets(): Plugin {
    const assets = new Map<string, Uint8Array>();
    return {
        name: "meshquilt-local-codec",
        async buildStart() {
            const folder = dirname(createRequire(import.meta.url).resolve("draco3d"));
            const worker = await build({
                entryPoints: [
                    fileURLToPath(new URL("../../packages/meshquilt/src/runtime/worker.ts", import.meta.url))
                ],
                bundle: true,
                write: false,
                platform: "browser",
                format: "iife",
                target: "es2022"
            });
            assets.set("encode.worker.js", worker.outputFiles[0]!.contents);
            assets.set("draco_encoder.js", await readFile(join(folder, "draco_encoder_nodejs.js")));
            const decoder = await readFile(join(folder, "draco_decoder_nodejs.js"), "utf8");
            assets.set(
                "draco_decoder.js",
                new TextEncoder().encode(`${decoder}\nexport default DracoDecoderModule;\n`)
            );
            for (const name of ["draco_encoder.wasm", "draco_decoder.wasm"])
                assets.set(name, await readFile(join(folder, name)));
        },
        configureServer(server) {
            server.middlewares.use((request, response, next) => {
                const path = new URL(request.url ?? "/", "http://localhost").pathname;
                const name = path.split("/assets/codec/")[1];
                const source = name && assets.get(name);
                if (!source) return next();
                response.setHeader("Content-Type", name.endsWith(".wasm") ? "application/wasm" : "text/javascript");
                response.end(source);
            });
        },
        generateBundle() {
            for (const [name, source] of assets)
                this.emitFile({ type: "asset", fileName: `assets/codec/${name}`, source });
        }
    };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "");
    const repository = process.env.GITHUB_REPOSITORY;
    const name = repository?.split("/")[1];
    const base = env.SITE_BASE?.trim() || (name && !name.endsWith(".github.io") ? `/${name}/` : "/");
    const repoUrl = env.VITE_REPOSITORY_URL ?? (repository ? `https://github.com/${repository}` : "");
    const siteUrl = env.VITE_SITE_URL || (repository ? `https://${repository.split("/")[0]}.github.io${base}` : "");
    return {
        base,
        plugins: [
            react(),
            tailwindcss(),
            codecAssets(),
            {
                name: "meshquilt-site-metadata",
                transformIndexHtml(html) {
                    if (!siteUrl) return html;
                    const canonical = new URL(siteUrl).href;
                    const socialImage = new URL(
                        "social-card.png",
                        canonical.endsWith("/") ? canonical : `${canonical}/`
                    ).href;
                    return {
                        html: html.replace(/(<meta property="og:image" content=")[^"]*/, `$1${socialImage}`),
                        tags: [
                            { tag: "link", attrs: { rel: "canonical", href: canonical }, injectTo: "head" },
                            { tag: "meta", attrs: { property: "og:url", content: canonical }, injectTo: "head" },
                            { tag: "meta", attrs: { name: "twitter:image", content: socialImage }, injectTo: "head" }
                        ]
                    };
                }
            }
        ],
        resolve: {
            alias: [
                { find: "@", replacement: fileURLToPath(new URL("./src", import.meta.url)) },
                {
                    find: "meshquilt/draco",
                    replacement: fileURLToPath(
                        new URL("../../packages/meshquilt/src/codecs/draco/index.ts", import.meta.url)
                    )
                },
                {
                    find: "meshquilt",
                    replacement: fileURLToPath(new URL("../../packages/meshquilt/src/index.ts", import.meta.url))
                }
            ]
        },
        define: { __REPOSITORY_URL__: JSON.stringify(repoUrl) },
        build: {
            rolldownOptions: {
                output: {
                    manualChunks(id) {
                        if (id.includes("/node_modules/three/")) return "three";
                        if (id.includes("/node_modules/react-markdown/") || id.includes("/node_modules/remark-gfm/"))
                            return "markdown";
                    }
                }
            }
        }
    };
});
