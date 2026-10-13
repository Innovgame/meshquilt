import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        alias: {
            "meshquilt/draco": fileURLToPath(
                new URL("./packages/meshquilt/src/codecs/draco/index.ts", import.meta.url)
            ),
            meshquilt: fileURLToPath(new URL("./packages/meshquilt/src/index.ts", import.meta.url))
        }
    },
    test: {
        include: ["packages/*/test/**/*.test.ts", "examples/*/test/**/*.test.ts"],
        benchmark: { include: ["packages/*/bench/**/*.bench.ts"] }
    }
});
