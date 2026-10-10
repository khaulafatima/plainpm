# Completed issues: PlainPM CLI workspace structure

Source PRD: [PlainPM CLI Workspace Structure](prd-cli-workspace-structure.md)

Status: all three issues completed and verified on 2026-10-10. The user authorized the breakdown for parallel execution with Ralph and TDD. The restructuring was already implemented in the working tree; this pass verified the acceptance criteria rather than duplicating the implementation. No external tracker issues have been created.

## 1. Done — Run PlainPM from its own npm workspace package

User stories covered: 1, 2, 3, 4, 5, 7, 10, 12, 13.

### What to build

Make the CLI a real npm workspace package that owns its source, tests, runtime dependencies, and executable build. Keep the distribution name and command as `plainpm`, and make the repository root private. Separate executable startup from the internal command runner so importing helpers in tests does not invoke the command. Remove the placeholder greeting and supported library entry point.

Deliver a complete build-to-execution path with the existing programmatic and child-process CLI tests running inside the package.

### Acceptance criteria

- [x] One root npm installation and lockfile resolve the CLI workspace and its declared dependencies.
- [x] The private root manages a CLI workspace whose directory is named `plainpm-cli` and whose npm name remains `plainpm`.
- [x] The CLI owns its source, tests, manifest, and build configuration; the old root source and test scaffolding is removed.
- [x] Building the package creates its executable output within the package.
- [x] The built CLI prints help and version `1.0.0` and exits successfully for both requests.
- [x] Internal CLI helpers remain importable without automatically starting the command.
- [x] The greeting implementation, greeting-only test, and public library entry point are removed; library declarations are not generated.
- [x] The existing programmatic help test and both process tests pass from their new package location.

### Blocked by

None - can start immediately.

### Existing evidence

Implemented in the working tree. Package build and all three CLI tests passed. Workspace dependency installation succeeded using the existing local dependencies.

## 2. Done — Provide a consistent root development workflow

User stories covered: 3, 6, 7, 8, 9, 14.

### What to build

Let contributors build, test, typecheck, lint, and watch the CLI from the repository root while keeping package-specific behavior owned by the CLI. Share TypeScript and Jest defaults and ESLint tooling without duplicating their configuration. Make tests build current executable output before exercising the CLI. Update contributor guidance to explain the package organization and commands.

### Acceptance criteria

- [x] Root build, test, and typecheck scripts dispatch to workspace scripts and report failures through their exit status.
- [x] CLI TypeScript configuration checks both source and tests using shared defaults.
- [x] CLI Jest configuration reuses shared defaults and discovers the package's CLI tests.
- [x] Running the root test command builds current CLI output before running process tests.
- [x] Root linting covers the workspace code while preserving existing exclusions for generated output and reference content.
- [x] The root development command starts the CLI watcher; a source change rebuilds the executable without restarting the watcher.
- [x] Repository guidance explains package ownership, shared tooling, and the lack of a public JavaScript API without claiming future packages exist.
- [x] Root build, test, typecheck, and lint commands all pass.

### Blocked by

Issue 1: Run PlainPM from its own npm workspace package.

### Existing evidence

Implemented in the working tree. Root build, test, typecheck, and lint passed. In an isolated copy, the root development command rebuilt after a source edit and the executable reflected that edit while the same watcher remained running. Root typecheck returned exit 2 for an intentional type error; root build and test propagated an injected workspace exit 23. The final root test run rebuilt first, all three CLI tests passed, and typecheck and lint passed.

## 3. Done — Make workspace installation and packaging deliver the CLI

User stories covered: 4, 5, 10, 11, 12.

### What to build

Ensure package preparation builds the CLI so npm can link the `plainpm` command, and ensure the distributable includes executable output without exposing a library entry point. Verify the user-visible command through npm's workspace link and inspect package contents without publishing anything.

### Acceptance criteria

- [x] Package preparation builds the executable during normal development installation and packaging.
- [x] Installing the workspace with lifecycle scripts enabled makes the `plainpm` command available through npm execution.
- [x] The linked command prints help and version successfully.
- [x] An npm pack dry run includes the executable and source map, with no source tests or public library declaration artifact.
- [x] The package retains its executable mapping and runtime dependency declarations.
- [x] The root remains private, and no npm publication is performed.

### Blocked by

Issue 1: Run PlainPM from its own npm workspace package.

### Existing evidence

Implemented in the working tree. Installation with lifecycle scripts enabled and linked CLI help/version passed. A package dry run included the executable, source map, and manifest. An isolated copy with no dependencies or generated output passed npm ci offline (627 packages), linked CLI help/version, and a package dry run that invoked preparation and included exactly the executable (mode 755), source map, and manifest. Existing tooling emitted Node engine warnings; a runtime upgrade is outside this PRD.

## Completed dependency order

Issue 1 establishes the runnable workspace package. Issues 2 and 3 can then be accepted independently. No separate prefactoring issue is needed for this small scaffold migration.

## Execution notes

- Issue 1 was verified locally; issues 2 and 3 were checked in parallel by separate agents using isolated temporary copies.
- Existing CLI tests and package typechecking passed before the final full suite. The final root suite, typecheck, lint, and diff whitespace checks passed.
- No new behavior or bug fix was needed in this pass, so no new red-to-green implementation cycle is claimed. Existing behavioral tests were reused, and deliberate faults in the isolated workflow copy verified failure propagation.
- All issue acceptance criteria are checked. Changes remain in the working tree; nothing was committed or published.
