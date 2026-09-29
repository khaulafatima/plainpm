---
name: code-loop
description: "Execute a disciplined, iterative coding loop: scaffold placeholder files, define placeholder classes and functions, implement logic incrementally, and get reviewed by the user."
disable-model-invocation: true
---

# Ralph Code Loop

A structured, iterative coding loop for implementing tasks and vertical slices with high discipline, minimal diff noise, and clear verification checkpoints.

Instead of writing massive blocks of untested code all at once, the Ralph Code Loop moves through four distinct phases:

```
[1. Placeholder Files] ➔ [2. Placeholder Classes & Functions] ➔ [3. Fill Implementation] ➔ [4. User Review]
```

---

## The Loop Workflow

### Phase 1: Break Down into Placeholder Files

Before writing logic, identify the boundaries and filesystem footprint of the change.

1. **Identify Required Files**: Based on the PRD, issue, or task, determine what files need to be created or modified (e.g., domain types, pure logic, adapters, tests).
2. **Create Empty/Placeholder Files**: Touch and scaffold the file paths directly on disk.
3. **Establish Placement**: Follow repo conventions (e.g., package structure, one entity per file, co-located tests or fixtures).
4. **Resist Early Logic**: Do not write algorithms or business logic during this step. Focus purely on establishing where things live.

---

### Phase 2: Define Placeholder Classes and Functions

Establish the public contracts and interfaces before touching implementation details.

1. **Declare Types & Interfaces**: Define data structures, inputs, and return types. Use strict typing without shortcuts.
2. **Scaffold Classes & Function Signatures**:
   - Write function declarations with full signatures and docstrings.
   - Define class names, constructors, and method signatures.
   - Use stub implementations (e.g., `throw new Error("Not implemented")` or minimal return placeholders).
3. **Verify Type-Level Wiring**:
   - Run typechecking (e.g., `pnpm typecheck` or language-equivalent) to ensure all imports, exports, and signatures resolve cleanly.
   - Ensure the module contracts align with domain glossary terms (such as `CONTEXT.md` and repository guidelines).

---

### Phase 3: Fill in Implementation

With contracts in place, fill in the implementation iteratively and safely.

1. **Work in Tracer Bullets / Seams**:
   - Use `/tdd` where applicable: write a test verifying observable behavior against the public interface (RED).
   - Write the minimal code necessary to make the test pass (GREEN).
2. **Keep Functions Pure and Focused**:
   - Keep core domain logic pure and isolated from side effects or filesystem access.
   - Adhere strictly to project conventions (e.g., clear error messages, line-oriented formats, no hidden mutable state).
3. **Verify Continuously**:
   - Run single test files as each function is implemented.
   - Run typechecks regularly to catch contract mismatches early.
   - Run the full test suite when the slice is fully filled.

---

### Phase 4: User Review & Sign-Off

Never assume completion without explicit user verification.

1. **Prepare Review Summary**:
   - List files created and modified.
   - Highlight newly introduced public interfaces, classes, and functions.
   - Summarize passing tests and verification commands run.
   - Highlight any assumptions, trade-offs, or decisions made.
2. **Request User Review**:
   - Present the diff/summary clearly to the user.
   - Ask for confirmation: "Does this structure and implementation meet expectations, or should any adjustments be made before finalizing?"
3. **Iterate or Complete**:
   - Incorporate feedback from the user.
   - Once approved, commit cleanly or proceed to the next task in the loop.

---

## Iteration Checklist

Run through this checklist on every iteration of the loop:

```
[ ] Phase 1: Placeholder files created in correct directories
[ ] Phase 2: Placeholder classes, functions, and interfaces declared with exact types
[ ] Phase 2: Typecheck passes with stubs in place
[ ] Phase 3: Observable behavior tested via public interfaces
[ ] Phase 3: Minimal implementation fills stubs to satisfy tests
[ ] Phase 3: Tests pass and typecheck clean
[ ] Phase 4: Implementation presented to user with decisions surfaced
[ ] Phase 4: User feedback received and addressed
```
