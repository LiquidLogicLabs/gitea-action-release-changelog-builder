import { BaseProvider } from './providers/base';
import { PullRequestInfo, CommitInfo, TagInfo, ProviderPlatform } from './types';
import { Logger } from './logger';
/**
 * Convert commits to PR-like structure
 * @param commits Array of commit info
 * @param owner Repository owner
 * @param repo Repository name
 * @returns Array of PR-like info
 */
export declare function convertCommitsToPRs(commits: CommitInfo[], owner: string, repo: string): PullRequestInfo[];
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
export declare function collectPullRequests(provider: BaseProvider, owner: string, repo: string, fromTag: TagInfo, toTag: TagInfo, mode: string, includeOpen: boolean, platform: ProviderPlatform, logger: Logger): Promise<PullRequestInfo[]>;
//# sourceMappingURL=collector.d.ts.map