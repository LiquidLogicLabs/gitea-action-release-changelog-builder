import moment from 'moment';
/**
 * Pull Request information structure
 */
export interface PullRequestInfo {
    number: number;
    title: string;
    htmlURL: string;
    baseBranch: string;
    branch?: string;
    createdAt: moment.Moment;
    mergedAt: moment.Moment | undefined;
    mergeCommitSha: string;
    author: string;
    authorName: string;
    repoName: string;
    labels: string[];
    milestone: string;
    body: string;
    assignees: string[];
    requestedReviewers: string[];
    approvedReviewers: string[];
    status: 'open' | 'merged';
}
/**
 * Commit information structure
 */
export interface CommitInfo {
    sha: string;
    message: string;
    author: string;
    authorName: string;
    date: moment.Moment;
    htmlURL: string;
}
/**
 * Tag information structure
 */
export interface TagInfo {
    name: string;
    date: moment.Moment | undefined;
    sha: string;
    annotation?: string;
}
/**
 * Diff information structure
 */
export interface DiffInfo {
    changedFiles: number;
    additions: number;
    deletions: number;
    changes: number;
    commits: CommitInfo[];
}
/**
 * Category configuration for organizing PRs
 */
export interface Category {
    key?: string;
    title: string;
    labels?: string[];
    exclude_labels?: string[];
    mode?: 'HYBRID' | 'COMMIT' | 'PR';
    entries?: string[];
}
/**
 * Regex configuration for pattern matching
 */
export interface Regex {
    pattern: string;
    flags?: string;
    target?: string;
    method?: 'replace' | 'replaceAll' | 'match';
    on_empty?: string;
}
/**
 * Configuration for the changelog builder
 */
export interface Configuration {
    template?: string;
    pr_template?: string;
    commit_template?: string;
    empty_template?: string;
    categories?: Category[];
    ignore_labels?: string[];
    trim_values?: boolean;
    defaultCategory?: string;
}
/**
 * Action input types
 */
export interface ActionInputs {
    platform?: 'github' | 'gitea';
    token?: string;
    repo?: string;
    fromTag?: string;
    toTag?: string;
    mode?: 'PR' | 'COMMIT' | 'HYBRID';
    configuration?: string;
    configurationJson?: string;
    ignorePreReleases?: boolean;
    fetchTagAnnotations?: boolean;
    prefixMessage?: string;
    postfixMessage?: string;
    includeOpen?: boolean;
    failOnError?: boolean;
    maxTagsToFetch?: number;
}
/**
 * Provider platform type
 */
export type ProviderPlatform = 'github' | 'gitea' | 'local' | 'git';
//# sourceMappingURL=types.d.ts.map