import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        alias: {
            "@meshquilt/core": fileURLToPath(new URL("./packages/core/src/index.ts", import.meta.url)),
            "@meshquilt/draco": fileURLToPath(new URL("./packages/draco/src/index.ts", import.meta.url)),
            "@meshquilt/three": fileURLToPath(new URL("./packages/three/src/index.ts", import.meta.url))
        }
    },
    test: {
        include: ["packages/*/test/**/*.test.ts"]
    }
});
