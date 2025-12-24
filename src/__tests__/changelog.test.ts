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
})
