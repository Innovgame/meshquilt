import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
    resolve: {
        alias: {
            "@meshquilt/core": fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url)),
            "@meshquilt/three": fileURLToPath(new URL("../../packages/three/src/index.ts", import.meta.url))
        }
    },
    server: {
        port: 5173
    }
});
