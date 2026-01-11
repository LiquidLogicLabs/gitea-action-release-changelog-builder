"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertCommitsToPRs = convertCommitsToPRs;
exports.collectPullRequests = collectPullRequests;
const moment_1 = __importDefault(require("moment"));
/**
 * Convert commits to PR-like structure
 * @param commits Array of commit info
 * @param owner Repository owner
 * @param repo Repository name
 * @returns Array of PR-like info
 */
function convertCommitsToPRs(commits, owner, repo) {
    const pullRequests = [];
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
        });
    }
    return pullRequests;
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
async function collectPullRequests(provider, owner, repo, fromTag, toTag, mode, includeOpen, platform, logger) {
    const pullRequests = [];
    // Validate mode for local/git platform (COMMIT only)
    if ((platform === 'local' || platform === 'git') && (mode === 'PR' || mode === 'HYBRID')) {
        throw new Error(`PR and HYBRID modes are not supported for ${platform} platform. Use COMMIT mode instead.`);
    }
    if (mode === 'PR' || mode === 'HYBRID') {
        // Get PRs between dates
        const fromDate = fromTag.date || (0, moment_1.default)().subtract(365, 'days');
        const toDate = toTag.date || (0, moment_1.default)();
        const mergedPRs = await provider.getBetweenDates(owner, repo, fromDate, toDate, 200);
        pullRequests.push(...mergedPRs);
        if (includeOpen) {
            const openPRs = await provider.getOpen(owner, repo, 200);
            pullRequests.push(...openPRs);
        }
    }
    if (mode === 'COMMIT' || mode === 'HYBRID') {
        // Get commits and convert to PR-like structure
        const commits = await provider.getCommits(owner, repo, fromTag.name, toTag.name);
        const commitPRs = convertCommitsToPRs(commits, owner, repo);
        pullRequests.push(...commitPRs);
    }
    return pullRequests;
}
//# sourceMappingURL=collector.js.map