# PRD: CLI Tool Setup (TypeScript, Yargs, tsup, Jest, antfu)

## Problem Statement

Developers and contributors to PlainPM need a robust, consistent, and maintainable TypeScript CLI foundation. Currently, the project lacks an executable CLI pipeline, a modern linting system matching contemporary standard conventions, and a test harness configured for ES Modules. Without this foundation, CLI commands cannot be authored, tested, or packaged reliably.

## Solution

Initialize a TypeScript CLI project structure within `plainpm` targeting Node.js LTS with pure ES Modules (`type: module`). The CLI is powered by Yargs for argument parsing, compiled via `tsup` for distribution, linted with `@antfu/eslint-config`, and tested with `jest` using `ts-jest`'s ESM preset.

## User Stories

1. As a CLI developer, I want a TypeScript compilation and bundling pipeline using tsup, so that I can generate clean, executable distribution artifacts with proper shebang support.
2. As a CLI developer, I want to execute the CLI via npm scripts during development without manually recompiling, so that my development feedback loop is fast.
3. As a CLI developer, I want argument parsing configured with Yargs, so that I can easily register subcommands, positional arguments, and flag options with type safety.
4. As a CLI user, I want to run `plainpm --help` and `plainpm --version`, so that I can inspect available commands and check the installed tool version.
5. As an engineer writing tests, I want Jest configured with `ts-jest` for pure ESM, so that unit and integration tests run reliably against TypeScript sources.
6. As a maintainer, I want `@antfu/eslint-config` configured for code style and linting, so that code across the repository remains clean, uniform, and automated according to modern conventions.
7. As a CI/CD system, I want standard npm scripts (`build`, `test`, `lint`, `typecheck`), so that continuous integration pipelines can validate PRs automatically.
8. As a consumer installing the package, I want an executable binary declared under the `bin` field, so that the command `plainpm` is globally or locally runnable in terminal environments.

## Implementation Decisions

- **Package Manager & Ecosystem**:
  - npm is the designated package manager for installing and managing dependencies.
  - Target Node.js LTS with pure ESM (`"type": "module"` in package manifest).
- **CLI Architecture & Routing**:
  - Yargs serves as the core CLI command dispatcher and option parser.
  - The CLI executable entry point defines a root command banner and registers command handlers.
  - Binary entry point is mapped to the package binary name `plainpm`.
- **Bundling & Build Pipeline**:
  - `tsup` is utilized to bundle the CLI into a standalone executable script in `dist/`.
  - Target modern Node runtime (`node18` or `node20`), producing ESM output, source maps, and handling shebangs automatically.
- **Code Quality & Formatting**:
  - `@antfu/eslint-config` with flat config format (`eslint.config.js` or `eslint.config.mjs`) manages linting and formatting.
  - Standard npm script `npm run lint` and `npm run lint:fix` check and format source files.
- **TypeScript Configuration**:
  - `tsconfig.json` targets `ESNext` / `NodeNext` module resolution with strict type checking enabled.

## Testing Decisions

- **Testing Seam**:
  - The primary test seam is at the CLI command execution layer: executing command action handlers directly with programmatic arguments, as well as testing end-to-end CLI invocation via child processes (verifying exit codes, stdout, and stderr).
  - External behavior and outputs are tested, avoiding reliance on internal private module states.
- **Test Framework**:
  - Jest running with `ts-jest` configured with preset `ts-jest/presets/default-esm` and `extensionsToTreatAsEsm: ['.ts']`.
  - Tests located under `tests/` or alongside source files as `*.test.ts`.

## Out of Scope

- Implementing PlainPM business logic (e.g., SQLite indexer, markdown parser, PRD validation algorithms) in this setup task.
- Multi-package monorepo workspace migration (all configuration targets the primary root package).
- Web viewer or TUI components.

## Further Notes

- Once the project skeleton, dependencies, configs, and sanity tests pass, future issue tickets will implement specific CLI subcommands according to the PlainPM specification.
