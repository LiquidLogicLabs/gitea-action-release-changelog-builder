# E2E Failure Details (changelog-parser & tag-floating-version)

## 1. git-action-changelog-parser — "Version Unreleased not found"

### What the E2E does

- **Workflow:** `.github/workflows/e2e-tests.yml` (job `e2e-github`)
- **First step:** "Test local changelog parsing"
  - Runs the action with:
    - `path: ./CHANGELOG.md`
    - `version: Unreleased`
  - Expects the action to find a changelog entry for the version `Unreleased` and set outputs (version, date, status).

### When it runs from the release workflow

- Release is triggered by **tag** (e.g. `v1.0.10`).
- The release workflow calls the E2E workflow; the **ref** is that tag.
- **Checkout** is therefore at the tag (e.g. `refs/tags/v1.0.10`), not at `main`.
- So the E2E runs against **CHANGELOG.md as it exists at that tag**.

### Why it fails at a tag

1. **Parser only matches `##` headings**  
   In `src/parser.ts`, version headers are matched by:
   ```ts
   /^##\s+\[([^\]]+)\](?:\([^)]+\))?(?:\s*\(([^)]+)\))?(?:\s*-\s*([^-\n]+))?/
   ```
   So only lines starting with `## [version]` (two `#`) are treated as version entries.

2. **CHANGELOG at v1.0.10**  
   At the tag, the top entry is:
   ```markdown
   ### [1.0.10](https://github.com/...) (2026-01-30)
   ```
   That is **three** `#`, so it does **not** match the parser. The parser only sees entries like `## [1.0.6]`, `## [1.0.5]`, etc.

3. **No Unreleased at release tags**  
   There is no `## [Unreleased]` (or `### [Unreleased]`) in CHANGELOG at the tag. "Unreleased" is typically removed or replaced when cutting a release.

4. **Result**  
   The action looks for a version entry `Unreleased` in the parsed entries, finds none, and fails with **"Version \"Unreleased\" not found"**.

### Summary

| Factor | Detail |
|--------|--------|
| E2E input | `path: ./CHANGELOG.md`, `version: Unreleased` |
| Ref when called from release | Tag (e.g. `v1.0.10`) |
| CHANGELOG at tag | Top entry is `### [1.0.10]` (not matched); no `## [Unreleased]` |
| Parser | Only `## [version]` lines are version entries |
| Failure | No entry for "Unreleased" → error |

### Possible fixes (for maintainers)

- **Option A:** In E2E, when running under a tag ref, use a version that exists at that ref (e.g. pass `version` from `github.ref_name` like `1.0.10` for the local test) instead of `Unreleased`.
- **Option B:** Use a CHANGELOG fixture or a dedicated test file that always has `## [Unreleased]` so the E2E is independent of the repo’s real CHANGELOG at tag.
- **Option C:** Keep "Unreleased" in CHANGELOG at release time (e.g. don’t remove it when cutting a release) so that at the tag the entry still exists (may conflict with typical release habits).

---

## 2. git-action-tag-floating-version — "Failed to push tag v1"

### What the E2E does

- **Workflow:** `.github/workflows/e2e-tests.yml` (job `e2e`)
- **Step:** "Smoke test - action runs from committed dist"
  - Runs the action with `tag: v1.0.0` (and defaults).
  - The action resolves the tag, then **creates/updates** floating tags (e.g. `v1`, `v1.0`) and **pushes** them to the remote.

### Why it fails

- **Current permissions:** The E2E workflow has `permissions: contents: read`.
- **Action behavior:** The floating-version action runs `git push` (e.g. `force pushing tag v1 to remote`). Pushing refs requires **write** access to the repository.
- **Result:** Git push fails with exit code 128 (permission/ref update denied), so the step fails with **"Failed to push tag v1"**.

### Summary

| Factor | Detail |
|--------|--------|
| E2E permissions | `contents: read` only |
| Action | Updates local tags and pushes them to `origin` |
| Required | `contents: write` (to push refs/tags) |
| Failure | `git push` → exit 128 → "Failed to push tag v1" |

### Fix applied

- In **git-action-tag-floating-version** `.github/workflows/e2e-tests.yml`, set:
  - `permissions: contents: write`
  so the job can push the tags the action creates/updates.

---

## References

- changelog-parser E2E run (failed): release run 21517422607, job `e2e-tests / e2e-github`
- tag-floating-version E2E run (failed): release run 21517426032, job `e2e-tests / e2e`
- changelog-parser parser: `src/parser.ts` (version header regex and entry parsing)
- tag-floating-version action: pushes tags in its main logic; E2E runs that path with `tag: v1.0.0`
