# Repository Guidelines

## Project Structure & Module Organization

- `packages/meshquilt/src/` contains the array-first TypeScript codec: geometry processing, shared quantization, MQLT containers, Draco integration, and Worker runtime.
- `packages/meshquilt/test/` holds core, Draco, and browser tests; `bench/` holds performance suites.
- `apps/site/` contains the React/Vite website, browser tests in `tests/`, and static assets in `public/`.
- `examples/three/` is a private rendering integration with compatibility tests. Keep Three.js dependencies outside the publishable library.
- `docs/` and `docs/zh/` contain English and Chinese documentation; keep translations aligned. `scripts/` contains packaging and release verification.

## Build, Test, and Development Commands

Use pnpm 10.33.0 and a supported Node.js version: `^22.12.0 || ^24.0.0 || >=26.0.0`.

- `pnpm install --frozen-lockfile`: install workspace dependencies.
- `pnpm site`: run the local website.
- `pnpm build`: build the library and website; `pnpm build:lib` builds only the library.
- `pnpm check`: check Prettier formatting, ESLint rules, and TypeScript types.
- `pnpm test`: run Vitest unit and integration tests.
- `pnpm test:packages`: build, pack, and verify exports/declarations in an isolated consumer.
- `pnpm test:release`: test release guards without publishing.
- `pnpm test:workers` / `pnpm site:test`: run Playwright Worker or desktop/mobile website checks.
- `pnpm bench` / `pnpm bench:browser`: measure codec stages or browser responsiveness.

## Coding Style & Naming Conventions

Use four spaces, LF endings, semicolons, double quotes, no trailing commas, and a 120-column Prettier width. Run `pnpm check:fix` for formatting and lint fixes.

Use strict TypeScript, explicit type imports, and `.js` extensions for library-relative imports. Follow existing kebab-case filenames, camelCase functions/variables, and PascalCase types/components. ESLint requires strict equality; prefix intentionally unused parameters with `_`.

## Testing Guidelines

Name Vitest tests `*.test.ts`, Playwright tests `*.spec.ts`, and benchmarks `*.bench.ts`. Add regression coverage for changed behavior; no numeric coverage threshold is configured.

Before a PR, run `pnpm check`, `pnpm test`, `pnpm test:packages`, and `pnpm test:release`. Run relevant browser suites after installing Chromium with `pnpm --filter <workspace-name> exec playwright install chromium`.

## Commit & Pull Request Guidelines

Use short English conventional commits, matching history: `feat:`, `fix:`, `perf:`, `refactor:`, `docs:`, or `chore:`; scopes such as `feat(site):` are supported.

Follow `.github/pull_request_template.md`: describe observable changes and record verification. For container layout, shared-volume, or attribute-bit changes, explain which existing files still decode.

## Generated Assets

Edit `packages/meshquilt/src/runtime/worker.ts` and encoder sources, then rebuild. Do not hand-edit generated `packages/meshquilt/worker/encode.worker.js`; preserve its classic Worker export.
