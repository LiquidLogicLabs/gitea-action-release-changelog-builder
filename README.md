# Release Changelog Builder

A GitHub/Gitea Action that builds release notes/changelog from pull requests and commits, supporting multiple providers (GitHub, Gitea) with tag annotations and prefix/postfix messages.

## Features

- ✅ Multi-provider support (GitHub, Gitea - cloud and self-hosted)
- ✅ Multiple modes: PR, COMMIT, and HYBRID
- ✅ Tag annotation support
- ✅ Prefix and postfix messages
- ✅ Flexible configuration via JSON or file
- ✅ Category-based organization
- ✅ Template-based customization

## Quick Start

### Basic Usage (GitHub)

```yaml
- name: Build Changelog
  uses: LiquidLogicLabs/git-changelog-builder-action@v1
  with:
    fromTag: v1.0.0
    toTag: v1.1.0
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Basic Usage (Gitea)

```yaml
- name: Build Changelog
  uses: LiquidLogicLabs/git-changelog-builder-action@v1
  with:
    platform: gitea
    fromTag: v1.0.0
    toTag: v1.1.0
  env:
    GITEA_TOKEN: ${{ secrets.GITEA_TOKEN }}
```

### With Tag Annotations and Messages

```yaml
- name: Build Changelog
  uses: LiquidLogicLabs/git-changelog-builder-action@v1
  with:
    fromTag: v1.0.0
    toTag: v1.1.0
    fetchTagAnnotations: true
    prefixMessage: |
      # Release Notes
      
      This release includes the following changes:
    postfixMessage: |
      ---
      For more information, visit [our documentation](https://example.com/docs)
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `platform` | No | Auto-detected | Platform: `github`, `gitea`, `local`, or `git` |
| `token` | No | Environment token | Authentication token |
| `repo` | No | Current repo | Repository to use (owner/repo or URL). Defaults to current repo if omitted. |
| `fromTag` | No* | Previous tag | Previous tag to compare from |
| `toTag` | No* | Current tag | New tag to compare to |
| `mode` | No | `PR` | Mode: `PR`, `COMMIT`, or `HYBRID` |
| `configuration` | No | Defaults | Path to configuration JSON file |
| `configurationJson` | No | - | Configuration JSON string |
| `ignorePreReleases` | No | `false` | Ignore pre-release tags when finding predecessor |
| `fetchTagAnnotations` | No | `false` | Fetch tag annotation messages |
| `prefixMessage` | No | - | Message to prepend to changelog |
| `postfixMessage` | No | - | Message to append to changelog |
| `includeOpen` | No | `false` | Include open pull requests |
| `failOnError` | No | `false` | Fail the action on errors |
| `verbose` | No | `false` | Enable verbose debug logging |
| `maxTagsToFetch` | No | `1000` | Maximum number of tags to fetch when searching for tags. If a specified tag is not found in the initial batch (200 tags), more tags will be fetched up to this limit |

\* Either `fromTag`/`toTag` must be provided, or the action must run on a tag

## Outputs

| Output | Description |
|--------|-------------|
| `changelog` | The generated changelog |
| `contributors` | Comma-separated list of contributors |
| `pull_requests` | Comma-separated list of PR numbers |
| `tag_annotation` | Tag annotation message (if `fetchTagAnnotations` is enabled) |
| `owner` | Repository owner |
| `repo` | Repository name |
| `fromTag` | From tag name |
| `toTag` | To tag name |
| `failed` | Whether the action failed |

## Configuration

### Basic Configuration

You can configure the changelog format using a JSON configuration file or inline JSON:

```json
{
  "template": "#{{CHANGELOG}}",
  "pr_template": "- #{{TITLE}}\n   - PR: ##{{NUMBER}}",
  "categories": [
    {
      "title": "## 🚀 Features",
      "labels": ["feature"]
    },
    {
      "title": "## 🐛 Bug Fixes",
      "labels": ["bug", "fix"]
    }
  ]
}
```

### Configuration Options

- `template`: Main template for the changelog
- `pr_template`: Template for each pull request entry
- `commit_template`: Template for commit entries (COMMIT/HYBRID mode)
- `categories`: Array of category definitions
- `ignore_labels`: Labels to exclude from changelog

### Template Placeholders

- `#{{CHANGELOG}}` - The categorized changelog
- `#{{PR_LIST}}` - List of all PRs
- `#{{CONTRIBUTORS}}` - List of contributors
- `#{{NUMBER}}` - PR number
- `#{{TITLE}}` - PR title
- `#{{AUTHOR}}` - PR author
- `#{{URL}}` - PR URL
- `#{{LABELS}}` - PR labels

## Platform Detection

The action automatically detects the platform from environment variables:

- `GITEA_SERVER_URL` → Gitea
- `GITHUB_SERVER_URL` or `GITHUB_API_URL` → GitHub

You can also explicitly specify the platform using the `platform` input.

## Self-Hosted Gitea

For self-hosted Gitea or GitHub Enterprise, the action auto-detects the base URL when provided by the runner (e.g., `GITHUB_SERVER_URL`/`GITHUB_API_URL` for GHES, `GITEA_SERVER_URL` for Gitea). If none are present, it falls back to the standard public endpoints (`https://api.github.com` for GitHub, `https://gitea.com` for Gitea). No `baseUrl` input is needed.

## Tag Annotations

When `fetchTagAnnotations` is enabled, the action will fetch annotation messages from git tags:

```bash
# Create an annotated tag
git tag -a v1.0.0 -m "Release version 1.0.0 with major improvements"
```

The annotation will be included in the changelog output and available in the `tag_annotation` output.

## Prefix and Postfix Messages

You can add custom messages before or after the changelog:

```yaml
with:
  prefixMessage: |
    # Release Notes
    
    This release includes important updates:
  postfixMessage: |
    ---
    **Note**: Please read the migration guide before upgrading.
```

## Modes

### PR Mode (Default)

Generates changelog from merged pull requests only.

### COMMIT Mode

Generates changelog from commits between tags (no PR information).

### HYBRID Mode

Combines both PRs and commits for comprehensive changelog.

## Examples

### Full Example with Configuration

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Build Changelog
        id: changelog
        uses: LiquidLogicLabs/git-changelog-builder-action@v1
        with:
          fetchTagAnnotations: true
          prefixMessage: |
            # Release ${{ github.ref_name }}
            
          configurationJson: |
            {
              "template": "#{{CHANGELOG}}",
              "pr_template": "- #{{TITLE}} (#{{NUMBER}})",
              "categories": [
                {"title": "## Features", "labels": ["feature"]},
                {"title": "## Fixes", "labels": ["bug", "fix"]}
              ]
            }
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Create Release
        uses: actions/create-release@v1
        with:
          body: ${{ steps.changelog.outputs.changelog }}
```

## Credits

This action is inspired by and extends [mikepenz/release-changelog-builder-action](https://github.com/mikepenz/release-changelog-builder-action) by [Mike Penz](https://github.com/mikepenz).

Original action: https://github.com/mikepenz/release-changelog-builder-action

This action adds:
- Enhanced tag annotation support
- Prefix and postfix message functionality
- Improved multi-provider abstraction

## Documentation

For developers and contributors:

- **[Development Guide](docs/DEVELOPMENT.md)** - Setup, development workflow, and contributing guidelines
- **[Testing Guide](docs/TESTING.md)** - Complete testing documentation

## License

Apache-2.0

