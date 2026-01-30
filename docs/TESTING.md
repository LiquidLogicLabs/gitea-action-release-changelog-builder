# Testing Guide

This document outlines testing approaches for this project.

## Test Structure

This project uses **Jest** for testing. Tests are located in the source directory.

## Running Build and E2E Locally

### Build

```bash
npm run build    # TypeScript only (tsc) — outputs to dist/
npm run package  # Full bundle (tsc + ncc) — single self-contained dist/index.js (use before release)
```

Use `npm run package` to produce the artifact that runs in CI and when the action is consumed; use `npm run build` for quick compile-only during development.

### Unit and Integration Tests

```bash
npm test                  # Run all tests
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests only
npm run test:watch        # Watch mode
npm run test:coverage     # Coverage report
```

### E2E Tests (workflow run locally with act)

E2E tests run the **committed** `dist/` via the real workflow (no build step before `uses: ./`), so they validate the packaged action. Run them locally with [act](https://github.com/nektos/act).

**Prerequisites**

- Docker
- [act](https://github.com/nektos/act) installed (e.g. `brew install act` or see project README)
- Config files (copy from samples; do not commit real tokens):
  - `.act.env` (from `.act.env.example` or `.act.env.sample`)
  - `.act.vars` (from `.act.vars.sample`) — optional; for full E2E matrix see below
  - `.act.secrets` (from `.act.secrets.sample`) — optional; for remote/tag scenarios

**Where vars and secrets come from**

- **Local (act):** Set in `.act.vars` (non-sensitive) and `.act.secrets` (tokens). Act maps these to `vars.*` and `secrets.*` in the workflow.
- **CI (GitHub/Gitea):** Set in the repo’s **TEST** environment (Environment variables and Environment secrets). The workflow uses `environment: TEST`.

**E2E vars (optional for local act)**

In `.act.vars` you can set:

- `TEST_GITHUB_REPO` — e.g. `owner/repo` for remote-repo scenarios
- `TEST_GITHUB_FROM_TAG` — from-tag when testing with explicit tags
- `TEST_GITHUB_TO_TAG` — to-tag when testing with explicit tags

In `.act.secrets`: `TEST_GITHUB_TOKEN` (or act will use `GITHUB_TOKEN` if set). Without these, only the “Local - No tags (both auto-detected)” scenario runs; the rest skip with “missing required test configuration”.

**Commands**

```bash
# Run E2E workflow (same as release pipeline’s E2E job)
npm run test:act:e2e

# Verbose output
npm run test:act:e2e:with-secrets

# Run E2E with workflow_dispatch event file
npm run test:act:e2e:dispatch
```

E2E uses the `TEST` environment; for full matrix (e.g. remote repo, tags) set the corresponding vars/secrets in `.act.vars` and `.act.secrets` (e.g. `TEST_GITHUB_REPO`, `TEST_GITHUB_TOKEN`). With minimal config, local E2E may skip some scenarios but will still run the action from `dist/`.

### CI workflow locally (lint + test)

```bash
npm run test:act:ci      # Run full CI workflow
npm run lint:act         # Run lint job only
```

### Release workflow locally (dry run)

```bash
npm run test:act:release # Push event (tag) — runs release workflow
```

Use with care; this can create/update releases if tokens and refs are real.

## Test Environment

- Local: Node.js 20+, Jest; E2E via act + Docker
- CI/CD: GitHub Actions via `.github/workflows/test.yml` and `.github/workflows/e2e-tests.yml`

## Manual Testing (action entrypoint)

1. Build: `npm run package`
2. Set inputs via env: `export INPUT_<NAME>=value` (e.g. `INPUT_platform=github`)
3. Run: `node dist/index.js`

## Writing New Tests

Follow existing test patterns, mock external dependencies, use descriptive test names.

## Troubleshooting

- Clear Jest cache: `npm test -- --clearCache`
- Reinstall: `rm -rf node_modules && npm install`
