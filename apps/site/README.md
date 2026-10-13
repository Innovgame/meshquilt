# MeshQuilt website

The independent project website for GitHub Pages. Built with React 19, Vite 6, Tailwind CSS 4, shadcn-style Radix components, Lucide, and Three.js. No demo code or demo assets are used.

## Development

From the repository root:

```bash
pnpm install
pnpm site
pnpm site:build
pnpm site:preview
pnpm --filter @meshquilt/site exec playwright install chromium
pnpm site:test
```

English is the default. The language and light/dark theme persist locally. English package docs, quantization, container format, contribution guide, and changelog are imported directly from repository Markdown; Chinese translations and the website quick-start guide live in `src/lib/docs.ts`. Update translations when the source docs change. The version comes from the root package metadata.

The 3D preview calls `@meshquilt/core` with a generated indexed torus knot: 7,200 triangles split into 16 chunks of at most 450 triangles. It does not run Draco compression or claim benchmark results. WebGL failure has a readable fallback. Automatic rotation is opt-in, respects reduced motion, and pauses when the preview is outside the viewport or the tab is hidden.

## GitHub Pages

1. Push this repository to GitHub with a `main` branch.
2. In **Settings → Pages → Build and deployment**, set **Source** to **GitHub Actions**.
3. The `GitHub Pages` workflow runs desktop/mobile browser and accessibility checks, builds on pull requests, and deploys on pushes to `main` or manual runs. Approve the `github-pages` environment if your repository requires it.

The build derives the repository URL and project subpath from GitHub's environment. It also supports user/organization repositories named `*.github.io`, which use `/`. Hash routes make docs refreshable on Pages without a server rewrite or custom 404 script.

For a custom domain, configure it in GitHub Pages, add `public/CNAME` with your domain, and set repository Actions variable `SITE_BASE` to `/`.

Set Actions variable `VITE_SITE_URL` to your full custom URL for canonical and social metadata. By default, metadata uses the repository's `github.io` URL. The site includes a 1200×630 PNG sharing image with its editable SVG source.

## Local configuration

Optional `apps/site/.env.local`:

```dotenv
VITE_REPOSITORY_URL=https://github.com/your-org/meshquilt
SITE_BASE=/meshquilt/
VITE_SITE_URL=https://your-org.github.io/meshquilt/
```

An unset repository URL uses GitHub repository search during local development. No fabricated repository owner is embedded in the site. To preview a project-path build, open `/meshquilt/` on the preview server, not `/`.

Fonts are bundled locally. The only external navigation is to GitHub; the preview has no external model, Draco, or CDN dependency. Static identity assets live in `public/`. Accessible Radix dialog, tabs, and slider primitives are customized through the website's token system; `components.json` supports the shadcn CLI.

## Validation

```bash
pnpm check
pnpm test
pnpm site:build
pnpm site:test
```

Check the homepage and docs at desktop and mobile widths, language/theme switches, search (`Ctrl/Cmd+K`), code copying, keyboard navigation, and a production build under the repository subpath before shipping.
