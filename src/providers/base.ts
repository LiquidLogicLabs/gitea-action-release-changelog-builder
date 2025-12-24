import {PullRequestInfo} from '../types'
import {CommitInfo} from '../types'
import {TagInfo} from '../types'
import {DiffInfo} from '../types'
import moment from 'moment'

/**
 * Base abstract class for Git provider implementations
 * Provides a common interface for GitHub, Gitea, and future providers
 */
export abstract class BaseProvider {
  protected constructor(
    protected token: string,
    protected baseUrl: string | undefined,
    protected repositoryPath: string
  ) {}

  /**
   * Get the default API URL for this provider
   */
  abstract get defaultUrl(): string

  /**
   * Get the home URL for this provider (used for generating links)
   */
  abstract get homeUrl(): string

  /**
   * List tags for a repository
   */
  abstract getTags(owner: string, repo: string, maxTagsToFetch: number): Promise<TagInfo[]>

  /**
   * Fill additional tag information (e.g., creation date, annotation)
   */
  abstract fillTagInformation(
    repositoryPath: string,
    owner: string,
    repo: string,
    tagInfo: TagInfo
  ): Promise<TagInfo>

  /**
   * Get tag annotation message
   * @param tag Tag name
   * @returns Tag annotation message or null if not available
   */
  abstract getTagAnnotation(tag: string): Promise<string | null>

  /**
   * Get diff information between two refs
   */
  abstract getDiffRemote(
    owner: string,
    repo: string,
    base: string,
    head: string
  ): Promise<DiffInfo>

  /**
   * Get pull requests associated with a commit hash
   */
  abstract getForCommitHash(
    owner: string,
    repo: string,
    commitSha: string,
    maxPullRequests: number
  ): Promise<PullRequestInfo[]>

  /**
   * Get pull requests between two dates
   */
  abstract getBetweenDates(
    owner: string,
    repo: string,
    fromDate: moment.Moment,
    toDate: moment.Moment,
    maxPullRequests: number
  ): Promise<PullRequestInfo[]>

  /**
   * Get open pull requests
   */
  abstract getOpen(owner: string, repo: string, maxPullRequests: number): Promise<PullRequestInfo[]>

  /**
   * Get commits between two refs
   */
  abstract getCommits(
    owner: string,
    repo: string,
    base: string,
    head: string
  ): Promise<CommitInfo[]>
}

