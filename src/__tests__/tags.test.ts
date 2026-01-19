import moment from 'moment'
import {resolveTags} from '../tags'
import {Logger} from '../logger'
import {CommitInfo, DiffInfo, PullRequestInfo, TagInfo} from '../types'
import {BaseProvider} from '../providers/base'

class MockProvider extends BaseProvider {
  private readonly tags: TagInfo[]

  constructor(tags: TagInfo[]) {
    super('token', 'https://example.invalid', process.cwd())
    this.tags = tags
  }

  get defaultUrl(): string {
    return 'https://example.invalid'
  }

  get homeUrl(): string {
    return 'https://example.invalid'
  }

  async getTags(_owner: string, _repo: string, _maxTagsToFetch: number): Promise<TagInfo[]> {
    void _owner
    void _repo
    void _maxTagsToFetch
    return this.tags
  }

  async fillTagInformation(
    _repositoryPath: string,
    _owner: string,
    _repo: string,
    tagInfo: TagInfo
  ): Promise<TagInfo> {
    // Leave tags as-is for tests
    return tagInfo
  }

  async getTagAnnotation(_tag: string): Promise<string | null> {
    void _tag
    return null
  }

  async getDiffRemote(
    _owner: string,
    _repo: string,
    _base: string,
    _head: string
  ): Promise<DiffInfo> {
    void _owner
    void _repo
    void _base
    void _head
    return {
      changedFiles: 0,
      additions: 0,
      deletions: 0,
      changes: 0,
      commits: []
    }
  }

  async getForCommitHash(
    _owner: string,
    _repo: string,
    _commitSha: string,
    _maxPullRequests: number
  ): Promise<PullRequestInfo[]> {
    void _owner
    void _repo
    void _commitSha
    void _maxPullRequests
    return []
  }

  async getBetweenDates(
    _owner: string,
    _repo: string,
    _fromDate: moment.Moment,
    _toDate: moment.Moment,
    _maxPullRequests: number
  ): Promise<PullRequestInfo[]> {
    void _owner
    void _repo
    void _fromDate
    void _toDate
    void _maxPullRequests
    return []
  }

  async getOpen(_owner: string, _repo: string, _maxPullRequests: number): Promise<PullRequestInfo[]> {
    void _owner
    void _repo
    void _maxPullRequests
    return []
  }

  async getCommits(
    _owner: string,
    _repo: string,
    _base: string,
    _head: string
  ): Promise<CommitInfo[]> {
    void _owner
    void _repo
    void _base
    void _head
    return []
  }
}

describe('resolveTags', () => {
  const logger = new Logger(false)
  const owner = 'o'
  const repo = 'r'
  const repoPath = process.cwd()

  it('should use latest tag when toTag is not provided', async () => {
    const tags: TagInfo[] = [
      {name: 'v2.0.0', sha: '2', date: moment('2026-01-02')},
      {name: 'v1.0.0', sha: '1', date: moment('2026-01-01')}
    ]

    const provider = new MockProvider(tags)
    const {toTag} = await resolveTags(provider, owner, repo, repoPath, undefined, undefined, 'gitea', logger, 1000)
    expect(toTag.name).toBe('v2.0.0')
  })

  it('should fall back to latest tag when provided toTag is blank/whitespace', async () => {
    const tags: TagInfo[] = [
      {name: 'v2.0.0', sha: '2', date: moment('2026-01-02')},
      {name: 'v1.0.0', sha: '1', date: moment('2026-01-01')}
    ]

    const provider = new MockProvider(tags)
    const {toTag} = await resolveTags(provider, owner, repo, repoPath, undefined, '   ', 'gitea', logger, 1000)
    expect(toTag.name).toBe('v2.0.0')
  })

  it('should fall back to latest tag when provided toTag is not found', async () => {
    const tags: TagInfo[] = [
      {name: 'v2.0.0', sha: '2', date: moment('2026-01-02')},
      {name: 'v1.0.0', sha: '1', date: moment('2026-01-01')}
    ]

    const provider = new MockProvider(tags)
    const {toTag} = await resolveTags(provider, owner, repo, repoPath, undefined, 'v9.9.9', 'gitea', logger, 1000)
    expect(toTag.name).toBe('v2.0.0')
  })
})

