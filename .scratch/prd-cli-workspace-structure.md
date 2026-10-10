# PRD: PlainPM CLI Workspace Structure

Status: implemented and verified on 2026-10-10. All three issues in the [local issue breakdown](issues-cli-workspace-structure.md) are complete.

## Problem Statement

PlainPM's initial CLI scaffold placed a package-shaped directory inside the root source directory while keeping its manifest, build configuration, and tests at the repository root. This made package ownership unclear and gave contributors no consistent pattern for adding future packages. The root also exposed a placeholder greeting and CLI helpers as a JavaScript API despite the current product being a terminal command.

## Solution

Use an npm workspace repository with the CLI as its own package. The CLI package owns its source, tests, runtime dependencies, build configuration, and generated output. Shared development tooling remains at the repository root, where contributors can continue running the standard build, test, lint, and typecheck commands.

Keep the existing `plainpm` npm distribution name and terminal command. The CLI has no supported public JavaScript API. Introduce additional packages only when their functionality is implemented.

## User Stories

1. As a contributor, I want packages organized at the repository root, so that package boundaries are immediately visible.
2. As a CLI maintainer, I want the CLI source inside its own package, so that implementation ownership is clear.
3. As a CLI maintainer, I want tests alongside the package they exercise, so that source and behavioral verification evolve together.
4. As a maintainer, I want the CLI to have its own manifest, so that its runtime dependencies and executable are declared together.
5. As a contributor, I want one root dependency installation and lockfile, so that workspace setup stays consistent.
6. As a contributor, I want shared TypeScript, lint, and test defaults, so that packages follow consistent conventions.
7. As a CLI maintainer, I want package-local build and test configuration, so that CLI-specific settings remain with the CLI.
8. As a contributor, I want root scripts to run workspace checks, so that routine development does not require navigating between packages.
9. As a contributor, I want a CLI watch command, so that source changes can be rebuilt during development.
10. As a terminal user, I want the `plainpm` command and its help and version behavior preserved, so that this structural change does not change how I invoke it.
11. As a package consumer, I want the CLI artifact included in the distribution, so that installation provides a runnable command.
12. As a maintainer, I want to avoid committing to a public JavaScript API prematurely, so that internal CLI helpers can evolve freely.
13. As a test author, I want internal CLI helpers to remain importable without starting the command, so that programmatic tests stay straightforward.
14. As a future contributor, I want a repeatable package layout, so that reusable core functionality can be added when needed.

## Implementation Decisions

- Use npm workspaces with a private root package named `plainpm-workspace`.
- Place the CLI in a root-level package directory named `plainpm-cli`, with its own source and test directories. This is a real workspace package rather than a directory nested inside shared source.
- Retain `plainpm` as the CLI package's npm name and executable name. The directory name and distribution name intentionally differ.
- Keep shared development dependencies, ESLint configuration, TypeScript defaults, Jest defaults, and the npm lockfile at the root.
- Give the CLI its own manifest, TypeScript configuration, tsup configuration, and Jest configuration. Package configuration extends shared defaults where applicable.
- Declare yargs and its type dependency with the CLI package.
- Separate the executable entry point from the internal CLI runner. The executable invokes the runner directly; tests import the runner without starting a process implicitly.
- Remove the placeholder greeting, its sanity test, and the root library entry point. Do not provide a supported public JavaScript API or generate library declarations.
- Emit the CLI executable and source map into the CLI package's generated output directory. Include generated output in the npm distribution.
- Delegate root build, test, and typecheck scripts to workspaces. Keep linting shared and direct the root development script to the CLI workspace.
- Build during package preparation and before running CLI tests, so installation can link the executable and process tests use current output.
- Update repository guidance to describe the implemented organization. No project-data format or schema changes are required.

## Testing Decisions

- Prefer the existing CLI boundary: assert observable help, version, process exit behavior, and package execution rather than internal directory or helper implementation details.
- Preserve the existing programmatic help test and child-process help and version tests, moving them with the CLI package and updating their imports.
- Keep the programmatic runner as an internal testing seam; it does not establish a public API.
- Run the build before process tests to avoid validating stale output.
- Typecheck both package source and tests, and run shared lint checks from the root.
- Verify root workspace build dispatch, execution through npm's linked `plainpm` command, and package contents through an npm pack dry run.
- These decisions follow the existing CLI scaffold's programmatic and child-process test patterns. No new testing framework is needed.

## Out of Scope

- Implementing parsing, serialization, validation, filesystem adapters, project-management commands, indexing, or a viewer.
- Creating a core package before reusable core functionality exists.
- Publishing to npm or opening an issue in an external tracker.
- Changing the PlainPM workspace data format, entity identity rules, or handoff semantics.
- Migrating historical plans or restructuring the Bruno reference checkout.
- Introducing a public JavaScript API, new package manager, or additional build orchestration framework.
- Upgrading Node.js or existing tooling dependencies.

## Further Notes

- This PRD records the design agreed during the conversation and the restructuring already implemented in the working tree; it is not a claim that future PlainPM features exist.
- The user explicitly selected npm workspaces, a CLI-only package, and package-owned tests. Shared tooling remains at the root.
- The agreed concrete location is `packages/plainpm-cli/src/`, with tests in `packages/plainpm-cli/tests/`.
- Verification completed: workspace build, all three CLI tests, TypeScript checks, lint, linked CLI help and version, and package-content dry run.
- npm reported engine warnings from existing development dependencies under Node.js 24.11.0; the checks above still passed. Resolving those version requirements is separate work.
- This document is saved locally in `.scratch` as requested. No tracker publication is part of this capture.

- Follow-up Ralph/TDD execution verified the issues in parallel, including a live watch rebuild, root failure propagation, a clean offline dependency installation, and package preparation. No additional implementation gap was found. The final three-test suite, typecheck, and lint passed.
