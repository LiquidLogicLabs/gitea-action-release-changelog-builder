import {BaseProvider} from './base'
import {PullRequestInfo, CommitInfo, TagInfo, DiffInfo} from '../types'
import {Octokit, RestEndpointMethodTypes} from '@octokit/rest'
import * as core from '@actions/core'
import moment from 'moment'
import {getTagAnnotation} from '../git'

type PullRequestsListData = RestEndpointMethodTypes['pulls']['list']['response']['data']
type PullData = RestEndpointMethodTypes['pulls']['get']['response']['data']

export class GithubProvider extends BaseProvider {
  private octokit: Octokit

  get defaultUrl(): string {
    return 'https://api.github.com'
  }

  get homeUrl(): string {
    return 'https://github.com'
  }

  constructor(token: string, baseUrl: string | undefined, repositoryPath: string) {
    super(token, baseUrl, repositoryPath)
    
    const apiUrl = baseUrl || this.defaultUrl

    this.octokit = new Octokit({
      baseUrl: apiUrl,
      auth: token
    })
  }

  async getTags(owner: string, repo: string, maxTagsToFetch: number): Promise<TagInfo[]> {
    const tagsInfo: TagInfo[] = []
    let page = 1
    const perPage = 100

    while (tagsInfo.length < maxTagsToFetch) {
      const response = await this.octokit.repos.listTags({
        owner,
        repo,
        per_page: Math.min(perPage, maxTagsToFetch - tagsInfo.length),
        page
      })

      if (response.data.length === 0) {
        break
      }

      for (const tag of response.data) {
        tagsInfo.push({
          name: tag.name,
          sha: tag.commit.sha,
          date: undefined
        })
      }

      if (response.data.length < perPage) {
        break
      }

      page++
    }

    return tagsInfo
  }

  async fillTagInformation(
    repositoryPath: string,
    owner: string,
    repo: string,
    tagInfo: TagInfo
  ): Promise<TagInfo> {
    try {
      const response = await this.octokit.repos.getReleaseByTag({
        owner,
        repo,
        tag: tagInfo.name
      })
      
      tagInfo.date = moment(response.data.created_at)
      core.info(`ℹ️ Retrieved release information for ${tagInfo.name} from GitHub API`)
    } catch {
      // Release not found, try to get tag creation time from git
      core.info(`⚠️ No release found for ${tagInfo.name}, trying git fallback`)
      tagInfo = await this.getTagByCreateTime(repositoryPath, tagInfo)
    }
    
    return tagInfo
  }

  async getTagAnnotation(tag: string): Promise<string | null> {
    try {
      // First try to get from git (works for annotated tags)
      const annotation = await getTagAnnotation(this.repositoryPath, tag)
      if (annotation) {
        return annotation
      }

      // For GitHub, we could also try the API, but annotated tags are usually stored in git
      // The GitHub API doesn't directly expose tag annotations in a simple way
      return null
    } catch (error) {
      core.debug(`Failed to get tag annotation for ${tag}: ${error}`)
      return null
    }
  }

  private async getTagByCreateTime(
    repositoryPath: string,
    tagInfo: TagInfo
  ): Promise<TagInfo> {
    try {
      const exec = await import('@actions/exec')
      let output = ''
      await exec.exec(
        'git',
        ['for-each-ref', '--format=%(creatordate:rfc)', `refs/tags/${tagInfo.name}`],
        {
          cwd: repositoryPath,
          silent: true,
          listeners: {
            stdout: (data: Buffer) => {
              output += data.toString()
            }
          }
        }
      )

      const creationTime = moment(output.trim())
      if (creationTime.isValid()) {
        tagInfo.date = creationTime
        core.info(`ℹ️ Resolved tag creation time from git: ${creationTime.format()}`)
      }
    } catch {
      core.warning(`⚠️ Could not retrieve tag creation time via git`)
    }

    return tagInfo
  }

  async getDiffRemote(
    owner: string,
    repo: string,
    base: string,
    head: string
  ): Promise<DiffInfo> {
    let changedFiles = 0
    let additions = 0
    let deletions = 0
    let changes = 0
    const commits: CommitInfo[] = []

    let compareHead = head
    while (true) {
      const compareResult = await this.octokit.repos.compareCommits({
        owner,
        repo,
        base,
        head: compareHead
      })

      if (compareResult.data.total_commits === 0) {
        break
      }

      const files = compareResult.data.files || []
      changedFiles += files.length
      for (const file of files) {
        additions += file.additions || 0
        deletions += file.deletions || 0
        changes += file.changes || 0
      }

      for (const commit of compareResult.data.commits) {
        const author = commit.commit.author
        commits.push({
          sha: commit.sha,
          message: commit.commit.message || '',
          author: commit.author?.login || author?.name || '',
          authorName: author?.name || '',
          date: moment(author?.date || new Date()),
          htmlURL: commit.html_url
        })
      }

      if (compareResult.data.commits.length === 0) {
        break
      }

      compareHead = `${compareResult.data.commits[0].sha}^`
    }

    return {
      changedFiles,
      additions,
      deletions,
      changes,
      commits
    }
  }

  async getForCommitHash(
    owner: string,
    repo: string,
    commitSha: string,
    maxPullRequests: number
  ): Promise<PullRequestInfo[]> {
    const prs: PullRequestInfo[] = []

    try {
      const response = await this.octokit.repos.listPullRequestsAssociatedWithCommit({
        owner,
        repo,
        commit_sha: commitSha,
        per_page: maxPullRequests
      })

      for (const pr of response.data) {
        prs.push(this.mapPullRequest(pr, pr.merged_at ? 'merged' : 'open'))
      }
    } catch (error) {
      core.warning(`Failed to get PRs for commit ${commitSha}: ${error}`)
    }

    return prs
  }

  async getBetweenDates(
    owner: string,
    repo: string,
    fromDate: moment.Moment,
    toDate: moment.Moment,
    maxPullRequests: number
  ): Promise<PullRequestInfo[]> {
    const prs: PullRequestInfo[] = []
    let page = 1
    const perPage = 100

    while (prs.length < maxPullRequests) {
      const response = await this.octokit.pulls.list({
        owner,
        repo,
        state: 'closed',
        sort: 'updated',
        direction: 'desc',
        per_page: Math.min(perPage, maxPullRequests - prs.length),
        page
      })

      if (response.data.length === 0) {
        break
      }

      for (const pr of response.data) {
        if (!pr.merged_at) continue

        const mergedAt = moment(pr.merged_at)
        if (mergedAt.isAfter(fromDate) && mergedAt.isBefore(toDate)) {
          prs.push(this.mapPullRequest(pr, 'merged'))
        }
      }

      if (response.data.length < perPage) {
        break
      }

      page++
    }

    return prs
  }

  async getOpen(
    owner: string,
    repo: string,
    maxPullRequests: number
  ): Promise<PullRequestInfo[]> {
    const prs: PullRequestInfo[] = []
    let page = 1
    const perPage = 100

    while (prs.length < maxPullRequests) {
      const response = await this.octokit.pulls.list({
        owner,
        repo,
        state: 'open',
        sort: 'updated',
        direction: 'desc',
        per_page: Math.min(perPage, maxPullRequests - prs.length),
        page
      })

      if (response.data.length === 0) {
        break
      }

      for (const pr of response.data) {
        prs.push(this.mapPullRequest(pr, 'open'))
      }

      if (response.data.length < perPage) {
        break
      }

      page++
    }

    return prs
  }

  async getCommits(
    owner: string,
    repo: string,
    base: string,
    head: string
  ): Promise<CommitInfo[]> {
    const commits: CommitInfo[] = []
    let compareHead = head

    while (true) {
      const compareResult = await this.octokit.repos.compareCommits({
        owner,
        repo,
        base,
        head: compareHead
      })

      if (compareResult.data.total_commits === 0) {
        break
      }

      for (const commit of compareResult.data.commits) {
        const author = commit.commit.author
        commits.push({
          sha: commit.sha,
          message: commit.commit.message || '',
          author: commit.author?.login || author?.name || '',
          authorName: author?.name || '',
          date: moment(author?.date || new Date()),
          htmlURL: commit.html_url
        })
      }

      if (compareResult.data.commits.length === 0) {
        break
      }

      compareHead = `${compareResult.data.commits[0].sha}^`
    }

    return commits
  }

  private mapPullRequest(
    pr: PullData | PullRequestsListData[0],
    status: 'open' | 'merged' = 'open'
  ): PullRequestInfo {
    return {
      number: pr.number,
      title: pr.title,
      htmlURL: pr.html_url,
      baseBranch: pr.base.ref,
      branch: pr.head.ref,
      createdAt: moment(pr.created_at),
      mergedAt: pr.merged_at ? moment(pr.merged_at) : undefined,
      mergeCommitSha: pr.merge_commit_sha || '',
      author: pr.user?.login || '',
      authorName: pr.user?.name || pr.user?.login || '',
      repoName: pr.base.repo.full_name,
      labels: pr.labels.map(label => (typeof label === 'string' ? label : label.name)).map(l => l.toLowerCase()),
      milestone: pr.milestone?.title || '',
      body: pr.body || '',
      assignees: pr.assignees?.map(a => a.login) || [],
      requestedReviewers: pr.requested_reviewers?.map(r => r.login) || [],
      approvedReviewers: [],
      status
    }
  }
}

