import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
    resolve: {
        alias: {
            "meshquilt/draco": fileURLToPath(
                new URL("../../packages/meshquilt/src/codecs/draco/index.ts", import.meta.url)
            ),
            meshquilt: fileURLToPath(new URL("../../packages/meshquilt/src/index.ts", import.meta.url))
        }
    },
    server: {
        port: 5173
    }
});
