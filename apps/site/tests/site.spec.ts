import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("homepage renders actual geometry under a Pages subpath without browser errors", async ({ page }) => {
    const errors: string[] = [];
    const failures: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => {
        if (response.status() >= 400) failures.push(response.url());
    });
    await page.goto("./");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("One mesh.");
    await expect(page.locator(".mesh-canvas canvas")).toBeVisible();
    await expect(page.locator(".preview-stats")).toContainText("7,200");
    await expect(page.locator(".package-card")).toHaveCount(3);
    await expect(page.locator(".hero-buttons a").last()).toHaveAttribute(
        "href",
        "https://github.com/example/meshquilt"
    );
    await page.screenshot({ path: `../../.tmp/site-home-${test.info().project.name}.png`, fullPage: true });
    expect(errors).toEqual([]);
    expect(failures).toEqual([]);
});

test("mesh controls and conceptual comparison respond to keyboard and clicks", async ({ page }) => {
    await page.goto("./");
    const slider = page.getByRole("slider", { name: "Chunk separation" });
    await slider.focus();
    await page.keyboard.press("End");
    await expect(slider).toHaveAttribute("aria-valuenow", "100");
    const wireframe = page.getByRole("button", { name: "Toggle wireframe" });
    await wireframe.click();
    await expect(wireframe).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Reset preview controls" }).click();
    await expect(slider).toHaveAttribute("aria-valuenow", "0");
    await expect(wireframe).toHaveAttribute("aria-pressed", "false");
    await page.getByRole("button", { name: "Per-chunk grid" }).click();
    await expect(page.locator(".seam-result")).toContainText("Independent grids");
    await page.getByRole("button", { name: "Shared grid" }).click();
    await expect(page.locator(".seam-result")).toContainText("Aligned boundaries");
});

test("language and theme persist and documentation follows the selected language", async ({ page }) => {
    await page.goto("./");
    await page.getByRole("button", { name: "Switch to Chinese" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("一个网格");
    await page.getByRole("button", { name: "切换深色主题" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("一个网格");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.goto("./#/docs/quick-start");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("快速上手");
    await expect(page.locator(".markdown-content")).toContainText("单个 Draco 模块不可重入");
    await page.screenshot({ path: `../../.tmp/site-docs-zh-dark-${test.info().project.name}.png`, fullPage: true });
    await page.getByRole("button", { name: "切换到英文" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Quick start");
});

test("search has useful results, empty state, navigation, and escape dismissal", async ({ page }) => {
    await page.goto("./");
    await page.keyboard.press("Control+k");
    const search = page.getByRole("textbox", { name: "Search documentation" });
    await expect(search).toBeFocused();
    await search.fill("quantization");
    await page.locator(".search-result").filter({ hasText: "Quantization & seams" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Quantization and seams");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: "Open search" }).click();
    await search.fill("no-document-matches-this");
    await expect(page.getByText("No matching pages")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Open search" })).toBeFocused();
});

test("code tabs change examples and copying uses the actual displayed code", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "Chromium clipboard permissions required");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("./");
    await page.getByRole("tab", { name: "Worker pool" }).click();
    await expect(page.getByRole("tabpanel")).toContainText("pool.dispose()");
    await page.getByRole("button", { name: "Copy code" }).click();
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toContain("createDracoWorkerPool");
    expect(clipboard).toContain("concurrency: 2");
    await expect(page.getByText("Copied", { exact: true })).toBeVisible();
});

test("all docs load directly, survive refresh, and use valid internal navigation", async ({ page }) => {
    for (const id of [
        "introduction",
        "quick-start",
        "core",
        "three",
        "draco",
        "quantization",
        "container-format",
        "contributing",
        "changelog"
    ]) {
        await page.goto(`./#/docs/${id}`);
        await expect(page.locator(".markdown-content h1")).toBeVisible();
        await expect(page.locator(".docs-nav-group a[aria-current=page]")).toHaveCount(1);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
    await page.goto("./#/docs/core");
    await page.reload();
    await expect(page.locator("h1")).toHaveText("@meshquilt/core");
    await page.locator(".markdown-content").getByRole("link", { name: "container format" }).click();
    await expect(page.locator("h1")).toHaveText("Container format");
    await page.goto("./#/docs/missing");
    await expect(page.locator("h1")).toHaveText("Page not found");
});

test("homepage and docs have no serious accessibility violations", async ({ page }) => {
    await page.goto("./");
    await expect(page.locator(".mesh-canvas canvas")).toBeVisible();
    const home = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(home.violations).toEqual([]);
    await page.goto("./#/docs/introduction");
    await expect(page.locator("h1")).toHaveText("Meet MeshQuilt");
    const docs = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(docs.violations).toEqual([]);
});

test("mesh route opens the preview, back to top works, and no-WebGL browsers get a fallback", async ({ page }) => {
    await page.goto("./#/playground");
    await expect(page.locator(".mesh-preview")).toBeInViewport();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.getByRole("link", { name: "Back to top" }).click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await page.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
            value: function (this: HTMLCanvasElement, ...args: Parameters<typeof original>) {
                if (String(args[0]).startsWith("webgl")) return null;
                return original.apply(this, args);
            }
        });
    });
    await page.reload();
    await expect(page.locator(".mesh-fallback")).toContainText("3D preview needs WebGL");
    await expect(page.getByRole("link", { name: "Start building" })).toBeVisible();
});

test("mobile menu and both themes fit narrow viewports", async ({ page }, testInfo) => {
    await page.goto("./");
    if (testInfo.project.name === "mobile") {
        await page.getByRole("button", { name: "Open navigation" }).click();
        await page
            .getByRole("navigation", { name: "Mobile navigation" })
            .getByRole("link", { name: "Documentation" })
            .click();
        await expect(page.locator("h1")).toHaveText("Meet MeshQuilt");
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await page.goto("./");
    }
    for (const width of [375, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
    await page.getByRole("button", { name: "Switch to dark theme" }).click();
    await page.screenshot({ path: `../../.tmp/site-home-dark-${testInfo.project.name}.png`, fullPage: true });
    const dark = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(dark.violations).toEqual([]);
});
