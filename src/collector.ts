import {BaseProvider} from './providers/base'
import {PullRequestInfo, CommitInfo, TagInfo, ProviderPlatform} from './types'
import {Logger} from './logger'
import moment from 'moment'

/**
 * Convert commits to PR-like structure
 * @param commits Array of commit info
 * @param owner Repository owner
 * @param repo Repository name
 * @returns Array of PR-like info
 */
export function convertCommitsToPRs(
  commits: CommitInfo[],
  owner: string,
  repo: string
): PullRequestInfo[] {
  const pullRequests: PullRequestInfo[] = []
  
  for (const commit of commits) {
    pullRequests.push({
      number: 0, // Commits don't have PR numbers
      title: commit.message.split('\n')[0],
      htmlURL: commit.htmlURL,
      baseBranch: '',
      branch: '',
      createdAt: commit.date,
      mergedAt: commit.date,
      mergeCommitSha: commit.sha,
      author: commit.author,
      authorName: commit.authorName,
      repoName: `${owner}/${repo}`,
      labels: [],
      milestone: '',
      body: commit.message,
      assignees: [],
      requestedReviewers: [],
      approvedReviewers: [],
      status: 'merged'
    })
  }

  return pullRequests
}

/**
 * Collect pull requests/commits based on mode
 * @param provider Provider instance
 * @param owner Repository owner
 * @param repo Repository name
 * @param fromTag From tag info
 * @param toTag To tag info
 * @param mode Collection mode (PR, COMMIT, HYBRID)
 * @param includeOpen Whether to include open PRs
 * @param platform Platform type (for validation)
 * @param logger Logger instance
 * @returns Array of PR-like info
 */
export async function collectPullRequests(
  provider: BaseProvider,
  owner: string,
  repo: string,
  fromTag: TagInfo,
  toTag: TagInfo,
  mode: string,
  includeOpen: boolean,
  platform: ProviderPlatform,
  logger: Logger
): Promise<PullRequestInfo[]> {
  const pullRequests: PullRequestInfo[] = []

  // Validate mode for local/git platform (COMMIT only)
  if ((platform === 'local' || platform === 'git') && (mode === 'PR' || mode === 'HYBRID')) {
    throw new Error(
      `PR and HYBRID modes are not supported for ${platform} platform. Use COMMIT mode instead.`
    )
  }

  if (mode === 'PR' || mode === 'HYBRID') {
    // Get PRs between dates
    const fromDate = fromTag.date || moment().subtract(365, 'days')
    const toDate = toTag.date || moment()
    
    const mergedPRs = await provider.getBetweenDates(owner, repo, fromDate, toDate, 200)
    pullRequests.push(...mergedPRs)

    if (includeOpen) {
      const openPRs = await provider.getOpen(owner, repo, 200)
      pullRequests.push(...openPRs)
    }
  }

  if (mode === 'COMMIT' || mode === 'HYBRID') {
    // Get commits and convert to PR-like structure
    const commits = await provider.getCommits(owner, repo, fromTag.name, toTag.name)
    const commitPRs = convertCommitsToPRs(commits, owner, repo)
    pullRequests.push(...commitPRs)
  }

  return pullRequests
}
