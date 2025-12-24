import { BaseProvider } from './base';
import { PullRequestInfo, CommitInfo, TagInfo, DiffInfo } from '../types';
import moment from 'moment';
export declare class GithubProvider extends BaseProvider {
    private octokit;
    get defaultUrl(): string;
    get homeUrl(): string;
    constructor(token: string, baseUrl: string | undefined, repositoryPath: string);
    getTags(owner: string, repo: string, maxTagsToFetch: number): Promise<TagInfo[]>;
    fillTagInformation(repositoryPath: string, owner: string, repo: string, tagInfo: TagInfo): Promise<TagInfo>;
    getTagAnnotation(tag: string): Promise<string | null>;
    private getTagByCreateTime;
    getDiffRemote(owner: string, repo: string, base: string, head: string): Promise<DiffInfo>;
    getForCommitHash(owner: string, repo: string, commitSha: string, maxPullRequests: number): Promise<PullRequestInfo[]>;
    getBetweenDates(owner: string, repo: string, fromDate: moment.Moment, toDate: moment.Moment, maxPullRequests: number): Promise<PullRequestInfo[]>;
    getOpen(owner: string, repo: string, maxPullRequests: number): Promise<PullRequestInfo[]>;
    getCommits(owner: string, repo: string, base: string, head: string): Promise<CommitInfo[]>;
    private mapPullRequest;
}
//# sourceMappingURL=github.d.ts.map