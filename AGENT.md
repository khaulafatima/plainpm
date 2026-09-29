# AGENT.md — PlainPM

Guidance for AI coding agents (and humans) working in this repository.

## What this project is

**PlainPM** is project management in plain text, versioned with Git. It tracks **PRDs** and **issues** and **handoff** as plain files in a Git repo. There is no server and no database of record.

Core principle, never violate it:

> **Files are the source of truth. Everything else (index, UI, automation) is a disposable, rebuildable derivative.**

## Tech stack (assumed — update if it changes)

- Language: TypeScript on Node.js (LTS)
- Package manager: npm
- Schemas: JSON Schema (draft 2020-12), validated with Ajv
- Local index: SQLite (`better-sqlite3`), stored in `.plainpm/index.sqlite`, always gitignored
- Tests: Vitest
- CLI binary: `plainpm` (alias `ppm`)

## Repository layout

```
plainpm/
├── packages/
│   ├── core/          # parsing, serializing, ID allocation, schema types
│   ├── validator/     # schema, workflow, referential-integrity, uniqueness checks
│   ├── indexer/       # builds/updates the SQLite cache from files
│   ├── cli/           # `plainpm` commands
│   └── viewer/        # optional read-only web/TUI (added last)
├── schemas/           # versioned JSON Schemas (source of truth for the format)
├── examples/          # sample workspaces used in tests and docs
├── docs/              # format spec and architecture docs
└── AGENT.md
```

## The workspace format (what PlainPM reads and writes)

```
<workspace>/
├── plainpm.yml                  # root manifest (project key, issue types, defaults, schema_version)
├── config/
│   ├── workflow.yml              # allowed statuses + transitions
│   └── labels.yml
├── prds/
│   └── PRD-1-signup-flow/
│       ├── prd.md                # YAML frontmatter + Markdown prose
│       ├── issues/
│       │   └── PRD-1-001.yml     # one issue = one file (frontmatter + Markdown body)
│       ├── .next-id              # per-PRD ID counter
│       └── attachments/
├── backlog/issues/               # issues not attached to any PRD
└── .plainpm/                     # gitignored: index cache
```

(Epics may be added as a grouping level above PRDs: `epics/<epic>/prds/<prd>/issues/`. See `docs/`.)

## Non-negotiable design rules

1. **One entity per file.** Never bundle multiple issues/PRDs into one file.
2. **Folders mirror hierarchy.** Moving an issue between PRDs is a `git mv`.
3. **IDs live in frontmatter, not in paths.** The `id` field is the identifier; file location is a convenience. Links reference `id`s.
4. **Line-oriented, diff-friendly text.** One field per line. No minified or single-line JSON blobs.
5. **Append-only comments.** New comments go below the marker `<!-- append below -->`. Never rewrite existing comment lines.
6. **Explicit `rank` fields** for ordering. Never depend on filename sort order, and never rename files to reorder.
7. **The index is never authoritative.** Writes go to files, never directly to SQLite. Deleting `.plainpm/` must lose no data.
8. **Never commit the index cache or secrets.** `.plainpm/` and `.env` stay gitignored.
9. **Every file carries `schema_version`** (or inherits it from `plainpm.yml`). Format changes ship with a migration command, never silent dual-format support.
10. **Preserve unknown fields and comments** when rewriting a file. Round-tripping must not destroy user content or reorder keys.

## Validation pipeline (order matters, fail fast)

1. Schema validation (required fields, types)
2. Enum/workflow validation (legal `status`, legal transitions)
3. Referential integrity (every `links.*` and `prd:` reference resolves to an existing `id`)
4. Uniqueness (no duplicate IDs anywhere)

Any change to the format must update `schemas/`, the validator, the docs, and the example workspaces together.

## Commands

```bash
pnpm install          # install dependencies
pnpm build            # build all packages
pnpm test             # run all tests
pnpm test --filter core
pnpm lint             # eslint + prettier check
pnpm typecheck        # tsc --noEmit

plainpm init          # scaffold a workspace
plainpm validate      # run the validation pipeline
plainpm index         # rebuild the local SQLite index
plainpm list --status=in-progress --assignee=dan
plainpm show PRD-1-002
plainpm migrate       # apply schema migrations
```

## Coding conventions

- TypeScript `strict` mode. No `any` without a comment explaining why.
- Pure functions in `core` and `validator`. Filesystem access is isolated to thin adapters so logic is testable with in-memory inputs.
- Use a YAML library that preserves comments and key order for any write path.
- Errors from the validator must include file path, line (when available), the offending `id`, and a clear fix hint.
- CLI output: human-readable by default, `--json` for machine-readable output on every command.
- Keep dependencies minimal. Justify any new dependency in the PR description.

## Testing expectations

- Every validator rule needs a passing case and a failing case in `examples/` fixtures.
- Round-trip tests: parse then serialize must produce a byte-identical file when nothing changed.
- Concurrency tests: simulate two branches editing different fields of one issue, and appending comments to one issue, and assert clean merges.
- Index tests: build from fixtures, delete, rebuild, and assert identical results.
- Never write tests that depend on the real clock or random IDs. Inject them.

## Git and PR conventions

- Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).
- Schema changes and their migration script land in the same PR, labeled `schema-change`.
- Migration PRs that rewrite user files must be separate from feature PRs so the diff is reviewable.
- Keep PRs focused; one concern per PR.

## Things agents should NOT do

- Do not add a database, server, or hosted dependency as a source of truth.
- Do not auto-reformat or reorder users' workspace files as a side effect of unrelated commands.
- Do not delete or renumber IDs, and do not reuse an ID after deletion.
- Do not commit `.plainpm/`, `.env`, or generated build output.
- Do not introduce a second supported file format without an explicit design decision recorded in `docs/`.
- Do not silently swallow validation errors; surface them.

## Symlinks

Shared config (for example `config/workflow.yml`) may be a symlink to a central standards location. The validator must resolve symlinks before parsing and must not assume plain files. Do not use symlinks to place one issue in two PRDs; use `links.relates_to` instead.

## When in doubt

Prefer the option that keeps files human-editable, diffs small, and merges clean. If a change would make that harder, propose it in `docs/` before implementing.

## License

MIT (or Apache-2.0; confirm in `LICENSE`). Contributions require DCO sign-off (`git commit -s`).
