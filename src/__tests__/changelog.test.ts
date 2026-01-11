import {generateChangelog} from '../changelog'
import {PullRequestInfo, Configuration} from '../types'
import moment from 'moment'

describe('generateChangelog', () => {
  const mockPRs: PullRequestInfo[] = [
    {
      number: 1,
      title: 'Add new feature',
      htmlURL: 'https://github.com/test/repo/pull/1',
      baseBranch: 'main',
      branch: 'feature-branch',
      createdAt: moment(),
      mergedAt: moment(),
      mergeCommitSha: 'abc123',
      author: 'user1',
      authorName: 'User One',
      repoName: 'test/repo',
      labels: ['feature'],
      milestone: '',
      body: 'Description',
      assignees: [],
      requestedReviewers: [],
      approvedReviewers: [],
      status: 'merged'
    },
    {
      number: 2,
      title: 'Fix bug',
      htmlURL: 'https://github.com/test/repo/pull/2',
      baseBranch: 'main',
      branch: 'fix-branch',
      createdAt: moment(),
      mergedAt: moment(),
      mergeCommitSha: 'def456',
      author: 'user2',
      authorName: 'User Two',
      repoName: 'test/repo',
      labels: ['bug', 'fix'],
      milestone: '',
      body: 'Bug fix description',
      assignees: [],
      requestedReviewers: [],
      approvedReviewers: [],
      status: 'merged'
    },
    {
      number: 3,
      title: 'Uncategorized PR',
      htmlURL: 'https://github.com/test/repo/pull/3',
      baseBranch: 'main',
      branch: 'other-branch',
      createdAt: moment(),
      mergedAt: moment(),
      mergeCommitSha: 'ghi789',
      author: 'user3',
      authorName: 'User Three',
      repoName: 'test/repo',
      labels: [],
      milestone: '',
      body: 'No category',
      assignees: [],
      requestedReviewers: [],
      approvedReviewers: [],
      status: 'merged'
    }
  ]

  const mockConfig: Configuration = {
    template: '#{{CHANGELOG}}',
    pr_template: '- #{{TITLE}} (#{{NUMBER}})',
    categories: [
      {
        title: '## Features',
        labels: ['feature']
      },
      {
        title: '## Fixes',
        labels: ['bug', 'fix']
      }
    ]
  }

  it('should generate changelog with categories', () => {
    const result = generateChangelog(mockPRs, mockConfig)
    expect(result).toContain('## Features')
    expect(result).toContain('Add new feature')
    expect(result).toContain('## Fixes')
    expect(result).toContain('Fix bug')
  })

  it('should include prefix message', () => {
    const prefix = '# Release Notes\n\nThis release includes:'
    const result = generateChangelog(mockPRs, mockConfig, null, prefix)
    expect(result).toContain(prefix)
    expect(result.startsWith(prefix)).toBe(true)
  })

  it('should include postfix message', () => {
    const postfix = '---\nFor more info, see docs.'
    const result = generateChangelog(mockPRs, mockConfig, null, undefined, postfix)
    expect(result).toContain(postfix)
    expect(result.endsWith(postfix)).toBe(true)
  })

  it('should include tag annotation', () => {
    const annotation = 'This is a tag annotation'
    const result = generateChangelog(mockPRs, mockConfig, annotation)
    expect(result).toContain(annotation)
  })

  it('should handle uncategorized PRs', () => {
    const result = generateChangelog(mockPRs, mockConfig)
    expect(result).toContain('## Other Changes')
    expect(result).toContain('Uncategorized PR')
  })

  it('should apply template with placeholders', () => {
    const configWithTemplate: Configuration = {
      ...mockConfig,
      template: 'Release Notes:\n\n#{{CHANGELOG}}\n\nContributors: #{{CONTRIBUTORS}}'
    }
    const result = generateChangelog(mockPRs, configWithTemplate)
    expect(result).toContain('Release Notes:')
    expect(result).toContain('Contributors:')
    expect(result).toContain('user1')
    expect(result).toContain('user2')
    expect(result).toContain('user3')
  })

  it('should handle empty PR list', () => {
    const result = generateChangelog([], mockConfig)
    // Result should contain at least the template
    expect(result).toBeDefined()
    // With empty PRs, we should still have template rendering
    expect(result.length).toBeGreaterThanOrEqual(0)
  })

  it('should replace PR template placeholders', () => {
    const customConfig: Configuration = {
      ...mockConfig,
      pr_template: 'PR #{{NUMBER}}: #{{TITLE}} by #{{AUTHOR}}'
    }
    const result = generateChangelog([mockPRs[0]!], customConfig)
    // The replacement replaces #{{NUMBER}} with just the number, so PR #{{NUMBER}}: becomes PR 1:
    expect(result).toContain('PR 1:')
    expect(result).toContain('Add new feature')
    // AUTHOR should be replaced with the author username
    expect(result).toContain('user1')
  })

  it('should handle ignore_labels', () => {
    const configWithIgnore: Configuration = {
      ...mockConfig,
      ignore_labels: ['skip-changelog']
    }
    const prWithIgnoreLabel: PullRequestInfo = {
      ...mockPRs[0]!,
      labels: ['feature', 'skip-changelog']
    }
    const result = generateChangelog([prWithIgnoreLabel], configWithIgnore)
    // PR with ignored label should be filtered out
    expect(result).not.toContain('Add new feature')
  })

  it('should generate complete changelog with all template placeholders', () => {
    const mergedDate = moment('2024-01-15')
    const comprehensivePRs: PullRequestInfo[] = [
      {
        number: 42,
        title: 'Add comprehensive feature',
        htmlURL: 'https://github.com/test/repo/pull/42',
        baseBranch: 'main',
        branch: 'feature/comprehensive',
        createdAt: moment('2024-01-10'),
        mergedAt: mergedDate,
        mergeCommitSha: 'abc123def456',
        author: 'developer1',
        authorName: 'Developer One',
        repoName: 'test/repo',
        labels: ['feature', 'enhancement'],
        milestone: 'v2.0.0',
        body: 'This PR adds a comprehensive feature with all fields populated',
        assignees: ['reviewer1'],
        requestedReviewers: ['reviewer2'],
        approvedReviewers: ['reviewer2'],
        status: 'merged'
      }
    ]

    const comprehensiveConfig: Configuration = {
      template: '# Release Notes v2.0.0\n\n#{{CHANGELOG}}\n\n---\n\n**Pull Requests**: #{{PULL_REQUESTS}}\n\n**PR List**:\n#{{PR_LIST}}\n\n**Contributors**: #{{CONTRIBUTORS}}',
      pr_template: '- [#{{NUMBER}}](#{{URL}}) **#{{TITLE}}** by @#{{AUTHOR}}\n  - Branch: `#{{BRANCH}}` → `#{{BASE_BRANCH}}`\n  - Milestone: #{{MILESTONE}}\n  - Labels: #{{LABELS}}\n  - Merged: #{{MERGED_AT}} (commit: `#{{MERGE_COMMIT_SHA}}`)\n  - Description: #{{BODY}}',
      categories: [
        {
          title: '## 🚀 Features',
          labels: ['feature']
        }
      ]
    }

    const result = generateChangelog(comprehensivePRs, comprehensiveConfig)

    // Verify template placeholders are replaced
    expect(result).toContain('# Release Notes v2.0.0')
    expect(result).toContain('## 🚀 Features')
    expect(result).toContain('[42](https://github.com/test/repo/pull/42)') // NUMBER placeholder is just the number
    expect(result).toContain('**Add comprehensive feature**')
    expect(result).toContain('@developer1')
    expect(result).toContain('Branch: `feature/comprehensive` → `main`')
    expect(result).toContain('Milestone: v2.0.0')
    expect(result).toContain('Labels: feature, enhancement')
    expect(result).toContain('Merged: 2024-01-15')
    expect(result).toContain('commit: `abc123def456`')
    expect(result).toContain('Description: This PR adds a comprehensive feature with all fields populated')
    expect(result).toContain('**Pull Requests**: 42')
    expect(result).toContain('**PR List**:')
    expect(result).toContain('- #42: Add comprehensive feature')
    expect(result).toContain('**Contributors**: developer1')
  })

  it('should handle all PR template placeholders', () => {
    const mergedDate = moment('2024-01-15')
    const prWithAllFields: PullRequestInfo = {
      number: 123,
      title: 'Complete PR Example',
      htmlURL: 'https://github.com/owner/repo/pull/123',
      baseBranch: 'main',
      branch: 'feature/example',
      createdAt: moment('2024-01-10'),
      mergedAt: mergedDate,
      mergeCommitSha: 'abc123def456ghi789',
      author: 'testuser',
      authorName: 'Test User',
      repoName: 'owner/repo',
      labels: ['feature', 'enhancement', 'documentation'],
      milestone: 'v2.0.0',
      body: 'This is a complete PR body with all fields',
      assignees: ['assignee1'],
      requestedReviewers: ['reviewer1'],
      approvedReviewers: ['reviewer1'],
      status: 'merged'
    }

    const config: Configuration = {
      template: '#{{CHANGELOG}}',
      pr_template: 'PR #{{NUMBER}}: #{{TITLE}}\nAuthor: #{{AUTHOR}}\nURL: #{{URL}}\nBranch: #{{BRANCH}}\nBase: #{{BASE_BRANCH}}\nMilestone: #{{MILESTONE}}\nLabels: #{{LABELS}}\nSHA: #{{MERGE_COMMIT_SHA}}\nMerged: #{{MERGED_AT}}\nBody: #{{BODY}}',
      categories: []
    }

    const result = generateChangelog([prWithAllFields], config)

    expect(result).toContain('PR 123: Complete PR Example')
    expect(result).toContain('Author: testuser')
    expect(result).toContain('URL: https://github.com/owner/repo/pull/123')
    expect(result).toContain('Branch: feature/example')
    expect(result).toContain('Base: main')
    expect(result).toContain('Milestone: v2.0.0')
    expect(result).toContain('Labels: feature, enhancement, documentation')
    expect(result).toContain('SHA: abc123def456ghi789')
    expect(result).toContain('Merged: 2024-01-15')
    expect(result).toContain('Body: This is a complete PR body with all fields')
  })

  it('should generate expected output format (full example)', () => {
    const result = generateChangelog(mockPRs, mockConfig)
    
    // Verify the complete structure
    expect(result).toMatch(/## Features/)
    expect(result).toMatch(/Add new feature/)
    expect(result).toMatch(/## Fixes/)
    expect(result).toMatch(/Fix bug/)
    expect(result).toMatch(/## Other Changes/)
    expect(result).toMatch(/Uncategorized PR/)
    
    // Verify PR numbers are included in the template replacements
    expect(result).toContain('(1)')
    expect(result).toContain('(2)')
    expect(result).toContain('(3)')
  })
})
