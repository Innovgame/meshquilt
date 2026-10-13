import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";

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
            alias: {
                "@": fileURLToPath(new URL("./src", import.meta.url)),
                meshquilt: fileURLToPath(new URL("../../packages/meshquilt/src/index.ts", import.meta.url))
            }
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
