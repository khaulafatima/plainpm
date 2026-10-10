# PlainPM Format Specification (plainpm/v1 draft)

> Files are the source of truth. Indexes, views, and execution plans are disposable derivatives.

PlainPM is Markdown-based project management in a Git repository. Issues, PRDs, and handoffs use Markdown with YAML frontmatter. Configuration uses YAML. There is no database or server of record.

**Implementation status:** This is the proposed v1 contract, not a description of completed CLI features. The repository currently has a CLI scaffold; format schemas, parsing, validation, claims, and migration commands are not implemented. Before shipping v1, implement the JSON Schemas and validator with passing and failing fixtures for the rules below. Existing draft YAML issues are not a second supported format; their conversion must be explicit before adoption of this draft.

The structured companion is [format-spec.v1.yaml](format-spec.v1.yaml). It summarizes v1 fields, directory discovery, and behavioral rules for tooling development; it is not an executable JSON Schema or a second workspace file format. This Markdown specification remains authoritative. Update both documents together.

## 1. Design rules

1. One issue, PRD, or handoff per file.
2. IDs are immutable, authoritative file fields. Paths organize entities; moving an entity never changes its ID.
3. Prose belongs in Markdown bodies; fields needed for querying and validation belong in frontmatter. Do not duplicate authoritative fields in the body.
4. Preserve unknown fields, YAML comments, key order, Markdown, and line endings. Parsing and serializing without edits must be byte-identical. Targeted writes change only the requested content.
5. Comments are append-only, but Git conflicts remain possible and must be surfaced.
6. Writes go to files first. Deleting `.plainpm/` loses no project data or persisted claim ownership.
7. Each managed file declares `schema_version` or inherits it from the workspace manifest. Unsupported versions are never written. Migrations are explicit.
8. Agent claims coordinate cooperating writers in one checkout only. Independent clones and worktrees require external coordination.

## 2. Workspace layout and discovery

```text
my-project/
├── .gitignore                         # .plainpm/ and .env*
├── plainpm.yml
├── config/
│   ├── workflow.yml
│   └── labels.yml
├── prds/
│   └── user-signup/                    # freely chosen, mutable folder name
│       ├── prd.md
│       ├── issues/
│       │   └── ACME-k7m4p9x2.md
│       └── attachments/
├── backlog/
│   └── issues/
├── handoffs/
│   └── HANDOFF-h6t2y9q4.md
└── .plainpm/                           # gitignored derived data and transient locks
```

Find the workspace using the nearest ancestor `plainpm.yml`; it is the version-inheritance boundary. Do not inherit from outside it. Nested workspaces are independent and excluded from the parent scan.

Discover only the manifest, the two configured configuration files, `<paths.prds>/*/prd.md`, `<paths.prds>/*/issues/*.md`, `<paths.backlog>/issues/*.md`, and `<paths.handoffs>/*.md`. Do not validate ordinary repository Markdown, attachments, or historical planning files as entities. PRD folders without `prd.md` but containing issue files are errors. Nested epics are outside v1.

Configured paths must be relative, distinct, non-overlapping directories inside the workspace. Configuration files may be symlinks and must be resolved before reading. Entities and entity directories must not be symlinks. Do not rewrite shared configuration through a symlink as a side effect of entity edits.

## 3. Identity and moves

### 3.1 Random identity and sequential issue short IDs

Each entity has an immutable random `id`. Issues also have a required human-facing `short_id`:

```yaml
id: "ACME-k7m4p9x2"       # stable identity for references and filenames
short_id: "ACME-1"       # human-facing sequential issue number
```

Generate eight characters using a cryptographically secure random generator and the alphabet `23456789abcdefghjkmnpqrstuvwxyz` (excluding `0`, `1`, `i`, `l`, and `o`). Require at least one letter so a random issue ID cannot be confused with a sequential short ID; regenerate an all-digit token.

- Issue `id`: `<project-key>-<random-token>`.
- PRD `id`: `PRD-<random-token>`.
- Handoff `id`: `HANDOFF-<random-token>`.
- Comment ID: `COMMENT-<random-token>` (unique throughout the workspace).

The project key matches `[A-Z][A-Z0-9]*` and is fixed after initialization in v1. Reserve `PRD`, `HANDOFF`, and `COMMENT` as non-project prefixes. Full random IDs are used in stored references, issue/handoff filenames, and branch naming. PRDs, handoffs, and comments do not need sequential short IDs in v1.

Random IDs allow independent creation without a shared identity allocator, but collisions remain possible. Creation checks existing IDs, retries on collision, and uses exclusive file creation. Validation rejects duplicate IDs after a merge. Inject the random generator in tests. Do not truncate an ID when persisting a reference.

**Sequential issue numbers:** `short_id` has the form `<project-key>-<positive-integer>`, starting at `1`, with no leading zeros. One sequence covers all issues across PRDs and backlog; it is not a sort order. Store the next number in the committed manifest field `sequences.next_issue_number`. A new workspace starts at `1`. This counter allocates human aliases only; it does not determine identity.

For creation, hold the workspace writer lock (§8), reread the manifest and issues, and reserve the next number by advancing the counter before creating the issue. Reject a counter not greater than all existing issue numbers and require explicit repair. Persist the counter atomically; create the issue exclusively. These are two writes, not a filesystem transaction: if creation fails after reservation, leave a gap. Gaps are valid. Never decrease the counter or reuse numbers after deletion or failed creation. A counter is project data, never stored solely in `.plainpm/`.

**CLI lookup:** A command such as `plainpm show ACME-1` resolves the unique `short_id` to its random `id`. Displays show `short_id` and title; machine output includes both identifiers. Stored `parent.prd`, dependency links, and handoff references always use random IDs. If a short ID is ambiguous, fail with the matching random IDs so the user can select explicitly. Never pick the first match.

**Separate branches:** Two branches may allocate the same `short_id` to different random IDs. Git does not prevent this, even if the counter merges cleanly. Validation reports duplicate short IDs as errors; random-ID lookup remains usable for repair. Resolve explicitly by choosing which issue keeps its alias and assigning fresh numbers to the others. Keep all random IDs, filenames, and structured references unchanged. Do not silently renumber during merge, indexing, or reads.

When integrating counters, preserve at least the maximum counter from all integrated branches, then ensure it is greater than every allocated short-ID number. Allocate replacements from that high-water mark and advance it as usual; never resolve a counter conflict by selecting a lower value. If counter history is lost, require explicit recovery from Git rather than reconstructing it only from surviving issues, which could reuse deleted numbers.

Short IDs are stable during ordinary edits and moves, but may change during explicit conflict repair. They are convenient human aliases, not permanent external references. Use the random ID for durable links in prose or external systems; alias repair cannot safely rewrite every external mention.

### 3.2 Moving an issue

To move an issue, keep its random ID, short ID, and filename, move the file, and update `parent.prd` in the same logical operation. Backlog issues use `parent: null`. A PRD issue uses `parent: { prd: <PRD-id> }`.

Resolve `parent.prd` against the `id` in a discovered `prd.md`, not against its folder name. Its resolved folder must contain the issue. A folder rename alone does not change parent IDs or references. Cross-references survive moves unchanged.

A move affects path and content; it is not an atomic multi-file filesystem transaction. Tooling must report partial failures, support safe recovery, and leave validation able to detect mismatches. Never silently renumber an entity or reuse a deleted ID.

## 4. Manifest and configuration

### 4.1 `plainpm.yml`

```yaml
schema_version: "plainpm/v1"
kind: project
info:
  name: "Acme Web Platform"
  key: "ACME"
  description: "Markdown-based project management."
settings:
  default_issue_type: task
  default_priority: medium
  default_status: todo
sequences:
  next_issue_number: 2                    # ACME-1 already exists; init starts at 1
paths:
  config: config
  prds: prds
  backlog: backlog
  handoffs: handoffs
```

Required: `schema_version`, `kind`, `info.name`, `info.key`, `settings`, `sequences.next_issue_number`, and `paths`, including every setting/path shown. The sequence counter is a positive integer greater than every existing issue number. `info.description` is optional. Defaults apply only at creation and are written into the new issue; changes to defaults do not reinterpret existing issues.

### 4.2 `config/workflow.yml`

Required: `kind: workflow`, `statuses`, `transitions`, `initial_status`, and `terminal_statuses`. Each status requires a unique `id`, `name`, and `category` (`unstarted`, `active`, `completed`, or `discarded`); `color` and `description` are optional. Colors use `#RRGGBB`. Transition keys and targets, initial status, terminal statuses, and the manifest default status must resolve to declared statuses. Every status has a transition entry; an empty list allows no outgoing transition. Terminal status means completion classification, not a prohibition on reopening.

The basic workflow includes these transitions:

```yaml
transitions:
  backlog: [todo, cancelled]
  todo: [in_progress, ready_for_agent, cancelled, backlog]
  in_progress: [review, todo, cancelled]
  review: [done, in_progress, cancelled]
  done: [todo]
  cancelled: [todo]
  ready_for_agent: [agent_in_progress, todo, cancelled]
  agent_in_progress: [agent_review, ready_for_agent, cancelled]
  agent_review: [done, agent_in_progress, ready_for_agent, in_progress]
```

Agent lifecycle status IDs are reserved and required in v1. Custom transitions must not bypass the claim and review guards in §8. PRD statuses are separate: `draft`, `active`, `completed`, `cancelled`.

### 4.3 `config/labels.yml`

Required: `kind: labels` and `labels`, a list of objects with unique `id` and `name`; optional `color` (`#RRGGBB`) and `description`. Unknown issue labels produce warnings. Readiness is represented by status, not a duplicate `ready-for-agent` label.

Complete configuration examples live in `examples/basic-workspace/config/`.

## 5. Markdown entities

Managed Markdown begins with a `---` frontmatter delimiter on the first line and a closing `---` delimiter on its own line. Frontmatter is a single YAML mapping. Reject duplicate mapping keys, custom YAML tags, aliases, and merge keys. Configuration uses the same YAML restrictions. Quote dates and timestamps. Unknown fields are allowed and preserved, but reserved fields defined here must pass validation.

All entities require `kind` and top-level `id`; `schema_version` may be inherited. YAML frontmatter holds machine-readable facts. Markdown headings are authoring guidance, not a second schema or another place to store authoritative status/dependencies.

### 5.1 PRD: `prd.md`

```markdown
---
schema_version: "plainpm/v1"
kind: prd
id: "PRD-r8n3v6w5"
title: "User Signup Flow"
status: active
owner: dan
---

# User Signup Flow

## Summary

Help new users register and complete their profile.

## Deliverables

- Registration form
- Email verification
- Profile completion

## Open questions

- Which social sign-in providers belong in the first release?
```

Required: `id`, `kind`, `title`, `status`. Optional: `owner`, `target_release`. Body is non-empty Markdown. Titles in frontmatter are authoritative; the tool does not rewrite a matching body heading during unrelated edits.

Do not persist `execution_order`, repeated issue titles, or dependency lists here. `plainpm plan <prd-id>` will derive an execution plan from issues (§6); it is not yet implemented.

### 5.1.1 Handoff navigation in PRDs

PRDs include a visible `## Handoffs` section with ordinary relative Markdown links so humans and agents can open relevant handoffs directly on GitHub. The authoritative association remains the handoff's `context.prds` array. Reverse lookup scans handoffs for the PRD's immutable ID; an index is optional. Do not add a second authoritative handoff-ID array to PRD frontmatter.

The link section is a persisted, rebuildable navigation view, bounded by markers so tooling can update it without rewriting authored PRD prose:

```markdown
## Handoffs

<!-- plainpm:handoffs:start -->
- [2026-09-27 — active — User Signup Flow — HANDOFF-h6t2y9q4](../../handoffs/HANDOFF-h6t2y9q4.md)
<!-- plainpm:handoffs:end -->
```

Compute relative URLs from the PRD file's directory to each actual handoff path, respecting configured directories and URL-encoding path segments when needed. Never infer PRD identity from a folder name. A handoff covering multiple PRDs is linked from each relevant PRD, with only one handoff file. List every related handoff without truncation, ordered by `updated_at` descending (compare timestamp instants), then by handoff `id` in ascending ASCII order for ties. Each link label includes the UTC updated date (`YYYY-MM-DD`), handoff status (`active` or `resolved`), and handoff ID; a descriptive title may also be included. Keep both active and resolved handoffs visible in the same date ordering. Refresh navigation when status or `updated_at` changes so labels and ordering remain current. If there are no matching handoffs, keep the bounded section empty.

Creating/updating a handoff association or moving a linked file must explicitly refresh affected navigation sections. Direct file edits may leave links stale; validation should warn about broken or mismatched generated links, and an explicit refresh must rebuild them from IDs. Reads and indexing never silently rewrite PRDs. Missing link sections or stale links do not change the authoritative association. Cross-file refreshes are not atomic; surface failures and allow retry. This navigation generation is a required design capability, not an implemented command.

### 5.2 Issue: `issues/<id>.md`

```markdown
---
schema_version: "plainpm/v1"
kind: issue
id: "ACME-k7m4p9x2"
short_id: "ACME-1"
external_links:
  - provider: github
    external_id: "123"
    url: "https://github.com/owner/repo/issues/123"
title: "Create registration form"
status: todo
type: task
priority: high
rank: "mmmmmm"
parent:
  prd: "PRD-r8n3v6w5"
assignee: null
reporter: dan
labels: [frontend, onboarding]
dates:
  created_at: "2026-09-27T20:00:00Z"
  updated_at: "2026-09-27T20:00:00Z"
links:
  blocked_by: []
  relates_to: []
acceptance_criteria:
  - id: ac-1
    text: "Required fields show accessible validation errors."
    done: false
    verify: manual
---

# Create registration form

## Description

Collect a name, email address, and password.

## Implementation notes

Use the existing form components and shared validation helpers.

## Test strategy

Exercise required-field validation and keyboard navigation through the public UI.

## Agent context

No implementation has started.

## Comments

<!-- plainpm:comments -->
```

Required issue fields:

| Field | Contract |
| --- | --- |
| `kind`, `id`, `title` | `issue`, canonical issue ID, non-empty string |
| `short_id` | Required unique `<project-key>-<positive-integer>` human alias; §3.1 |
| `status` | ID in configured workflow |
| `type` | `task`, `bug`, `feature`, or `spike` |
| `priority` | `urgent`, `high`, `medium`, or `low` |
| `rank` | Six lowercase ASCII letters; §6 |
| `parent` | `null` for backlog, otherwise mapping with required `prd` ID |
| `dates` | Required `created_at`, `updated_at`: RFC 3339 UTC strings ending in `Z`; optional `due_date`: `YYYY-MM-DD` |
| `links` | Required `blocked_by` and `relates_to`: arrays of unique issue IDs; empty arrays allowed |
| `acceptance_criteria` | Array; empty allowed until agent readiness. Each entry requires unique issue-local `id`, non-empty `text`, boolean `done`; optional `verify` |

Optional: `assignee` (string or null), `reporter` (string), `labels` (unique string array), `branch` (string), `claim` (§8), and `external_links` (§5.2.1). `verify` is a non-empty shell command string or the literal `manual`. Treat commands as untrusted input: validation and indexing never execute them. Execution requires the invoking user's authorization and normal execution safeguards.

Description, implementation notes, test strategy, and agent context are Markdown prose, not duplicated YAML fields. Acceptance criteria stay structured for reliable status checks. Their IDs remain stable when text changes. `done` is an assertion, not proof that a command passed.

### 5.2.1 External cloud issue links

`external_links` is an optional array connecting a PlainPM issue to corresponding issues in external services. Omission or `[]` means no external mapping. Multiple providers or repositories may be linked to one issue.

```yaml
external_links:
  - provider: github
    external_id: "123"
    url: "https://github.com/owner/repo/issues/123"
```

Each entry requires:

| Field | Contract |
| --- | --- |
| `provider` | Non-empty lowercase identifier matching `[a-z][a-z0-9_-]*`, such as `github`, `gitlab`, or `linear`. An open vocabulary; a value does not imply an installed sync adapter. |
| `external_id` | Non-empty string identifying the issue in its provider scope. Quote numeric IDs such as `"123"`. |
| `url` | Absolute HTTPS URL of the external issue, including its host and repository/project scope. No embedded credentials or access tokens. |

`external_id` alone is not globally unique: issue `123` can exist in several repositories. The URL supplies the external location; future adapters must resolve provider-specific scope and verify that the URL and external ID identify the same issue before syncing. Local validation checks field shape without contacting the provider. Reject duplicate exact `(provider, url)` mappings, both within an issue and across workspace issues; provider-specific URL aliases require adapter-level checks.

PlainPM's random `id` remains the permanent local identity. `short_id` remains the human alias. Neither is replaced by an external ID; internal dependencies and handoffs continue to use local random IDs. Preserve external mappings during moves and short-ID conflict repair. Removing a mapping only unlinks it locally and does not delete the remote issue.

This field records a sync connection, not synchronization behavior. Adding it does not create, fetch, or update any remote issue. Cloud synchronization is not implemented in v1's current scaffold. A future sync feature must explicitly define direction, field mapping, and conflict handling before writing either side. Imported changes must be written to and validated in local files; files remain the source of truth. Keep provider credentials outside committed issue files.

The URLs shown here and in the sample workspace are illustrative, not verified remote issues.

### 5.3 Handoff: `handoffs/<id>.md`

A handoff belongs to a session, not a PRD. Keep one handoff per session per workspace in the configured workspace-level handoffs directory. A session may cover multiple PRDs and backlog issues; do not split its handoff across PRD folders or save the authoritative document in an OS temporary directory. Enforce uniqueness of `session_id` among handoffs within a workspace. The handoff ID and filename remain stable for that session.

Required frontmatter: `kind: handoff`, `id`, `status` (`active` or `resolved`), `created_at` and `updated_at` (UTC timestamps), `author` (string), `session_id` (non-empty string), and `context`.

`context` requires `issues_completed`, `issues_in_progress`, and `issues_remaining` (unique issue-ID arrays, disjoint within a handoff). Optional: `branch` (string) and `prds` (an array of unique PRD IDs; omitted or empty for backlog-only work). These PRD references record session context at handoff time, not an ownership hierarchy. The former singular `context.prd` is forbidden on handoffs. Optional top-level `suggested_skills` is a string array. Body is non-empty Markdown describing accomplishments, remaining work, decisions, and known issues.

**Creation and status:** Create a handoff when unfinished work or unresolved decisions need continuation by another session; otherwise creation is optional. Persist an explicit `status`:

- `active`: Continuation notes still require attention. New handoffs with pending work start here.
- `resolved`: Continuation notes have been addressed or explicitly dismissed with a reason. An optional handoff documenting completed work may start here.

Resolution is an explicit human or agent action after reviewing the notes, not an automatic result of issue completion, a newer handoff, or elapsed time. Record a brief resolution reason in the Markdown body. Another session may resolve the handoff without changing its originating `session_id` or `author`; record the resolving actor in that note. Preserve the historical issue lists and associations. Resolving does not mean every referenced issue is done and does not release claims. A handoff has one workspace-wide status, so resolving a multi-PRD handoff requires addressing its continuation notes across all those PRDs.

Reopen a resolved handoff explicitly as `active` if its continuation notes need attention again, recording the reason and acting person or agent in the body. Both transitions refresh `updated_at` and affected PRD navigation under the writer-lock/expected-content rules. Status-only changes preserve recorded associations rather than deriving new ones from issue parents. The handoff statuses are fixed v1 values independent of the configurable issue workflow. Snapshot validation checks the enum, not whether the notes have actually been addressed.

**PRD association at save time:** On explicit handoff creation or continuation-content update, collect issue IDs from all three issue lists, resolve each available issue, and include its non-null `parent.prd` in `context.prds`. Union these IDs with additional PRDs explicitly selected for planning context and the handoff's previously recorded PRDs. Deduplicate while preserving existing order; append new IDs in ascending ASCII order for deterministic writes. Backlog issues add no PRD. If the resulting list is empty, writers emit `prds: []`; readers also accept omission.

These associations accumulate the PRD context recorded during the session. Moving an issue later does not remove or replace earlier associations. Reads, indexing, navigation refresh, and issue moves must not recompute `context.prds`; a later explicit handoff save may add the issue's new parent while retaining the old PRD. Remove an incorrect historical association only through an explicit correction, not automatic pruning. A correction cannot omit the current parent of a resolvable issue still listed in the handoff.

If a referenced issue or historical PRD no longer resolves, warn and preserve the stored reference and associations; do not guess its former parent or silently discard context. Snapshot validation does not require recorded PRDs to equal current issue parents, because that would invalidate legitimate history. CLI save-time enrichment applies the rule above; navigation then refreshes from the persisted associations (§5.1.1).

When the same session resumes, update its existing handoff in place with the latest accomplishments, remaining work, and continuation context. Do not append another session summary or create another file for the same session. Preserve `id`, `session_id`, originating `author`, and `created_at`; set `updated_at` to the update time (equal to `created_at` on creation and never earlier). A different session gets its own handoff, even when continuing the same issues. Use the workspace writer lock and expected-content checks when updating to avoid overwriting concurrent edits. Git preserves committed earlier summaries; uncommitted revisions are not guaranteed recoverable.

```markdown
---
schema_version: "plainpm/v1"
kind: handoff
id: "HANDOFF-h6t2y9q4"
status: active
created_at: "2026-09-27T23:50:00Z"
updated_at: "2026-09-28T00:10:00Z"
author: "agent:example"
session_id: "example-session-1"
context:
  prds: ["PRD-r8n3v6w5"]
  issues_completed: []
  issues_in_progress: ["ACME-k7m4p9x2"]
  issues_remaining: []
suggested_skills: [tdd]
---

# Session handoff

## What was accomplished

Registration form scaffolding has started.

## What remains

Verify accessible validation and submission loading behavior.

## Key decisions

Reuse existing form components.

## Known issues

Manual verification is pending; this handoff does not transfer the issue claim.
```

Handoffs describe the session's latest recorded state, not live issue status or claim ownership. Random filenames avoid relying on session-end timestamps for identity; collisions are checked as in §3.1. Unresolved historical references produce warnings, allowing later entity deletion without rewriting handoffs. A completed-session list does not itself mark an issue `done`.

### 5.3.1 Handoff operations and recovery

Expose handoff creation, same-session continuation updates, resolution, reopening, PRD-filtered discovery, and explicit navigation refresh through the existing CLI boundary. Exact command names and argument syntax remain to be designed. Parsing and validation should be pure logic behind thin filesystem adapters; an index is not a prerequisite for these operations.

A handoff write persists the authoritative handoff first, then refreshes affected PRD navigation. If a later navigation write fails, report the saved handoff and which navigation updates remain incomplete. Retry must reuse the persisted handoff identity and rebuild the links without creating duplicate entities or entries. Refresh both previously associated and newly associated PRDs after an explicit association correction. Preserve authored prose and unrelated frontmatter throughout recovery.

Reading, creating, updating, resolving, or reopening a handoff must not alter issue status, transfer ownership, or release a claim. Creation when continuation is needed is an agent workflow requirement, not a condition that snapshot validation can enforce for sessions it has never observed. Do not automatically prune resolved handoffs or hide them from PRDs.

Align the hand-off authoring skill with these workspace-storage rules when implementing this capability; its current temporary-directory instruction conflicts with the agreed format. Historical planning documents are not automatically migrated. Portable session-ID sourcing and the desired level of narrative detail (session history versus minimal continuation guide) remain open design questions. Until settled, retain the defined accomplishments, remaining work, decisions, and known-issues content without presenting it as current issue truth.

## 6. Dependencies and ordering

`links.blocked_by` is the only stored dependency direction. Reverse `blocks` links are derived; `links.blocks` is a reserved, forbidden field in v1. Likewise, PRD `execution_order` is reserved and forbidden rather than treated as an extension.

All issue links resolve by ID throughout the workspace. Reject missing targets, self-links, and dependency cycles, including cycles crossing PRDs. An issue is unblocked only when every direct blocker has `status: done`; `cancelled` does not satisfy a dependency. To proceed after cancellation, explicitly revise the dependency. `relates_to` is a non-scheduling reference; do not require reciprocal edits.

An execution plan is a topological ordering of the dependency graph, with `(rank, id)` as the deterministic ASCII tie-breaker among available nodes. PRD plans must show external blockers and their status, not silently omit them.

Rank scope is the containing PRD's issues or backlog issues. V1 ranks are fixed-width, six-character base-26 strings (`a = 0` through `z = 25`). Allocate the integer midpoint between neighbors; use virtual boundaries `-1` and `26^6` at the ends. If there is no unused integer between neighbors, require explicit `plainpm rebalance`; do not silently rewrite sibling files. Rebalance distributes integers evenly across the scope, ordered by current `(rank, id)`. Reject a rebalance if the scope exceeds the available rank space.

Compare ranks using ASCII byte order, not locale collation. Equal ranks are allowed after concurrent edits; ID breaks ties. Moves retain rank unless the user requests a new position. No bucket rotation or variable-width midpoint algorithm is part of v1.

## 7. Append-only comments

Each issue body ends with a `## Comments` section containing exactly one standalone `<!-- plainpm:comments -->` marker outside fenced code. Everything after the marker is the comment log. With no comments, it is empty. Each entry has this form:

```markdown
<!-- plainpm:comment COMMENT-c3f7s8u2 -->
Author: agent:example
Created-at: 2026-09-27T21:15:00Z

Form validation is implemented; keyboard navigation still needs verification.
<!-- plainpm:end-comment -->
```

Entry markers and metadata lines have the exact syntax above, with a non-empty single-line author and UTC timestamp. Body is non-empty Markdown; reserved marker lines may not appear literally inside it. Reject malformed blocks, duplicate IDs, and unrelated trailing content. Agents use `agent:<name>` authors. Readers preserve entry bytes; appenders add a new block at EOF without reformatting existing content.

Concurrent appends may cause Git conflicts. Never promise automatic merging. Resolve by retaining each distinct comment ID and content once; different content under the same ID requires explicit resolution. Preserve ordering within each branch's existing log; Git does not provide a total chronological order across branches.

Corrections are new comments referencing the earlier ID. V1 tooling does not edit or delete comment entries. Direct manual edits cannot be prevented; baseline comparison can report changes to historical comments. Comments are not an authenticated audit trail.

## 8. Agent lifecycle and claims

```text
todo → ready_for_agent → agent_in_progress → agent_review → done
                              ↓                  ↓
                       ready_for_agent    agent_in_progress
```

Readiness requires non-empty acceptance criteria, `verify` on each criterion (including `manual`), resolved blockers, and non-empty `Implementation notes` and `Test strategy` sections. The validator checks presence, not the adequacy of the plan. These headings are case-sensitive when checking readiness; body text outside reserved comment syntax remains free-form Markdown.

At claim time, set `status: agent_in_progress`, `assignee: agent:<name>`, `branch`, and:

```yaml
claim:
  session_id: "session-unique-token"
  claimed_at: "2026-09-27T20:15:00Z"
```

### 8.1 One shared checkout

Cooperating CLI writers must serialize writes using an exclusive workspace lock, then reread and validate the current file before updating it. A claim succeeds only if the issue is still `ready_for_agent`, unclaimed, and unblocked. Persist status, assignee, branch, and claim together with a same-directory temporary file and atomic replacement. Hold the lock until the write completes. General writes also verify the expected original content before replacement and fail on detected changes.

The lock is transient coordination, not project state. Ownership is persisted in the issue. Do not remove active locks during cache cleanup or index rebuild. After a crash, stale-lock recovery must establish that the owner is no longer running; otherwise require explicit operator recovery. Manual editors do not honor the lock, so this is not a guarantee against every possible filesystem writer.

While `agent_in_progress`, only the matching session may perform ordinary CLI edits. A human may explicitly release or take over a claim. Releasing clears `claim` and `assignee` and returns to `ready_for_agent`; if blockers or context no longer permit readiness, the human must explicitly revise the issue before releasing. Never infer a release from elapsed time alone.

### 8.2 Independent clones and worktrees

Local locks cannot coordinate separate checkouts. Users must assign issues to sessions before parallel work or adopt an external coordination policy. Do not claim distributed exclusivity from status fields or Git alone. On integration, conflicting claim ownership requires explicit resolution even if Git text-merges it. Retain this limitation in CLI help and agent guidance.

### 8.3 Review and resumption

Moving to `agent_review` requires all acceptance criteria `done: true`; manual criteria require recorded human verification before being marked complete. Clear the active `claim` while retaining assignee and branch for attribution. Only an explicitly human-initiated CLI action can transition `agent_review` to `done`; author strings are conventions, not authentication. Direct file edits can bypass this policy.

Rework (`agent_review` → `agent_in_progress`) creates a fresh claim under the same local locking protocol and checks blockers. No other transition into `agent_in_progress` is allowed. Leaving it for any other allowed status clears the claim. Agent context and handoffs do not grant ownership. A new session resuming crashed work must use explicit human-approved takeover or release and reclaim; a handoff does not transfer a claim automatically.

Branch convention: `<type>/<issue-id>-<slug>`, using `feat`, `fix`, or `spike`. Agent identity uses `agent:<name>`. Update Markdown agent context before ending a session and create a handoff when work remains.

## 9. Validation contract

Run stages in this order; stop later stages when earlier failures make their inputs unreliable. Errors include file path, line when available, entity ID, and a fix hint. Warnings do not fail validation by default.

1. **Discovery and parsing:** Apply §2 scope, YAML/Markdown syntax, and manifest-bounded version inheritance. Unresolved Git conflict markers are errors. Reject unsupported versions without rewriting files.
2. **Schema:** Validate frontmatter/config against JSON Schema draft 2020-12 (`project.json`, `workflow.json`, `labels.json`, `prd.json`, `issue.json`, `handoff.json`). Resolve inherited version in memory, never by inserting it during reads. Preserve extension fields; reject explicitly forbidden legacy fields. Validate body/comment structure separately.
3. **Identity:** Reject duplicate entity/comment IDs and duplicate handoff `session_id` values; validate random ID shape and project prefix. Require unique, correctly formatted issue `short_id` values and a manifest counter greater than all current issue numbers. Issue and handoff filenames equal `<id>.md`; PRD filename is `prd.md`.
4. **Configuration and structure:** Validate workflow references, status enums, labels, configured paths, parent-ID resolution, and parent/path agreement. Unknown labels warn. Validate external-link field shapes and reject duplicate exact `(provider, url)` mappings without making network requests.
5. **Graph:** Resolve links and detect self-dependencies and cycles. Missing live issue/parent targets are errors; missing historical handoff targets warn.
6. **State invariants:** `ready_for_agent` and `agent_in_progress` meet readiness requirements. Only `agent_in_progress` carries a claim and it requires an agent assignee and branch. `agent_review` meets its acceptance guard. Every `done` issue has all its recorded acceptance criteria complete.

Snapshot validation can detect invalid current state but cannot prove a legal transition or identify who changed a file. CLI mutations compare old and new state and apply workflow/actor guards. A future `validate --base <git-ref>` can check transitions and append-only history against a baseline; it cannot reconstruct intermediate edits. Do not claim direct edits are fully auditable from a snapshot.

Schema enums cover fixed types and priorities; workflow status IDs are validated against project configuration, not hardcoded JSON Schema enums. Runtime validation must not shell out to acceptance commands.

## 10. Versioning and lossless writes

Unknown extension keys within a supported version survive edits. This does not authorize writing a newer unsupported version. Read-only inspection may show raw content, but must not claim successful validation against an unknown schema.

`plainpm migrate` must be an explicit, reviewable operation with a dry run. Conversion of the earlier draft `.yml` issues must name its source draft explicitly, because both drafts used `plainpm/v1`; extension guessing is not silent compatibility. Convert IDs and every live reference together, assign sequential issue short IDs, initialize the counter above them, preserve prose/comments, and reject ambiguous mappings. The intervening UUID-only Markdown draft also requires an explicit source-draft conversion; it is not silently accepted as the new random-token format. Historical documents remain outside discovery unless explicitly included in conversion.

Future released schema changes increment the version. Migration steps are named and idempotent, preserve user content, and report partial failure with a recovery path. Produce a reviewable diff; do not automatically commit user changes. No runtime supports both YAML issues and Markdown issues as alternative v1 formats.

## 11. Indexing and implementation sequence

The optional SQLite index at `.plainpm/index.sqlite` is a rebuildable cache. Reads that report fresh state must detect changed files or scan them; correctness cannot depend on a watcher having already run. Invalid files produce diagnostics and must not leave stale rows presented as current data. No file mutation waits on or writes solely to SQLite.

Implement in this order:

1. Schemas, scoped discovery, lossless parsing/writing, and validation with valid/invalid fixtures.
2. `init`, `create`, `show`, `list`, `validate`, and move operations using files directly.
3. Handoff lifecycle and PRD navigation, locally coordinated claims, dependency planning, explicit migration, and rank rebalance.
4. Optional index, watcher, and viewer.

All listed commands are planned unless implemented in the CLI. Before release, test independent random ID allocation, sequential alias allocation, duplicate aliases across branches, ambiguous lookup rejection, explicit alias repair, counter gaps/recovery, stable references after moves, dependency cycles, concurrent claims in one checkout, comment merge conflicts, byte-identical round trips, and index rebuild equivalence. Never assert that Git alone guarantees conflict-free collaboration.

### 11.1 Handoff acceptance and testing

The confirmed primary testing boundary is the CLI operating on isolated temporary workspaces. Assert resulting files, diagnostics, and navigable PRD links rather than internal helper calls. Extend the existing programmatic CLI-runner and child-process test patterns; inject clocks and random-ID generators for deterministic results.

Required observable scenarios:

- Create multi-PRD, backlog-only, and planning-only handoffs; reject missing required fields, invalid statuses, duplicate session IDs, overlapping issue lists, and invalid timestamp ordering.
- Update the same session's file without changing identity or origin metadata; create a separate entity for a new session.
- Include current issue parents and explicit planning PRDs on content saves; preserve previous associations across issue moves and status-only updates.
- Resolve and reopen with recorded reasons and actors, refreshed timestamps, and unchanged issue statuses and claims.
- List all related active/resolved handoffs with correct dates, status labels, timestamp ordering, and ID tie-breaking; follow relative URLs to their actual targets.
- Handle configured directories, moves, empty navigation, stale-link warnings, and explicit refresh while preserving authored prose.
- Recover after handoff persistence succeeds but PRD refresh fails; retries create neither duplicate handoffs nor duplicate links.
- Warn about missing historical references without removing them or blocking other valid navigation.
- Detect competing local writes instead of silently losing edits; do not claim distributed locking or conflict-free Git merges.
- Preserve bytes on no-op round trips and unrelated content during edits. Validation must neither contact cloud providers nor run verification commands.

These are implementation acceptance requirements, not claims that a runtime validator or these tests already exist.
