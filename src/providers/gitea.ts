import {BaseProvider} from './base'
import {PullRequestInfo, CommitInfo, TagInfo, DiffInfo} from '../types'
import {Api, PullRequest, giteaApi} from 'gitea-js'
import * as core from '@actions/core'
import moment from 'moment'
import {getTagAnnotation} from '../git'
import * as exec from '@actions/exec'

export class GiteaProvider extends BaseProvider {
  private api: Api<unknown>

  get defaultUrl(): string {
    return 'https://gitea.com'
  }

  get homeUrl(): string {
    return 'https://gitea.com'
  }

  constructor(token: string, baseUrl: string | undefined, repositoryPath: string) {
    super(token, baseUrl, repositoryPath)
    
    const apiUrl = baseUrl || this.defaultUrl
    this.api = giteaApi(apiUrl, {
      token
    })
  }

  async getTags(owner: string, repo: string, maxTagsToFetch: number): Promise<TagInfo[]> {
    const tagsInfo: TagInfo[] = []
    let page = 1
    const limit = 50 // Gitea default limit

    while (tagsInfo.length < maxTagsToFetch) {
      const response = await this.api.repos.repoListTags(owner, repo, {
        page,
        limit: Math.min(limit, maxTagsToFetch - tagsInfo.length)
      })

      if (response.error !== null) {
        core.warning(`Failed to fetch tags: ${response.error}`)
        break
      }

      const tags = response.data || []
      if (tags.length === 0) {
        break
      }

      for (const tag of tags) {
        tagsInfo.push({
          name: tag.name || '',
          sha: tag.commit?.sha || '',
          date: undefined
        })
      }

      if (tags.length < limit) {
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
    const response = await this.api.repos.repoGetTag(owner, repo, tagInfo.name)

    if (response.error === null && response.data.commit) {
      tagInfo.date = moment(response.data.commit.created)
      core.info(`ℹ️ Retrieved tag information for ${tagInfo.name} from Gitea API`)
      return tagInfo
    }

    // Fallback to git command
    return await this.getTagByCreateTime(repositoryPath, tagInfo)
  }

  async getTagAnnotation(tag: string): Promise<string | null> {
    // Gitea API doesn't expose tag annotations, use git command
    return await getTagAnnotation(this.repositoryPath, tag)
  }

  private async getTagByCreateTime(
    repositoryPath: string,
    tagInfo: TagInfo
  ): Promise<TagInfo> {
    try {
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
    // Gitea API limitation: can't get diff via API easily, use git command
    // For now, return basic info and let the git helper handle the actual diff
    // This is a simplified version - in practice, you'd use git commands
    
    const commits = await this.getCommits(owner, repo, base, head)
    
    // Use git to get file stats
    let changedFiles = 0
    let additions = 0
    let deletions = 0

    try {
      let diffOutput = ''
      await exec.exec(
        'git',
        ['diff', '--stat', '--numstat', `${base}...${head}`],
        {
          cwd: this.repositoryPath,
          silent: true,
          listeners: {
            stdout: (data: Buffer) => {
              diffOutput += data.toString()
            }
          }
        }
      )

      // Parse numstat output (format: additions deletions filename)
      const lines = diffOutput.trim().split('\n')
      for (const line of lines) {
        const parts = line.trim().split(/\s+/)
        if (parts.length >= 2) {
          const add = parseInt(parts[0] || '0', 10)
          const del = parseInt(parts[1] || '0', 10)
          if (!isNaN(add) && !isNaN(del)) {
            changedFiles++
            additions += add
            deletions += del
          }
        }
      }
    } catch (error) {
      core.warning(`Failed to get diff stats: ${error}`)
    }

    return {
      changedFiles,
      additions,
      deletions,
      changes: additions + deletions,
      commits
    }
  }

  async getForCommitHash(
    owner: string,
    repo: string,
    commitSha: string,
    maxPullRequests: number
  ): Promise<PullRequestInfo[]> {
    // Gitea API: get commits and find associated PRs
    // This is a simplified implementation
    const prs: PullRequestInfo[] = []

    try {
      // List all PRs and filter by commit SHA
      let page = 1
      const limit = 50

      while (prs.length < maxPullRequests) {
        const response = await this.api.repos.repoListPullRequests(owner, repo, {
          state: 'all',
          page,
          limit
        })

        if (response.error !== null) {
          break
        }

        const pullRequests = response.data || []
        if (pullRequests.length === 0) {
          break
        }

        for (const pr of pullRequests) {
          if (pr.merge_commit_sha === commitSha || pr.head?.sha === commitSha) {
            prs.push(this.mapPullRequest(pr, pr.merged_at ? 'merged' : 'open'))
          }
        }

        if (pullRequests.length < limit) {
          break
        }

        page++
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
    const limit = 50

    while (prs.length < maxPullRequests) {
      const response = await this.api.repos.repoListPullRequests(owner, repo, {
        state: 'closed',
        page,
        limit: Math.min(limit, maxPullRequests - prs.length)
      })

      if (response.error !== null) {
        break
      }

      const pullRequests = response.data || []
      if (pullRequests.length === 0) {
        break
      }

      for (const pr of pullRequests) {
        if (!pr.merged_at) continue

        const mergedAt = moment(pr.merged_at)
        if (mergedAt.isAfter(fromDate) && mergedAt.isBefore(toDate)) {
          prs.push(this.mapPullRequest(pr, 'merged'))
        }
      }

      if (pullRequests.length < limit) {
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
    const limit = 50

    while (prs.length < maxPullRequests) {
      const response = await this.api.repos.repoListPullRequests(owner, repo, {
        state: 'open',
        page,
        limit: Math.min(limit, maxPullRequests - prs.length)
      })

      if (response.error !== null) {
        break
      }

      const pullRequests = response.data || []
      if (pullRequests.length === 0) {
        break
      }

      for (const pr of pullRequests) {
        prs.push(this.mapPullRequest(pr, 'open'))
      }

      if (pullRequests.length < limit) {
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

    try {
      // Use git command since Gitea API commit comparison is limited
      let output = ''
      await exec.exec(
        'git',
        ['log', '--pretty=format:%H|%s|%an|%ae|%ad', '--date=rfc', `${base}..${head}`],
        {
          cwd: this.repositoryPath,
          silent: true,
          listeners: {
            stdout: (data: Buffer) => {
              output += data.toString()
            }
          }
        }
      )

      const lines = output.trim().split('\n')
      for (const line of lines) {
        if (!line.trim()) continue

        const parts = line.split('|')
        if (parts.length >= 5) {
          const [sha, message, authorName, authorEmail, dateStr] = parts
          
          commits.push({
            sha: sha || '',
            message: message || '',
            author: authorEmail || authorName || '',
            authorName: authorName || '',
            date: moment(dateStr),
            htmlURL: `${this.homeUrl}/${owner}/${repo}/commit/${sha}`
          })
        }
      }
    } catch (error) {
      core.warning(`Failed to get commits: ${error}`)
    }

    return commits
  }

  private mapPullRequest(pr: PullRequest, status: 'open' | 'merged' = 'open'): PullRequestInfo {
    return {
      number: pr.number || 0,
      title: pr.title || '',
      htmlURL: pr.html_url || '',
      baseBranch: pr.base?.ref || '',
      branch: pr.head?.ref || '',
      createdAt: moment(pr.created_at),
      mergedAt: pr.merged_at ? moment(pr.merged_at) : undefined,
      mergeCommitSha: pr.merge_commit_sha || '',
      author: pr.user?.login || '',
      authorName: pr.user?.full_name || pr.user?.login || '',
      repoName: pr.base?.repo?.full_name || '',
      labels: pr.labels?.map(label => (typeof label === 'string' ? label : label.name || '').toLowerCase()) || [],
      milestone: pr.milestone?.title || '',
      body: pr.body || '',
      assignees: pr.assignees?.map(a => a.login || '') || [],
      requestedReviewers: [],
      approvedReviewers: [],
      status
    }
  }
}

