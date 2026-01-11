import {BaseProvider} from './base'
import {PullRequestInfo, CommitInfo, TagInfo, DiffInfo} from '../types'
import * as core from '@actions/core'
import * as exec from '@actions/exec'
import moment from 'moment'
import {getTagAnnotation, getTagCommit} from '../git'

/**
 * Git provider for local git repositories
 * Uses git commands directly (no API calls)
 * Only supports COMMIT mode (PR mode not available for local repos)
 */
export class GitProvider extends BaseProvider {
  get defaultUrl(): string {
    return ''
  }

  get homeUrl(): string {
    return ''
  }

  constructor(repositoryPath: string) {
    // Git provider doesn't need token/baseUrl - uses git commands directly
    super('', undefined, repositoryPath)
  }

  async getTags(owner: string, repo: string, maxTagsToFetch: number): Promise<TagInfo[]> {
    const tagsInfo: TagInfo[] = []
    
    try {
      let output = ''
      await exec.exec(
        'git',
        ['tag', '--sort=-creatordate', `--list`],
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

      const tagNames = output
        .trim()
        .split('\n')
        .filter(name => name.trim().length > 0)
        .slice(0, maxTagsToFetch)

      for (const tagName of tagNames) {
        const commitSha = await getTagCommit(this.repositoryPath, tagName)
        if (commitSha) {
          tagsInfo.push({
            name: tagName.trim(),
            sha: commitSha,
            date: undefined
          })
        }
      }
    } catch (error) {
      core.warning(`Failed to get tags: ${error}`)
    }

    return tagsInfo
  }

  async fillTagInformation(
    repositoryPath: string,
    _owner: string,
    _repo: string,
    tagInfo: TagInfo
  ): Promise<TagInfo> {
    return await this.getTagByCreateTime(repositoryPath, tagInfo)
  }

  async getTagAnnotation(tag: string): Promise<string | null> {
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
        ['for-each-ref', '--format=%(creatordate:iso8601)', `refs/tags/${tagInfo.name}`],
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
    const commits = await this.getCommits(owner, repo, base, head)
    
    let changedFiles = 0
    let additions = 0
    let deletions = 0
    let changes = 0

    try {
      let output = ''
      await exec.exec(
        'git',
        ['diff', '--shortstat', `${base}..${head}`],
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

      // Parse shortstat output: "X files changed, Y insertions(+), Z deletions(-)"
      const statMatch = output.match(/(\d+)\s+files?\s+changed/)
      if (statMatch) {
        changedFiles = parseInt(statMatch[1], 10)
      }

      const insertionsMatch = output.match(/(\d+)\s+insertions?/)
      if (insertionsMatch) {
        additions = parseInt(insertionsMatch[1], 10)
      }

      const deletionsMatch = output.match(/(\d+)\s+deletions?/)
      if (deletionsMatch) {
        deletions = parseInt(deletionsMatch[1], 10)
      }

      changes = additions + deletions
    } catch (error) {
      core.warning(`Failed to get diff stats: ${error}`)
    }

    return {
      changedFiles,
      additions,
      deletions,
      changes,
      commits
    }
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  async getForCommitHash(
    _owner: string,
    _repo: string,
    _commitSha: string,
    _maxPullRequests: number
  ): Promise<PullRequestInfo[]> {
    throw new Error(
      'PR mode is not supported for local git repositories. Use COMMIT mode instead.'
    )
  }

  async getBetweenDates(
    _owner: string,
    _repo: string,
    _fromDate: moment.Moment,
    _toDate: moment.Moment,
    _maxPullRequests: number
  ): Promise<PullRequestInfo[]> {
    throw new Error(
      'PR mode is not supported for local git repositories. Use COMMIT mode instead.'
    )
  }

  async getOpen(_owner: string, _repo: string, _maxPullRequests: number): Promise<PullRequestInfo[]> {
    throw new Error(
      'PR mode is not supported for local git repositories. Use COMMIT mode instead.'
    )
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */

  async getCommits(
    owner: string,
    repo: string,
    base: string,
    head: string
  ): Promise<CommitInfo[]> {
    const commits: CommitInfo[] = []

    try {
      let output = ''
      await exec.exec(
        'git',
        ['log', '--format=%H|%s|%an|%ae|%ai', `${base}..${head}`],
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

      const lines = output.trim().split('\n').filter(line => line.trim().length > 0)
      
      for (const line of lines) {
        const parts = line.split('|')
        if (parts.length >= 5) {
          const sha = parts[0]
          const message = parts[1] || ''
          const authorName = parts[2] || ''
          const authorEmail = parts[3] || ''
          const dateStr = parts[4] || ''

          commits.push({
            sha,
            message,
            author: authorEmail, // Use email as author identifier
            authorName,
            date: moment(dateStr),
            htmlURL: '' // Local repos don't have web URLs
          })
        }
      }
    } catch (error) {
      core.warning(`Failed to get commits: ${error}`)
    }

    return commits
  }
}
