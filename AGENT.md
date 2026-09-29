# AGENT.md — PlainPM

Guidance for AI coding agents (and humans) working in this repository.

## What this project is

**PlainPM** is project management in plain text, versioned with Git. It tracks **PRDs**, **issues**, and **handoffs** as plain files in a Git repo. There is no server and no database of record.

Core principle, never violate it:

> **Files are the source of truth. Everything else (index, UI, automation) is a disposable, rebuildable derivative.**

See [`docs/format-spec.md`](file:///Users/abuzarhamza/Desktop/workspaceGithub/plainpm/docs/format-spec.md) for the complete format specification and schema definitions.

## Tech stack (assumed — update if it changes)

- Language: TypeScript on Node.js (LTS)
- Package manager: npm
- Schemas: JSON Schema (draft 2020-12), validated with Ajv
- Local index: SQLite (`better-sqlite3`), stored in `.plainpm/index.sqlite`, always gitignored
- File watcher: Chokidar (rebuilds/updates SQLite index on file change)
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
│   └── basic-workspace/
├── docs/              # format spec and architecture docs
│   └── format-spec.md
├── skills/            # agent skills (to-prd, to-issues, ralph, tdd, hand-off, etc.)
└── AGENT.md
```

## The workspace format (what PlainPM reads and writes)

```
<workspace>/
├── .gitignore                   # ignores .plainpm/ and .env*
├── .env                         # local secrets (never committed)
├── plainpm.yml                  # root manifest (project key, defaults, schema_version)
├── config/
│   ├── workflow.yml             # allowed statuses (human + agent) & legal transitions
│   └── labels.yml               # project label vocabulary & colors
├── prds/
│   └── PRD-1-signup-flow/
│       ├── prd.md               # YAML frontmatter (with execution_order) + Markdown prose
│       ├── issues/
│       │   └── PRD-1-001.yml    # one issue = one file (agent-ready fields + Markdown body)
│       ├── .next-id             # per-PRD ID counter (committed to prevent collisions)
│       └── attachments/
├── backlog/
│   ├── issues/                  # issues not attached to any PRD (ACME-001.yml)
│   └── .next-id                 # backlog ID counter
├── handoffs/                    # session handoff documents (HANDOFF-<timestamp>.md)
└── .plainpm/                    # gitignored: disposable SQLite index cache
```

(Epics may be added as a grouping level above PRDs: `epics/<epic>/prds/<prd>/issues/`.)

## Non-negotiable design rules

1. **One entity per file.** Never bundle multiple issues, PRDs, or handoffs into one file.
2. **Folders mirror hierarchy.** Moving an issue between PRDs is a `git mv`.
3. **IDs live in frontmatter / file keys, not in paths.** The `id` field is the authoritative identifier; file location is a navigational convenience. Cross-references use `id` values.
4. **Canonical ID conventions:**
   - PRD-scoped issues: `<PRD-id>-<zero-padded-seq>` (e.g., `PRD-1-001`).
   - Backlog issues: `<project-key>-<zero-padded-seq>` (e.g., `ACME-001`).
   - Filenames match the ID (`<id>.yml`).
5. **Line-oriented, diff-friendly text.** One field per line. Multi-line text uses literal block scalars (`|-`). No minified or single-line JSON blobs.
6. **Append-only comments.** New comments go below the marker `# <!-- append below -->`. Never rewrite or reorder existing comment entries. Agents use author prefix `agent:<name>`.
7. **Explicit lexicographic `rank` fields for ordering.** Use string rank (`0|aaaaaa`) rather than floating-point math or filename sorting. Never rename files to reorder.
8. **The index is never authoritative.** Writes go to files first, never directly to SQLite. Deleting `.plainpm/` must lose no data.
9. **Never commit the index cache or secrets.** `.plainpm/` and `.env*` stay gitignored.
10. **Every file carries `schema_version`** (or inherits it from `plainpm.yml` via ancestor directory traversal). Format changes ship with a `plainpm migrate` command, never silent dual-format support.
11. **Preserve unknown fields and comments** when rewriting a file. Round-tripping must not destroy user content, unknown v2 fields, or reorder keys.
12. **Agent-ready by default.** Issues should provide structured context (`implementation_notes`, `test_strategy`, `acceptance_criteria` with `verify` commands, and `agent_context`) so coding agents can execute without cold-start discovery.

## Agent lifecycle & statuses

PlainPM workflows provide dedicated states to coordinate human and AI agent collaboration safely:

```
todo → ready_for_agent → agent_in_progress → agent_review → done
                │                 │                │
                ▼                 ▼                ▼
            cancelled      ready_for_agent    agent_in_progress
              (bail)        (agent release)     (rework needed)
```

- `ready_for_agent`: Issue is fully specified, blockers resolved, ready for autonomous execution.
- `agent_in_progress`: Claimed by an agent (`assignee: agent:<name>`). Other agents must not claim or modify.
- `agent_review`: Agent completed work and all acceptance criteria pass; waiting for human verification.
- Branches created by agents follow `<type>/<issue-id>-<slug>` (e.g. `feat/PRD-1-001-registration-form`).

## Validation pipeline (order matters, fail fast)

1. Schema validation (required fields, types against JSON Schema draft 2020-12)
2. Enum & workflow validation (legal `status`, legal transitions in `config/workflow.yml`)
3. Referential integrity:
   - Every `links.*` target resolves to an existing issue `id`.
   - `parent.prd` resolves to an existing PRD folder with `prd.md`.
   - `execution_order` in `prd.md` references valid issue `id`s.
4. Uniqueness (no duplicate IDs anywhere across the workspace)
5. Filename-to-ID parity (`<id>.yml` matches internal `id` key)

Any change to the format must update `schemas/`, the validator, `docs/format-spec.md`, and `examples/basic-workspace/` together.

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
plainpm list --status=ready_for_agent
plainpm show PRD-1-002
plainpm migrate       # apply schema migrations
plainpm rebalance     # recalculate evenly spaced lexicographic ranks
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
- Do not commit `.plainpm/`, `.env*`, or generated build output.
- Do not introduce a second supported file format without an explicit design decision recorded in `docs/`.
- Do not claim an issue already in `agent_in_progress`.
- Do not silently swallow validation errors; surface them.

## Symlinks

Shared config (for example `config/workflow.yml`) may be a symlink to a central standards location. The validator must resolve symlinks before parsing and must not assume plain files. Do not use symlinks to place one issue in two PRDs; use `links.relates_to` instead.

## When in doubt

Prefer the option that keeps files human-editable, diffs small, and merges clean. If a change would make that harder, propose it in `docs/` before implementing.

## License

MIT (or Apache-2.0; confirm in `LICENSE`). Contributions require DCO sign-off (`git commit -s`).
