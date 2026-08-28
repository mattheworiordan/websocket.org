# GitHub Actions Workflows

This directory contains automated workflows for the websocket.org repository.

## Workflows

### CI (`ci.yml`)

**Triggers:** Push to main, pull requests **Node:** version from `.nvmrc`
(currently 22) **Purpose:** Quality gates that match the local pre-commit hook

- Prettier (`npm run format:check`) — blocking
- markdownlint (`npm run lint`) — blocking
- `astro check` + production build (`npm run build`) — blocking

Lint and build run as separate jobs so a formatting failure does not hide a
build failure.

### Link Checker (`link-checker.yml`)

**Triggers:** Pull requests, weekly schedule (Mondays 3am UTC), manual
**Purpose:** Validates links in the built HTML

- Builds the site, then runs [lychee](https://github.com/lycheeverse/lychee)
  against `dist/**/*.html`
- Config lives in [`lychee.toml`](../../lychee.toml) at the repo root — exclude
  lists, per-host rate limits, and UTM remaps belong there, not inline in the
  workflow
- Caches results in `.lycheecache` across weekly runs
- Uses `GITHUB_TOKEN` so GitHub.com links are not anonymous-rate-limited
- Posts a PR comment on failure

Local run (requires [lychee](https://lychee.cli.rs/) on `PATH`, e.g.
`brew install lychee`):

```bash
npm run build
npm run check:links
```

Do not add example hosts (`yourdomain.com`, `http://backend`, …) or bot-blocked
sites (Reddit, Stack Overflow, LinkedIn) as content 404s — exclude them in
`lychee.toml`. Real documentation URLs that 404 should be fixed in the markdown.

### Structured Data Validation (`structured-data.yml`)

**Triggers:** Pull requests that touch content/components, manual **Purpose:**
Sanity-check JSON-LD and social meta tags after a build

- Fails if any `application/ld+json` block is not valid JSON
- Open Graph / Twitter Card presence is reported but non-blocking (the 404 page
  and a few custom routes do not share the Starlight head)

## Adding New Workflows

When adding new workflows:

1. Keep jobs focused and single-purpose
2. Use Node from `.nvmrc` via `actions/setup-node` `node-version-file`
3. Skip Husky on `npm ci` with `HUSKY: '0'`
4. Cache npm
5. Pin `permissions` to the least privilege the job needs
6. Document the workflow in this README
