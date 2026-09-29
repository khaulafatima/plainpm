# PlainPM Format Specification (plainpm/v1)

> **Core Principle**: Files are the source of truth. Everything else (SQLite index, UI, CLI queries, automation) is a disposable, rebuildable derivative.

This specification defines the on-disk, Git-friendly YAML format for **PlainPM** workspaces, projects, folders (PRDs), issues, handoffs, and configurations. It is designed to be consumed by both humans and AI coding agents.

---

## 1. Architectural Philosophy

1. **One Entity Per File**: Every issue, PRD, handoff, and configuration is an individual file. Moving an issue is a `git mv`. Deleting an issue is a `git rm`. Merging branches never conflicts across unrelated issues.
2. **Git-Centric & Diff-Friendly**: Clean line-oriented YAML. No minified JSON. Multi-line text uses literal block scalars (`|-`) to produce clean, legible `git diff` outputs.
3. **IDs Live in Frontmatter, Not Paths**: The `id` field inside the file is the canonical identifier. File location is a navigational convenience. All cross-references use `id` values.
4. **Explicit `rank` Fields for Ordering**: Ordering never relies on filename sort order or array position. Files carry a lexicographic `rank` string. Never rename files to reorder.
5. **Append-Only Comments**: New comments go below the `<!-- append below -->` marker. Tooling must never rewrite existing comment entries.
6. **No Server or Heavy Database of Record**: The repository *is* the database. A local `.plainpm/index.sqlite` cache is built on demand, is completely disposable, and is always gitignored.
7. **Lossless Round-Tripping**: Any parser/writer must preserve comments, key order, and unknown fields so hand-edited annotations or tooling extensions are never stripped.
8. **Every File Carries `schema_version`**: Either explicitly or by inheritance from the nearest ancestor `plainpm.yml`. Format changes ship with a `plainpm migrate` command — never silent dual-format support.
9. **Agent-Ready by Default**: Every issue carries enough structured context (implementation notes, test strategy, acceptance verification commands) that an AI coding agent can pick it up and start working without a cold-start exploration of the codebase.

---

## 2. Directory Hierarchy

A PlainPM project maps logical hierarchy to physical folders:

```text
my-project/                               # Git Repository Root (.git)
├── .git/
├── .gitignore                           # Must ignore .plainpm/ and .env*
├── .env                                 # Local secrets (never committed)
├── plainpm.yml                          # Project Manifest (root config)
├── config/                              # Shared Project Configurations
│   ├── workflow.yml                     # State machine & transition rules
│   └── labels.yml                       # Recognized labels & color/category tags
├── prds/                                # PRD Folders
│   ├── PRD-1-user-auth/
│   │   ├── prd.md                       # YAML frontmatter + Markdown prose
│   │   ├── .next-id                     # Monotonically increasing issue counter
│   │   ├── issues/                      # Issues under this PRD
│   │   │   ├── PRD-1-001.yml            # One issue = one file
│   │   │   ├── PRD-1-002.yml
│   │   │   └── PRD-1-003.yml
│   │   └── attachments/                 # Local images, specs, diagrams
│   └── PRD-2-billing-portal/
│       ├── prd.md
│       ├── .next-id
│       └── issues/
│           ├── PRD-2-001.yml
│           └── PRD-2-002.yml
├── backlog/                             # Unassigned / General Backlog
│   └── issues/
│       ├── ACME-001.yml                 # Uses project key as prefix
│       └── ACME-002.yml
├── handoffs/                            # Agent/session handoff documents
│   └── HANDOFF-2026-09-27T2350Z.md
└── .plainpm/                            # Gitignored: Local SQLite cache & state
```

### 2.1 ID Naming Convention

Issue IDs follow one canonical pattern depending on their parent:

- **PRD-scoped issues**: `<PRD-id>-<zero-padded-seq>` → `PRD-1-001`, `PRD-1-002`
- **Backlog issues** (no PRD parent): `<project-key>-<zero-padded-seq>` → `ACME-001`, `ACME-002`

The filename is always `<id>.yml`. The `id` field *inside* the file is the authoritative identifier. If the filename and the `id` field ever diverge, the `id` field wins and the validator flags the mismatch.

### 2.2 The `.next-id` File

Each PRD directory and the `backlog/` directory contain a `.next-id` file holding a single integer — the next sequence number to allocate. The CLI increments this file atomically on `plainpm create`. It is committed to Git to prevent ID collisions across branches.

---

## 3. Specification Schemas & Examples

### 3.1 Project Manifest: `plainpm.yml`

Located at the workspace root. Defines the project namespace, default settings, and schema version. Every other file in the workspace inherits `schema_version` from this manifest unless it explicitly declares its own.

```yaml
schema_version: "plainpm/v1"
kind: project

info:
  name: "Acme Platform"
  key: "ACME"                            # Used as prefix for backlog IDs (ACME-001)
  description: "Core cloud infrastructure and API platform."

settings:
  id_padding: 3                          # Zero-pad width: 001, 002, ...
  id_style: prd-scoped                   # prd-scoped (PRD-1-001) | flat (ACME-001 everywhere)
  default_issue_type: task
  default_priority: medium
  default_status: todo

paths:
  config: "config"
  prds: "prds"
  backlog: "backlog"
  handoffs: "handoffs"
```

**Key decisions:**

- `info.key` is the single source of the project prefix. There is no separate `issue_prefix`.
- `id_style: prd-scoped` (default) means PRD-parented issues use `PRD-<n>-<seq>`. Set to `flat` to use `<key>-<seq>` everywhere regardless of PRD placement.

---

### 3.2 Workflow Definition: `config/workflow.yml`

Governs valid states and transition guards across all issues. Includes both human and agent lifecycle statuses.

```yaml
schema_version: "plainpm/v1"
kind: workflow

statuses:
  # --- Human statuses ---
  - id: backlog
    name: "Backlog"
    category: unstarted
    color: "#718096"

  - id: todo
    name: "To Do"
    category: unstarted
    color: "#4A5568"

  - id: in_progress
    name: "In Progress"
    category: active
    color: "#3182CE"

  - id: review
    name: "In Review"
    category: active
    color: "#D69E2E"

  - id: done
    name: "Done"
    category: completed
    color: "#38A169"

  - id: cancelled
    name: "Cancelled"
    category: discarded
    color: "#E53E3E"

  # --- Agent statuses ---
  - id: ready_for_agent
    name: "Ready for Agent"
    category: unstarted
    color: "#8B5CF6"
    description: "Fully specified, all blockers resolved — an agent can pick this up."

  - id: agent_in_progress
    name: "Agent In Progress"
    category: active
    color: "#6D28D9"
    description: "An agent has claimed this issue and is actively implementing."

  - id: agent_review
    name: "Agent Review"
    category: active
    color: "#A78BFA"
    description: "Agent believes work is complete — awaiting human verification."

transitions:
  backlog: [todo, cancelled]
  todo: [in_progress, ready_for_agent, cancelled, backlog]
  in_progress: [review, todo, cancelled]
  review: [done, in_progress, cancelled]
  done: [todo]
  cancelled: [todo]
  # Agent lifecycle transitions
  ready_for_agent: [agent_in_progress, todo, cancelled]
  agent_in_progress: [agent_review, ready_for_agent, cancelled]
  agent_review: [done, agent_in_progress, ready_for_agent, in_progress]

initial_status: todo
terminal_statuses: [done, cancelled]
```

**Agent lifecycle flow:**

```text
todo → ready_for_agent → agent_in_progress → agent_review → done
                │                 │                │
                ▼                 ▼                ▼
            cancelled      ready_for_agent    agent_in_progress
              (bail)        (agent release)     (rework needed)
```

**Why separate agent statuses?**

- Prevents two agents from grabbing the same issue (status = `agent_in_progress` means "claimed").
- Humans can filter the board to see only agent work (`category: active` + agent prefix).
- `agent_review` signals a human checkpoint — the agent can't mark `done` directly.

---

### 3.3 Labels Definition: `config/labels.yml`

Defines the recognized label vocabulary for the project. Labels not defined here are allowed but will produce a validator warning.

```yaml
schema_version: "plainpm/v1"
kind: labels

labels:
  - id: frontend
    name: "Frontend"
    color: "#7C3AED"
  - id: backend
    name: "Backend"
    color: "#2563EB"
  - id: auth
    name: "Authentication"
    color: "#DC2626"
  - id: ready-for-agent
    name: "Ready for Agent"
    color: "#059669"
    description: "Issue is fully specified and can be picked up by an AI agent."
  - id: onboarding
    name: "Onboarding"
    color: "#D97706"
```

---

### 3.4 PRD Manifest: `prd.md`

Stored inside each PRD directory (e.g., `prds/PRD-1-user-auth/prd.md`). Uses **YAML frontmatter + Markdown prose** — this is the canonical and only supported format for PRDs.

```markdown
---
schema_version: "plainpm/v1"
kind: prd

meta:
  id: "PRD-1"
  name: "User Authentication & SSO"
  seq: 1
  status: in_progress
  owner: "dan"
  target_release: "v1.2.0"

defaults:
  labels:
    - auth
    - security

execution_order:
  - id: "PRD-1-001"
    title: "Registration form component"
    blocked_by: []
  - id: "PRD-1-002"
    title: "Email verification flow"
    blocked_by: ["PRD-1-001"]
  - id: "PRD-1-003"
    title: "Profile completion wizard"
    blocked_by: ["PRD-1-002"]
---

# User Authentication & SSO

## Summary

Implement OAuth2 / OpenID Connect authorization with passwordless email magic links
and Google Social Sign-in.

## Deliverables

- Authentication API routes (`/api/auth/*`)
- Session cookie handling and token refresh
- Frontend login / registration dialogs

## Open Questions

- Should we support Apple Sign-in in v1 or defer?
```

**`execution_order`** is a derived summary of the issue dependency DAG. The individual issues' `links.blocked_by` fields remain the source of truth — `execution_order` gives agents and humans a single-glance execution plan without parsing N issue files.

**Why `prd.md` and not `prd.yml`?** PRDs are primarily prose documents. YAML frontmatter holds structured metadata for indexing and validation. The Markdown body is the specification itself — editable in any text editor and rendered natively by GitHub, GitLab, and IDE previews.

---

### 3.5 Issue Specification: `issues/<ID>.yml`

Each issue is a self-contained, line-oriented YAML file. The `description` field holds free-form prose. Structured agent-consumable fields are provided for implementation guidance, test strategy, and acceptance verification.

```yaml
schema_version: "plainpm/v1"
kind: issue

id: "PRD-1-001"
title: "Implement Google OAuth2 token exchange endpoint"
status: agent_in_progress
type: feature                            # task | bug | feature | spike
priority: high                           # urgent | high | medium | low
rank: "0|aaaaaa"                         # Lexicographic rank string (see §3.8)

branch: "feat/PRD-1-001-oauth-callback"  # Git branch for this issue's work

parent:
  prd: "PRD-1"

assignee: "agent:antigravity"            # "agent:<name>" for AI agents, plain name for humans
reporter: "dan"

labels:
  - auth
  - backend
  - ready-for-agent

dates:
  created_at: "2026-09-27T20:15:00Z"
  updated_at: "2026-09-27T22:30:00Z"
  due_date: "2026-10-05"

links:
  blocked_by:
    - "PRD-1-000"
  blocks:
    - "PRD-1-003"
  relates_to:
    - "ACME-104"

# --- Agent-consumable structured fields ---

implementation_notes:
  modules:
    - "packages/core/src/auth"
    - "packages/app/src/routes/auth"
  patterns:
    - "Follow existing Express route handler pattern in packages/app/src/routes/api"
  seams:
    - "Test through the public AuthService.exchangeOAuthCode() interface"
  prior_art:
    - "See packages/core/src/auth/login.ts for similar token exchange flow"

test_strategy:
  approach: integration
  seams:
    - "AuthService.exchangeOAuthCode()"
    - "POST /api/auth/callback/google route handler"
  verify_command: "pnpm test --filter core -- --grep 'oauth'"
  prior_art:
    - "See packages/core/src/auth/__tests__/login.spec.ts"

acceptance_criteria:
  - text: "State token parameter validated against temporary session cache"
    done: true
    verify: "pnpm test --filter core -- --grep 'PKCE state'"
  - text: "Exchange code for id_token and access_token"
    done: true
    verify: "pnpm test --filter core -- --grep 'token exchange'"
  - text: "Create user account if email does not exist"
    done: false
    verify: "pnpm test --filter core -- --grep 'new user creation'"
  - text: "Set encrypted HTTP-only session cookie"
    done: false
    verify: manual

agent_context:
  last_agent: "antigravity"
  last_session: "da06b01a"
  files_modified:
    - "packages/core/src/auth/oauth.ts"
    - "packages/core/src/auth/__tests__/oauth.spec.ts"
  decisions:
    - "Used Google JWKS endpoint with 1h cache TTL for id_token verification"
    - "PKCE state stored in encrypted session cookie, not server-side cache"
  failing_tests: []
  notes: "Token exchange and validation done. Need to wire up user creation and session cookie."

# --- End agent fields ---

description: |-
  Add `/api/auth/callback/google` route to handle the incoming OAuth2 code,
  validate PKCE state against session cache, and exchange with Google's token endpoint.

# <!-- append below -->
comments:
  - author: "dan"
    created_at: "2026-09-27T21:00:00Z"
    body: |-
      Remember to use Google's JWKS endpoint to verify the id_token signature.
  - author: "agent:antigravity"
    created_at: "2026-09-27T22:30:00Z"
    body: |-
      Added JWKS caching utility in packages/core/src/auth/jwks.ts.
```

**Field reference:**

| Field | Required | Purpose |
| :------ | :--------- | :-------- |
| `branch` | Optional | Git branch name for this issue's work. Convention: `<type>/<id>-<slug>` |
| `implementation_notes` | Optional | Codebase pointers: modules, patterns, seams, prior art |
| `test_strategy` | Optional | Testing approach, seams, verify command, prior art |
| `acceptance_criteria[].verify` | Optional | Shell command to verify criterion, or `manual` |
| `agent_context` | Optional | Structured state passed between agent sessions |

---

### 3.6 Handoff Document: `handoffs/HANDOFF-<timestamp>.md`

Created by the `/hand-off` skill when an agent session ends. Uses YAML frontmatter + Markdown prose, like PRDs.

```markdown
---
schema_version: "plainpm/v1"
kind: handoff

meta:
  created_at: "2026-09-27T23:50:00Z"
  author: "agent:antigravity"
  session_id: "da06b01a"

context:
  branch: "feat/PRD-1-signup"
  prd: "PRD-1"
  issues_completed:
    - "PRD-1-001"
  issues_in_progress:
    - "PRD-1-002"
  issues_remaining:
    - "PRD-1-003"

suggested_skills:
  - tdd
  - code-loop
---

# Handoff: User Signup Flow (PRD-1)

## What was accomplished

- PRD-1-001: Registration form component fully implemented and tested.
  All 4 acceptance criteria passing.
- PRD-1-002: Email verification flow — started, branch has skeleton route handler.

## What remains

- PRD-1-002: Wire up email sending via SendGrid adapter. Tests are stubbed.
- PRD-1-003: Profile completion wizard — not started, blocked by PRD-1-002.

## Key decisions made

- Used React Hook Form instead of custom controlled inputs — better a11y defaults.
- PKCE state stored in encrypted cookie, not server-side session cache.

## Known issues

None. All tests passing on branch `feat/PRD-1-signup`.
```

**Why a first-class entity?** Handoff docs stored inside the workspace (not the OS temp directory) are visible to the next agent session when it opens the project. The frontmatter gives structured pointers (`issues_completed`, `issues_in_progress`, `issues_remaining`) that an agent can parse to resume without re-reading every issue file.

---

### 3.7 Labels Definition: `config/labels.yml`

(Unchanged from §3.3 above — see that section.)

---

### 3.8 Rank Ordering

The `rank` field uses **lexicographic string ordering** rather than floating-point arithmetic. This avoids precision loss from repeated bisection.

**Format**: `<bucket>|<position>` where `<bucket>` is a single digit (0–2) and `<position>` is a lowercase alphabetic string.

**Initial allocation**: When creating the first issues in a list, space them widely:

| Rank | Position |
| :----- | :--------- |
| `"0\|aaaaaa"` | First |
| `"0\|mmmmmm"` | Middle |
| `"0\|zzzzzz"` | Last |

**Inserting between two items**: Compute the lexicographic midpoint of their position strings. For example, inserting between `"0|aaaaaa"` and `"0|mmmmmm"` yields `"0|gggggd"`.

The CLI command `plainpm rebalance` recalculates evenly-spaced ranks for all items in a given scope if positions become too dense.

---

## 4. Referential Integrity & Validation Rules

PlainPM enforces a strict validation pipeline. Order matters — fail fast.

### 4.1 Schema Validation

Every `.yml` and `.md` (frontmatter) file is validated against its JSON Schema (`schemas/issue.json`, `schemas/workflow.json`, `schemas/handoff.json`, etc.). Required fields, types, and enum values are checked.

### 4.2 Workflow Validation

- `status` must match an `id` defined in `config/workflow.yml`.
- Transitions performed by CLI commands must be legal per `transitions`. Direct file edits bypass transition validation but the validator flags illegal states.
- Agent status transitions (`ready_for_agent` → `agent_in_progress` → `agent_review`) follow the same rules — no special bypass.

### 4.3 Referential Integrity

- `parent.prd` must match an existing folder containing `prd.md`.
- Every reference in `links.blocked_by`, `links.blocks`, and `links.relates_to` must resolve to an existing issue `id`.
- Labels in `labels:` that do not appear in `config/labels.yml` produce a warning (not an error — custom labels are allowed but flagged).
- `execution_order` IDs in `prd.md` must match existing issue files. Missing or extra entries produce warnings.

### 4.4 ID Uniqueness

No two issue files in the workspace may declare the same `id`, regardless of folder location. No two PRD folders may declare the same `meta.id`.

### 4.5 Filename–ID Consistency

The filename (minus `.yml`) must equal the `id` field. Mismatches are flagged as errors.

### 4.6 `schema_version` Inheritance

Files may omit `schema_version` if a `plainpm.yml` exists in an ancestor directory. The validator resolves the version by walking up the directory tree. If no `schema_version` is found anywhere, the file fails validation.

---

## 5. Comment Model

Comments follow an **append-only** discipline:

1. The `# <!-- append below -->` marker separates the structured metadata from the comment log.
2. New comments are appended to the end of the `comments:` sequence. Existing entries must never be modified or reordered.
3. Each comment carries `author`, `created_at` (ISO 8601), and `body` (literal block scalar).
4. Agent comments use the `agent:<name>` author convention (e.g., `agent:antigravity`).
5. Deleting a comment is a destructive action. Tooling should refuse it without `--force`. The deleted text remains visible in Git history.

This design ensures that appending a comment to the same file on two branches produces a clean Git auto-merge (both additions go at the end of a YAML sequence).

---

## 6. Forward Compatibility & Migration

### 6.1 Unknown Field Preservation

Parsers must **preserve** YAML keys they do not recognize. When a v1 tool rewrites a file that contains v2 fields, those fields must survive the round-trip unchanged.

### 6.2 Version Negotiation

- A tool may read any `schema_version` it understands.
- A tool must refuse to *write* a file with a `schema_version` it does not support.
- Opening a workspace with a newer `schema_version` than the tool supports should produce a clear error: `"This workspace requires plainpm/v2, but this tool only supports plainpm/v1. Run: npm update -g plainpm"`.

### 6.3 The `plainpm migrate` Contract

- Migrations are applied by `plainpm migrate` and never silently on read.
- Each migration is a named, idempotent function that rewrites files from version N to N+1.
- Migrations must not reorder keys or strip comments (use a comment-preserving YAML library).
- The migration command produces a Git-friendly diff (one commit per migration step) so the result is reviewable.

---

## 7. Sync & Indexing Pipeline

```text
[ Disk Files (.yml / .md frontmatter) ]
         │
         ▼  (Chokidar Watcher / CLI Scan)
[ Core Parser / Validator ]
         │
         ▼  (Dispatched Events)
[ SQLite Disposable Cache: .plainpm/index.sqlite ]
         │
         ▼
[ CLI Fast Queries / Viewer UI ]
```

- **Disposable Index**: The SQLite database at `.plainpm/index.sqlite` is indexed with tables `issues`, `prds`, `links`, `comments`, `labels`, and `handoffs` for fast queries (`plainpm list --assignee=abuzar --status=in_progress`).
- **Source of Truth Invariant**: The SQLite index is never written to directly by user edits. The CLI writes to the `.yml` / `.md` file first, and the watcher/indexer updates SQLite.
- **Rebuild**: `plainpm index` rebuilds the entire cache from files. Deleting `.plainpm/` must lose no data.

---

## 8. Agent Integration

PlainPM is designed to support AI coding agents as first-class participants. This section documents the conventions agents must follow.

### 8.1 Agent Lifecycle

An agent picking up work follows this sequence:

1. **Discover work**: Read `plainpm.yml`, then scan for issues with `status: ready_for_agent`.
2. **Claim an issue**: Transition `status` from `ready_for_agent` → `agent_in_progress`. Set `assignee: "agent:<name>"` and `branch: "<type>/<id>-<slug>"`.
3. **Read context**: Parse `implementation_notes`, `test_strategy`, and `agent_context` (if left by a prior agent). Read the parent `prd.md` for broader context.
4. **Implement**: Follow the `/code-loop` phases — placeholder files → placeholder signatures → implementation → tests. Use `test_strategy.verify_command` for continuous verification.
5. **Update progress**: As acceptance criteria are satisfied, set `done: true`. Append agent comments documenting decisions.
6. **Write `agent_context`**: Before ending the session, update `agent_context` with files modified, decisions made, failing tests, and notes for the next agent.
7. **Transition status**: When all `acceptance_criteria` are `done: true`, transition to `agent_review`.
8. **Create handoff** (if session ends before completion): Write a handoff doc to `handoffs/` summarizing progress.

### 8.2 Agent Naming Convention

Agent identifiers use the `agent:<name>` format in `assignee`, `reporter`, and `comments[].author` fields. This distinguishes agent activity from human activity in logs and filters.

Examples: `agent:antigravity`, `agent:cursor`, `agent:copilot-workspace`

### 8.3 Branch Convention

Agent-created branches follow: `<type>/<issue-id>-<slug>`

| Type | When |
| :----- | :----- |
| `feat/` | Features and tasks |
| `fix/` | Bug fixes |
| `spike/` | Exploratory spikes |

Example: `feat/PRD-1-001-oauth-callback`

### 8.4 Multi-Agent Safety

- An issue with `status: agent_in_progress` is **claimed**. A second agent must not transition it or modify its files.
- If an agent crashes or times out, the issue remains `agent_in_progress`. A human (or a cleanup agent) can transition it back to `ready_for_agent` to release the claim.
- `agent_context.last_session` identifies which session holds the claim, enabling targeted cleanup.
