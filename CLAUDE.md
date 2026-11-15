# Commands

- `bun run verify` — typecheck + Biome check; run before every commit
- `bun run lint` — Biome lint only
- `bun run build` — production build; run after moving or renaming files

# Code Quality

- **No over-engineering**: Use the simplest solution that works. Avoid premature abstractions, unnecessary helpers, or complex patterns for simple problems
- **Minimal code**: Write the fewest lines necessary. Avoid verbose patterns, redundant variables, and unnecessary intermediate steps
- **Follow linting rules**: Satisfy exhaustive-deps and other lint rules without using eslint-disable unless absolutely necessary
- **Clear comments**: Add comments only when logic isn't self-evident. Explain "why", not "what"

# Project Structure

- Read `docs/project-structure.md` before adding, moving or renaming files
- Code lives in `src/`: domain code in `src/features/<name>/`, route-only code in `src/app/<route>/_components/`, shared code in `src/components|hooks|lib|stores|types`
- Shared code never imports from `features` or `app`; no barrel files

# Design System

- Read `docs/ui-minimal.md` (or `docs/ui.md` for full reference) before implementing or modifying any UI
- Use the pre-styled shadcn components in `src/components/ui/`, editorial tokens, and layout patterns defined there

# Keeping Docs Current

Update docs in the same change as the code they describe:

- Folder layout, placement rules, import rules or naming conventions change → update `docs/project-structure.md`
- Path-dependent config changes (`tsconfig.json` paths, `components.json`, `drizzle.config.ts`, `biome.json`) → update the "Config that depends on paths" list in `docs/project-structure.md`
- Design tokens, shared UI patterns or `src/components/ui/` styling conventions change → update `docs/ui.md` and the matching entry in `docs/ui-minimal.md`
- Scripts in `package.json` change → update the Commands section above
- A rule here or in `docs/` no longer matches the code → fix or delete it rather than leaving it stale

How docs are written:

- State rules and link to the official reference (Next.js, shadcn/ui, library docs) instead of copying file trees, component lists or other content that goes stale; the code is the source of truth for what exists
- Reference files by path (`src/features/links/`), not by line numbers or pasted code
- Keep `docs/ui-minimal.md` a quick reference; put rationale and long examples in `docs/ui.md`
- When a reference link in this file or `docs/` is dead or redirects, replace it with the current URL, or remove it if the page no longer exists

# Editing This File

- Before changing CLAUDE.md, read [Memory](https://code.claude.com/docs/en/memory.md) and [Best practices](https://code.claude.com/docs/en/best-practices.md) and follow their guidance on structure, length and wording
