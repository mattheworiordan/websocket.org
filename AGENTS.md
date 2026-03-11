# AGENTS.md - AI Coding Assistant Guidelines

## Project Context

WebSocket.org is the canonical resource for WebSocket protocol implementation.
This is an Astro-based static site with strict quality standards.

## MANDATORY: Pre-Commit Workflow

### The Pre-Commit Hook

The `.husky/pre-commit` hook runs on ALL staged files:

1. **markdownlint** on staged `.md` and `.mdx` files
2. **prettier --check** on staged code files (`.js`, `.jsx`, `.ts`, `.tsx`,
   `.astro`, `.css`, `.md`, `.mdx`)
3. **astro check** (TypeScript)

If ANY check fails, the commit is rejected. There is no way to bypass this.

### The Workflow You MUST Follow

**After every edit, before staging or claiming work is done:**

```bash
# Step 1: Auto-fix what can be auto-fixed
npm run lint:fix

# Step 2: Verify ZERO errors remain (auto-fix cannot fix everything)
npm run lint
# If errors remain, FIX THEM MANUALLY, then re-run lint:fix && lint

# Step 3: Format with prettier
npm run format

# Step 4: Verify lint still passes after formatting
npm run lint
# If errors, repeat from step 1
```

### "Pre-Existing" Errors Are YOUR Problem

The pre-commit hook runs on ALL staged files, not just the lines you changed. If
you touch a file that has pre-existing lint errors, those errors WILL block your
commit. You MUST fix them. Do not dismiss errors as "pre-existing" - if they're
in a file you're staging, they're your responsibility.

### NEVER Consider Work Complete If

- `npm run lint` shows ANY errors (not warnings - errors)
- `npm run format` produces changes you haven't re-linted
- You haven't run the full 4-step workflow above
- You only ran checks on the files you edited (run the full `npm run lint` which
  checks ALL files)

## Known Lint Rules That Bite

### MD036: Emphasis as Heading

Standalone italic or bold lines are treated as headings. This WILL fail:

```markdown
_Figure 1: My diagram_
```

Fix: Remove the emphasis markup:

```markdown
Figure 1: My diagram
```

### MD013: Line Length

- Max 120 characters for prose, 80 for headings
- Code blocks and tables are exempt
- FAQ body text in content sections often exceeds this - wrap to stay under

### MD037: Spaces Inside Emphasis

`{/* prettier-ignore */}` triggers this because `*` inside emphasis markers. Do
NOT use JSX comments in markdown files for prettier control.

### MD033: HTML in Markdown

Only these HTML/JSX elements are allowed: `div`, `span`, `a`, `img`, `br`,
`script`, `style`, `details`, `summary`, `sup`, `sub`, `p`, `strong`, `h2`,
`pre`, `AuthorBio`, `SEOMetadata`, `CardGrid`, `Card`, `LinkCard`, `Tabs`,
`TabItem`.

## Prettier + MDX: Known Incompatibility

Prettier's `proseWrap: "always"` collapses multi-line code inside `<Tabs>` and
`<TabItem>` JSX components in MDX files. MDX files are excluded from prettier
via `.prettierignore`. Do NOT remove this exclusion.

If you need to ignore prettier for a specific block in a `.md` file, use an HTML
comment:

```markdown
<!-- prettier-ignore -->
```

Do NOT use JSX-style comments (`{/* */}`) - they trigger MD037.

## CTR Optimization Task Pattern

When doing "Fix CTR" tasks from the content strategy, each page needs:

### Frontmatter Changes

- **title**: 50-60 characters, keyword-front-loaded
- **description**: 120-160 characters, compelling with keyword
- **lastUpdated**: Bare date format `2026-03-10` (no quotes needed, Starlight
  handles it)
- **keywords**: Top-level array of targeted search terms
- **seo.keywords**: Array of SEO-specific keywords
- **faq**: Array of `{q, a}` objects for JSON-LD FAQPage schema
- **authorRole**: Add `Co-founder & CEO, Ably` if missing

### Content Additions

- **Quick Answer callout**: Immediately after frontmatter, using
  `:::note[Quick Answer]` syntax
- **FAQ body section**: `## Frequently Asked Questions` with `### Question`
  subheadings matching the frontmatter FAQ entries
- **Related Content**: `## Related Content` with 5 internal cross-links

### Schema Support

FAQPage JSON-LD is auto-generated from frontmatter `faq` array by
`src/components/head.astro`. The `faq` field is defined in
`src/content/config.ts`.

## Repository Structure

```text
src/
├── content/docs/     # Main documentation (Markdown/MDX)
│   ├── guides/       # How-to guides and tutorials
│   ├── reference/    # API and protocol references
│   ├── comparisons/  # Protocol comparisons
│   ├── resources/    # Resource lists
│   └── tools/        # Interactive tools documentation
├── assets/           # Images and static files
└── components/       # Astro components (head.astro has JSON-LD)
```

## Content Guidelines

### Page Structure

- **IMPORTANT**: Never add a top-level heading (`# Title`) in content pages
- The page title is automatically generated from the frontmatter `title` field
- Start content directly after frontmatter or with `## H2` sections

### Writing Standards

- **Opinionated and specific**: Make recommendations, state trade-offs, cover
  failure modes. Not "there are several options" but "use X because Y"
- **Production-focused**: Beyond MDN's API docs — error handling, deployment,
  scaling, monitoring. Code examples must work in production, not just localhost
- **Concise**: Max 3-5 sentences before first code example. No philosophical
  intros. Cut filler aggressively
- **Code limits**: Inline examples 10-30 lines, full implementations 50-100
  lines max. Never 150+ lines without interruption
- Include infrastructure configs (Nginx, AWS ALB, etc.)
- Provide language-specific implementations
- Wrap prose at 80 characters (prettier enforces this for markdown)
- See `docs/content-style-guide.md` for full voice and formatting standards

## Ably Link Tracking (UTM Parameters)

All links to `ably.com`, `ably.io`, and `go.ably.com` MUST include UTM tracking
parameters:

```
?utm_source=websocket-org&utm_medium={page-section}
```

Where `{page-section}` is derived from the content file's slug/path (e.g.,
`road-to-websockets`, `websocket-api`, `community`, `echo-server`).

- If the URL already has query parameters, use `&utm_source=...` instead of `?`
- If adding UTM params pushes a line over 120 characters, use a markdown
  reference-style link with the definition at the bottom of the file:

  ```markdown
  See [Ably's guide][ably-guide] for details.

  [ably-guide]:
    https://ably.com/topic/websockets?utm_source=websocket-org&utm_medium=my-page
  ```

- Do NOT add UTM params to email addresses (e.g., `matt@ably.com`)

## WebSocket-Specific Standards

- Use `wss://echo.websocket.org` for examples (working echo server)
- Reference RFC 6455 (base), RFC 8441 (HTTP/2), RFC 9220 (HTTP/3)
- Include error handling and reconnection patterns in examples
- Document browser compatibility accurately

## ASCII Diagrams

- Count exact character positions for alignment
- Vertical lines must align precisely at consistent column positions
- View raw markdown to verify alignment, not rendered output
- Always use ` ```text ` fence for ASCII art

## Staging & Commit Messages

- Only stage the websocket.org repo (not websocket.org-tools)
- Commit messages must describe ALL staged files, not just the last one edited
- Use conventional commit format: `feat:`, `fix:`, `docs:`, `chore:`
- Keep first line under 72 characters

## Key Documentation Files

- `/docs/content-style-guide.md` - Writing standards and style guidelines
- `/docs/development-setup.md` - Development environment setup
- `/docs/redirect-management.md` - URL redirect configuration
- `package.json` - Available npm scripts (`lint`, `lint:fix`, `format`,
  `format:check`)

Remember: This site aims to be the #1 canonical WebSocket resource. Quality over
speed.
