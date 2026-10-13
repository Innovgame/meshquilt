import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
    testDir: "./tests",
    fullyParallel: false,
    workers: 1,
    reporter: "list",
    timeout: 30000,
    use: {
        baseURL: "http://127.0.0.1:4174/meshquilt/",
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
        launchOptions: { args: ["--enable-unsafe-swiftshader"] }
    },
    projects: [
        { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 960 } } },
        {
            name: "mobile",
            use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
        },
        {
            name: "library-workers",
            testDir: "../../packages/meshquilt/test/browser",
            testMatch: "**/workers.spec.ts",
            outputDir: "../../.tmp/library-workers"
        },
        {
            name: "library-performance",
            testDir: "../../packages/meshquilt/bench",
            testMatch: "**/*.perf.spec.ts",
            outputDir: "../../.tmp/performance/playwright",
            timeout: 120_000,
            use: { launchOptions: { args: ["--enable-precise-memory-info"] } }
        }
    ],
    webServer: {
        command: "pnpm build && pnpm preview --port 4174 --strictPort",
        url: "http://127.0.0.1:4174/meshquilt/",
        reuseExistingServer: false,
        timeout: 120000,
        env: { SITE_BASE: "/meshquilt/", VITE_REPOSITORY_URL: "https://github.com/example/meshquilt" }
    }
});
