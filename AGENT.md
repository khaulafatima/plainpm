# AGENT.md — PlainPM

Guidance for AI coding agents and humans working in this repository.

## Project and implementation status

PlainPM is Markdown-based project management, versioned with Git. Issues, PRDs, and handoffs are Markdown files with YAML frontmatter; configuration is YAML.

> Files are the source of truth. Everything else is a disposable, rebuildable derivative.

The authoritative draft contract is [docs/format-spec.md](docs/format-spec.md), with a structured companion at [docs/format-spec.v1.yaml](docs/format-spec.v1.yaml). Keep both synchronized; the YAML companion is not an executable JSON Schema. The repository currently contains a CLI scaffold, not a completed format implementation. Commands and packages described below are targets unless present in source. The draft has changed from YAML issues to Markdown issues; do not silently support both.

## Stack

- Current: TypeScript on Node.js, npm, yargs, tsup, Jest, ESLint.
- Planned: JSON Schema draft 2020-12 with Ajv; a YAML parser supporting concrete-syntax preservation; optional SQLite (`better-sqlite3`) and Chokidar after file-based operations work.
- CLI: `plainpm`; `ppm` is a proposed alias, not currently installed.
- Keep dependencies minimal and justify additions.

## Repository organization

The repository uses npm workspaces under `packages/`. The `plainpm` npm package lives in `packages/plainpm-cli/`, with CLI source in `src/`, tests in `tests/`, and generated output in `dist/` within that package. It provides the `plainpm` command, with no public JavaScript API. Package-local build and test configuration extends shared root tooling where applicable. The contract is in `docs/`, and reference workspaces in `examples/`. Skills live in `skills/`. Historical plans under `doc/` are not current-format fixtures.

As implementation grows, isolate core parsing/serialization, validation, filesystem adapters, CLI, and optional indexing/viewer modules. Do not describe unimplemented packages or schemas as existing features.

## Workspace layout

```text
<workspace>/
├── plainpm.yml
├── config/
│   ├── workflow.yml
│   └── labels.yml
├── prds/
│   └── <mutable-slug>/
│       ├── prd.md
│       ├── issues/
│       │   └── <project-key>-<random-token>.md
│       └── attachments/
├── backlog/
│   └── issues/
├── handoffs/
│   └── HANDOFF-<random-token>.md
└── .plainpm/                   # gitignored cache and transient locks
```

Ignore `.plainpm/` and `.env*`. Discover only managed paths listed in the format spec, not every Markdown/YAML file in the repository. Nested workspaces are separate. Epics are outside v1.

## Non-negotiable format rules

1. **One entity per file.** Issues, PRDs, and handoffs use Markdown with YAML frontmatter. Prose stays in the body; structured metadata and acceptance criteria stay in frontmatter.
2. **Random identity plus sequential issue aliases.** Immutable IDs use `<project-key>-<random-token>` for issues, `PRD-<random-token>` for PRDs, and `HANDOFF-<random-token>` for handoffs. Tokens are eight cryptographically random characters from `23456789abcdefghjkmnpqrstuvwxyz` and include at least one letter. Each issue also requires `short_id: <project-key>-<positive-integer>` (e.g. `ACME-1`). Allocate numbers across all PRDs/backlog under the workspace lock using committed `sequences.next_issue_number`; reserve before issue creation, allow gaps, and never decrease/reuse numbers. Cross-branch alias duplicates require explicit repair; only the alias changes. Resolve counters using the greatest integrated high-water mark. Reject ambiguous short-ID lookup. Stored references and filenames always use random IDs. Check collisions and inject randomness in tests. See spec §3.1 for allocation and recovery.
3. **Moves preserve identity.** Preserve both `id` and `short_id` when moving the issue file and updating `parent.prd`. Backlog uses `parent: null`. Resolve PRDs by their top-level `id`, then verify physical placement. Issue and handoff filenames equal `<id>.md`; PRDs use `prd.md`.
4. **One dependency source.** Store only `links.blocked_by`; derive reverse links and execution plans. `links.blocks` and PRD `execution_order` are forbidden. Reject unresolved links, self-links, and cycles across the whole workspace. Only `done` satisfies a blocker.
5. **Explicit ordering.** V1 ranks are six lowercase ASCII letters, interpreted as base-26 integers; sort by `(rank, id)`. Rebalance explicitly when no midpoint remains. Never rename files to reorder or silently rewrite sibling ranks.
6. **Append-only comments.** Use the Markdown comment block syntax in spec §7, with stable random comment IDs. Preserve existing bytes. Concurrent appends can conflict; retain distinct entries and surface conflicting content under one ID. V1 tooling never edits/deletes existing entries.
7. **Lossless edits.** Preserve unknown extension fields, YAML comments/key order, Markdown, and line endings. An unchanged parse/serialize must be byte-identical. Reject duplicate YAML keys, aliases, merge keys, and custom tags. Avoid formatting unrelated content.
8. **Files first.** The index is never authoritative. Deleting caches loses no project data or persisted ownership. Active transient locks must not be removed during cache cleanup.
9. **Explicit versions.** Inherit `schema_version` only within the nearest workspace boundary. Do not write unsupported versions. Migration is explicit and reviewable, with no automatic commit.
10. **External issue mappings.** Optional `external_links` entries require `provider`, string `external_id`, and an absolute HTTPS issue `url`. Validate shapes and reject duplicate exact `(provider, url)` mappings across the workspace without network access. IDs may be scoped by repository; never match on `external_id` alone. Preserve mappings on moves and short-ID repair. Links do not trigger sync or remote deletion; future sync must define direction and conflicts and write imported changes to validated local files. Never store provider credentials in issue files.
11. **Agent-ready, without duplicated prose.** Require acceptance criteria with verification instructions and non-empty implementation/test sections before readiness. Verify commands are untrusted data; parsing, indexing, and validation never execute them.

## Agent lifecycle and ownership

```text
todo → ready_for_agent → agent_in_progress → agent_review → done
                              ↓                  ↓
                       ready_for_agent    agent_in_progress
```

- Claim by atomically persisting status, agent assignee, branch, and `claim.session_id`/`claim.claimed_at` while holding the workspace writer lock. Reread state under the lock; reject a stale, claimed, or blocked issue.
- All cooperating CLI writers honor the same lock and expected-content checks. This coordinates one checkout, not independent clones/worktrees or arbitrary editors.
- While an issue is claimed, only the owning session may perform ordinary edits. Humans may explicitly release/take over. Never infer release from elapsed time or a handoff document.
- Crashed sessions retain ownership in the issue. Stale-lock recovery must prove the lock owner is no longer running or require explicit operator recovery.
- Independent checkouts require preassigned work or external coordination. Git/status fields do not provide distributed exclusivity.
- `agent_review` requires all criteria complete and human verification of manual criteria. Clear the active claim on leaving `agent_in_progress`. Only an explicitly human-initiated CLI action marks reviewed work `done`; names in files are not authentication.
- Rework creates a fresh claim with the same locking and blocker checks. Handoffs are historical context, not ownership records.
- Use `agent:<name>` for agent identity and `<type>/<issue-id>-<slug>` for branches (`feat`, `fix`, `spike`).
- Update Markdown agent context and create a handoff when unfinished work or unresolved decisions need continuation; otherwise it is optional. Require handoff `status: active | resolved`. Resolve or reopen explicitly with a reason and actor recorded in the body; refresh `updated_at` and navigation while preserving the originating session, author, historical lists, and associations. Status-only edits do not rederive PRDs, complete issues, or release claims. Keep one handoff per session per workspace in workspace-level `handoffs/` (or its configured path), never inside a PRD or in the OS temporary directory. Handoffs may span PRDs and backlog issues; use `context.prds` for optional PRD references and reject duplicate handoff session IDs. On explicit handoff creation or continuation-content save, union the current parent PRDs of resolvable referenced issues with explicitly selected planning PRDs and previous associations. Preserve historical associations across issue moves; only explicit corrections remove them. Missing historical references warn without being discarded. Reads, indexing, and navigation refresh never recompute associations. A resumed session updates its existing handoff in place, preserving ID, session ID, and creation time and refreshing required `updated_at`. A new session gets a new handoff. Only committed earlier summaries are preserved by Git.

PRDs expose clickable relative handoff links in a derived `## Handoffs` section bounded by `plainpm:handoffs:start`/`plainpm:handoffs:end` HTML comments. Resolve the relationship from handoff `context.prds`; never maintain a second authoritative relationship in PRD frontmatter. List all related handoffs by updated timestamp descending, breaking ties by ID ascending, and include the UTC updated date, active/resolved status, and ID in each label. Keep both statuses visible. Explicitly refresh links after association/path or updated-time changes, preserving authored prose; reads and indexing must not rewrite files. See spec §5.1.1.

## Validation pipeline

Follow spec §9; fail later stages when earlier errors make their inputs unreliable:

1. Scoped discovery, parsing, conflict-marker detection, version resolution.
2. JSON Schema validation of frontmatter/config, plus Markdown/comment structure validation.
3. Random ID shape/uniqueness, issue short-ID shape/uniqueness, sequence-counter consistency, and filename parity.
4. Configuration/workflow references, parent resolution and placement, labels (unknown labels warn).
5. Reference resolution and dependency cycles. Missing historical handoff targets warn.
6. Readiness, claim, review, and completion invariants.

Snapshot validation cannot prove previous transitions or authorship. CLI mutations compare old/new state and enforce transition guards. Baseline validation is a future feature and cannot reconstruct intermediate edits.

Diagnostics include file path, line when available, offending ID, and a fix hint. Do not silently swallow invalid files or present their stale index rows as current data.

Once format implementation exists, changes must update schemas, validator, spec, and examples together. During this pre-implementation draft stage, keep the spec, this guidance, and examples synchronized and explicitly identify missing implementation. Do not add runtime features solely to make a documentation change appear implemented.

## Commands and checks

Current repository commands:

```bash
npm install
npm run build
npm test
npm run lint
npm run typecheck
```

Planned format commands: `plainpm init`, `create`, `show`, `list`, `validate`, `move`, `plan`, `migrate`, `rebalance`, and optional `index`. Define their CLI contracts during implementation. Provide human-readable output by default and `--json` for machine-readable results.

## Coding and testing

- TypeScript strict mode. No `any` without a reason in a comment.
- Pure parsing and validation logic; isolate filesystem access in adapters.
- Test every validator rule with passing and failing fixtures.
- Test byte-identical round trips and targeted edits preserving unrelated content.
- Test concurrent local claims, independent random ID allocation, sequential short IDs, duplicate alias repair, ambiguous lookup, counter gaps/recovery, stable references after moves, and cycle detection.
- Test that competing comment appends may conflict and that resolution retains both entries. Never assert Git guarantees clean merges.
- Test index rebuild equivalence when indexing exists.
- Inject clocks and ID generators. Tests must be deterministic.

## Git and migrations

Use Conventional Commits and focused PRs. Released schema changes include an explicit migration and a `schema-change` label; separate migrations rewriting user files from feature work. Produce reviewable diffs, not automatic user commits.

The earlier YAML-issue draft also used `plainpm/v1`; a future importer must explicitly name that source draft and convert IDs/references together and assign short IDs with a valid sequence counter. The UUID-only Markdown draft also needs an explicit conversion, not silent compatibility. Historical repository plans are not implicitly migrated by discovery.

Configuration symlinks may point to shared standards; resolve before reading and never mutate their targets through unrelated entity operations. Entities must not be symlinks.

Do not commit caches, secrets, or generated build output. Never delete or renumber existing entity IDs during ordinary operations. License is MIT; use DCO sign-off (`git commit -s`) when committing.

When in doubt, favor human-editable Markdown, small diffs, stable references, and explicit conflict reporting.
