import { defineConfig } from "@playwright/test";

export default defineConfig({
    fullyParallel: false,
    workers: 1,
    reporter: "list",
    timeout: 30_000,
    use: {
        // Every navigation, script and WASM request is fulfilled by the shared
        // fixture. This synthetic origin needs no HTTP server or website build.
        baseURL: "http://meshquilt.test/",
        trace: "retain-on-failure",
        screenshot: "only-on-failure"
    },
    projects: [
        {
            name: "library-workers",
            testDir: "./test/browser",
            testMatch: "**/workers.spec.ts",
            outputDir: "../../.tmp/library-workers"
        },
        {
            name: "library-performance",
            testDir: "./bench",
            testMatch: "**/*.perf.spec.ts",
            outputDir: "../../.tmp/performance/playwright",
            timeout: 120_000,
            use: { launchOptions: { args: ["--enable-precise-memory-info"] } }
        }
    ]
});
