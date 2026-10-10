---
schema_version: "plainpm/v1"
kind: prd
id: "PRD-t8v4n7q2"
title: "Session handoffs with PRD navigation"
status: draft
---

# Session handoffs with PRD navigation

## Problem Statement

People and coding agents need to resume project work without reconstructing the previous conversation. Issue files describe the work, but can miss unfinished reasoning, unresolved decisions, and useful next actions. A session can cover multiple PRDs and backlog issues, making a PRD-owned handoff an incomplete representation of its context.

The current repository has a CLI scaffold and draft format documentation, but no implemented handoff lifecycle or navigation generator. Existing handoff conventions also disagree about storage location. A user browsing a PRD on GitHub needs clickable links to its handoffs without running PlainPM, while an agent needs stable references that survive folder renames. As handoffs accumulate, readers need to distinguish continuation notes that still require attention from notes that have been addressed.

## Solution

Provide one persistent handoff per session per workspace, stored in the workspace-level handoffs directory. Let that handoff cover multiple PRDs and backlog issues. Refresh the same handoff when its session resumes; create a separate handoff for a different session.

Use stable random IDs to associate handoffs with PRDs and issues. On handoff creation or continuation-content updates, include the parent PRDs of referenced issues together with explicitly selected planning PRDs and previously recorded associations. Preserve that historical context when issues later move.

Show all related handoffs as clickable links in each PRD, ordered by most recently updated first. Include the updated UTC date, handoff status, and ID in every label. Keep these links rebuildable from handoff associations. Mark handoffs active while their continuation notes need attention and resolved when those notes have been addressed or explicitly dismissed.

## User Stories

1. As a developer, I want to save continuation context before stopping unfinished work, so that another session can resume efficiently.
2. As an agent, I want a persistent workspace handoff, so that useful context survives the end of my conversation.
3. As a developer, I want one handoff to cover multiple PRDs, so that a session spanning several features has one coherent summary.
4. As an agent, I want to include backlog issues without a PRD, so that ungrouped work can also be handed off.
5. As a developer, I want planning-only PRDs in a handoff, so that unresolved design discussions are retained even before issues exist.
6. As an agent, I want referenced issues' parent PRDs included automatically on save, so that I do not accidentally hide a handoff from a relevant PRD.
7. As a developer, I want previously recorded PRD associations preserved after issue moves, so that historical context remains discoverable.
8. As a developer, I want an explicit way to correct an incorrect association, so that mistakes can be repaired without automatic history pruning.
9. As an agent, I want stable ID references, so that folder renames do not change what a handoff refers to.
10. As a GitHub reader, I want clickable handoff links inside a PRD, so that I can browse continuation context without installing PlainPM.
11. As a developer, I want all related handoffs listed, so that older context is not hidden by a display limit.
12. As a reader, I want handoffs sorted by updated time, so that recent context is easiest to find.
13. As a reader, I want dates and statuses in link labels, so that I can judge freshness and whether notes need attention.
14. As an agent, I want reverse PRD-to-handoff lookup derived from the same association, so that competing relationship records do not drift.
15. As a developer, I want to rebuild stale navigation explicitly, so that direct file edits and moves can be repaired without rewriting authored prose.
16. As a developer, I want interrupted navigation updates reported, so that I can retry without losing the saved handoff.
17. As an agent resuming the same session, I want to update its existing handoff, so that the next reader receives one current summary.
18. As an agent starting a different session, I want a separate handoff, so that the origin of each summary stays clear.
19. As a developer, I want creation and update timestamps, so that I can distinguish initial capture from subsequent revisions.
20. As a developer, I want committed earlier summaries available through Git, so that I can inspect earlier reasoning when needed.
21. As a reader, I want active and resolved statuses, so that I can distinguish pending continuation notes from historical context.
22. As an agent, I want to resolve an earlier session's handoff with a reason and actor recorded, so that completed continuation work no longer appears pending.
23. As a developer, I want to reopen a resolved handoff explicitly, so that renewed questions can receive attention again.
24. As a developer, I want resolving a handoff to leave issues and claims unchanged, so that note resolution cannot accidentally complete or release work.
25. As a reader, I want missing historical references reported without deleting them, so that later entity deletion does not erase the session record.
26. As a developer, I want simultaneous local writers to detect conflicts, so that one session does not silently overwrite another's edits.
27. As an agent, I want handoff issue lists to be unique and mutually disjoint, so that the recorded snapshot is internally consistent.
28. As a developer, I want handoffs required for unfinished continuation but optional for completed work, so that useful context is captured without mandatory empty reports.
29. As a reader, I want optional suggested skills, so that the next session can identify relevant working methods.
30. As a developer, I want the persisted files to remain authoritative, so that deleting an index never loses handoff data or associations.

## Implementation Decisions

- Implement the handoff capability through the existing CLI boundary, with pure parsing and validation logic and thin filesystem adapters. Command names and argument syntax remain to be specified; this PRD describes required behavior, not an existing command API.
- Store one Markdown entity with YAML frontmatter per handoff in the configured workspace-level handoffs directory. Uniqueness of session ID is scoped to the workspace. Never use a PRD folder or the operating system's temporary directory for the authoritative handoff.
- Require kind, immutable random ID, active/resolved status, creation and update timestamps, originating author, session ID, and context. Suggested skills are optional.
- Use the agreed eight-character random-token identity convention and an ID-based filename. Handoffs do not receive sequential issue short IDs.
- Context contains completed, in-progress, and remaining issue-ID arrays. Arrays are individually unique and mutually disjoint. Optional PRD references are a unique array; the former singular PRD field is invalid. The current draft also allows an optional branch string.
- At explicit creation or continuation-content save, union resolvable referenced issues' current parent PRDs with explicit planning PRDs and prior associations. Backlog issues contribute no parent. Preserve existing order and append new IDs in ASCII order.
- Preserve historical associations during issue moves, reads, indexing, navigation refresh, and status-only updates. An explicit later continuation save may add a new parent without dropping the earlier one. Explicit corrections cannot exclude the current parent of an issue still referenced.
- Warn on unresolved historical references and retain them. Do not infer former parents or require historical PRD associations to equal present-day issue parents.
- Updating a resumed session preserves its identity, original session, creation time, and filename, while refreshing continuation content and update time. Creation sets both timestamps equally. Update time cannot precede creation time.
- A new session gets a new handoff even when continuing the same issues. A session may resolve another session's handoff without adopting its identity or rewriting its historical issue lists.
- Active means continuation notes need attention. Resolved means those notes were addressed or explicitly dismissed. Resolution and reopening are explicit actions with reasons recorded in the body; record the acting person or agent when changing status. Preserve the originating author and session.
- Resolve a multi-PRD handoff only after addressing its continuation notes across the covered PRDs. Never resolve automatically because issues completed, time elapsed, or a newer handoff appeared. Resolution does not require every referenced issue to be done.
- Creation is required when unfinished work or unresolved decisions need another session. Completed-work handoffs are optional and may begin resolved. This is an agent workflow requirement; filesystem validation cannot observe every session ending.
- Derive PRD navigation from persisted handoff associations. Persist ordinary relative Markdown links in a marked, replaceable section while preserving surrounding authored prose. Do not introduce a second authoritative relationship array in PRDs.
- List all related active and resolved handoffs without truncation, sorted by updated instant descending and ID ascending for ties. Labels contain the UTC updated date, status, and handoff ID; a descriptive title is optional.
- Refresh affected PRD links explicitly after association, path, status, or update-time changes. Compute relative URLs from actual configured locations and encode path segments where necessary. Empty result sets retain an empty bounded section.
- Warn about stale, broken, or mismatched generated links. Reads and indexing do not mutate PRDs. Multi-file refresh is not atomic; report partial failure and support an idempotent retry.
- Use the shared workspace writer lock, reread current state, and compare expected content before replacing a file. Persist individual file updates through same-directory temporary files and atomic replacement. These guarantees apply to cooperating local writers, not independent clones or arbitrary editors.
- Preserve unknown supported-version fields, YAML comments, key order, Markdown, and line endings. No-op round trips are byte-identical. Do not reformat unrelated content.
- Keep claims and issue workflow separate from handoff state. Reading, creating, resolving, or reopening a handoff does not transfer ownership, release claims, or change issue status.
- Align the existing hand-off authoring skill with workspace storage when implementing this capability; its current temporary-directory instruction conflicts with the agreed design.

## Testing Decisions

- Confirmed primary testing seam: exercise CLI operations against isolated temporary workspaces and assert resulting files, diagnostics, and navigable links. Prefer this public behavior boundary over exposing implementation helpers solely for tests.
- Existing CLI tests already use the programmatic command runner and child-process invocation. Extend those patterns for handoff behavior. Parsing, validation, and filesystem adapters should be exercised through this boundary wherever practical.
- Verify creation for multi-PRD, backlog-only, and planning-only sessions; enforce required fields, valid statuses, unique session IDs, disjoint issue lists, and timestamp ordering.
- Verify that updating the same session changes the existing file and that a different session receives a different entity without replacing the first.
- Verify automatic PRD inclusion, explicit additional associations, deterministic deduplication, and preservation of historical associations after an issue moves. Confirm that status-only changes do not derive new associations.
- Verify both status transitions, recorded reasons, preservation of origin metadata, refreshed timestamps, and unchanged issue states and claims.
- Verify that all handoffs remain visible, including resolved ones; sort by actual timestamp instants with deterministic ID ties. Check dates/statuses in labels and follow relative links to their targets.
- Verify custom directory locations, moved files, empty navigation, stale-link warnings, explicit refresh, and preservation of authored PRD prose.
- Verify recovery after a failure between handoff persistence and navigation updates; retry must not create a duplicate entity or link.
- Verify unresolved historical references warn without disappearing and do not prevent navigation to other valid associations.
- Verify local competing writes detect conflicts rather than lose edits. Do not claim distributed exclusivity or guaranteed clean Git merges.
- Verify byte-identical no-op round trips and preservation of unknown fields and unrelated body content during real edits.
- Inject clocks and ID generators for deterministic expectations. Tests assert public outcomes rather than helper calls or internal data structures.
- Schema and semantic validation must not contact cloud providers or execute issue verification commands.

## Out of Scope

- Implementing external cloud synchronization or publishing this PRD to a remote tracker.
- A full project-management UI, hosted service, or database of record.
- Distributed locking across independent clones or worktrees.
- Automatic Git commits or guaranteed recovery of uncommitted handoff revisions.
- Automatic issue completion, claim transfer, or claim release through handoffs.
- Retention pruning, hiding older handoffs, or deleting resolved handoffs automatically.
- Automatic rewriting of historical planning documents.
- Implementing every other PlainPM command or the optional SQLite index as a prerequisite.

## Further Notes

This is a local draft synthesized from the handoff design discussion, not a report that the feature is implemented. It builds on the current format specification and structured v1 companion. Files remain the source of truth.

The distinction between a detailed session history and a minimal continuation guide was discussed but not finally settled. The current contract still calls for accomplishments, remaining work, decisions, and known issues; avoid treating handoff snapshots as authoritative current issue status. Exact CLI syntax and portable session-ID sourcing remain implementation-design questions.

The user confirmed testing through CLI behavior and resulting workspace files. This remains a local draft; it has not been published to an external tracker.
