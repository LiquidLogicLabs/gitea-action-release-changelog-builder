import { BaseProvider } from './base';
import { PullRequestInfo, CommitInfo, TagInfo, DiffInfo } from '../types';
import moment from 'moment';
/**
 * Git provider for local git repositories
 * Uses git commands directly (no API calls)
 * Only supports COMMIT mode (PR mode not available for local repos)
 */
export declare class GitProvider extends BaseProvider {
    get defaultUrl(): string;
    get homeUrl(): string;
    constructor(repositoryPath: string);
    getTags(owner: string, repo: string, maxTagsToFetch: number): Promise<TagInfo[]>;
    fillTagInformation(repositoryPath: string, _owner: string, _repo: string, tagInfo: TagInfo): Promise<TagInfo>;
    getTagAnnotation(tag: string): Promise<string | null>;
    private getTagByCreateTime;
    getDiffRemote(owner: string, repo: string, base: string, head: string): Promise<DiffInfo>;
    getForCommitHash(_owner: string, _repo: string, _commitSha: string, _maxPullRequests: number): Promise<PullRequestInfo[]>;
    getBetweenDates(_owner: string, _repo: string, _fromDate: moment.Moment, _toDate: moment.Moment, _maxPullRequests: number): Promise<PullRequestInfo[]>;
    getOpen(_owner: string, _repo: string, _maxPullRequests: number): Promise<PullRequestInfo[]>;
    getCommits(owner: string, repo: string, base: string, head: string): Promise<CommitInfo[]>;
}
//# sourceMappingURL=git.d.ts.map