"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GithubProvider = void 0;
const base_1 = require("./base");
const rest_1 = require("@octokit/rest");
const core = __importStar(require("@actions/core"));
const moment_1 = __importDefault(require("moment"));
const git_1 = require("../git");
class GithubProvider extends base_1.BaseProvider {
    octokit;
    get defaultUrl() {
        return 'https://api.github.com';
    }
    get homeUrl() {
        return 'https://github.com';
    }
    constructor(token, baseUrl, repositoryPath) {
        super(token, baseUrl, repositoryPath);
        const apiUrl = baseUrl || this.defaultUrl;
        this.octokit = new rest_1.Octokit({
            baseUrl: apiUrl,
            auth: token
        });
    }
    async getTags(owner, repo, maxTagsToFetch) {
        const tagsInfo = [];
        let page = 1;
        const perPage = 100;
        while (tagsInfo.length < maxTagsToFetch) {
            const response = await this.octokit.repos.listTags({
                owner,
                repo,
                per_page: Math.min(perPage, maxTagsToFetch - tagsInfo.length),
                page
            });
            if (response.data.length === 0) {
                break;
            }
            for (const tag of response.data) {
                tagsInfo.push({
                    name: tag.name,
                    sha: tag.commit.sha,
                    date: undefined
                });
            }
            if (response.data.length < perPage) {
                break;
            }
            page++;
        }
        return tagsInfo;
    }
    async fillTagInformation(repositoryPath, owner, repo, tagInfo) {
        try {
            const response = await this.octokit.repos.getReleaseByTag({
                owner,
                repo,
                tag: tagInfo.name
            });
            tagInfo.date = (0, moment_1.default)(response.data.created_at);
            core.info(`ℹ️ Retrieved release information for ${tagInfo.name} from GitHub API`);
        }
        catch {
            // Release not found, try to get tag creation time from git
            core.info(`⚠️ No release found for ${tagInfo.name}, trying git fallback`);
            tagInfo = await this.getTagByCreateTime(repositoryPath, tagInfo);
        }
        return tagInfo;
    }
    async getTagAnnotation(tag) {
        try {
            // First try to get from git (works for annotated tags)
            const annotation = await (0, git_1.getTagAnnotation)(this.repositoryPath, tag);
            if (annotation) {
                return annotation;
            }
            // For GitHub, we could also try the API, but annotated tags are usually stored in git
            // The GitHub API doesn't directly expose tag annotations in a simple way
            return null;
        }
        catch (error) {
            core.debug(`Failed to get tag annotation for ${tag}: ${error}`);
            return null;
        }
    }
    async getTagByCreateTime(repositoryPath, tagInfo) {
        try {
            const exec = await Promise.resolve().then(() => __importStar(require('@actions/exec')));
            let output = '';
            await exec.exec('git', ['for-each-ref', '--format=%(creatordate:rfc)', `refs/tags/${tagInfo.name}`], {
                cwd: repositoryPath,
                silent: true,
                listeners: {
                    stdout: (data) => {
                        output += data.toString();
                    }
                }
            });
            const creationTime = (0, moment_1.default)(output.trim());
            if (creationTime.isValid()) {
                tagInfo.date = creationTime;
                core.info(`ℹ️ Resolved tag creation time from git: ${creationTime.format()}`);
            }
        }
        catch {
            core.warning(`⚠️ Could not retrieve tag creation time via git`);
        }
        return tagInfo;
    }
    async getDiffRemote(owner, repo, base, head) {
        let changedFiles = 0;
        let additions = 0;
        let deletions = 0;
        let changes = 0;
        const commits = [];
        let compareHead = head;
        while (true) {
            const compareResult = await this.octokit.repos.compareCommits({
                owner,
                repo,
                base,
                head: compareHead
            });
            if (compareResult.data.total_commits === 0) {
                break;
            }
            const files = compareResult.data.files || [];
            changedFiles += files.length;
            for (const file of files) {
                additions += file.additions || 0;
                deletions += file.deletions || 0;
                changes += file.changes || 0;
            }
            for (const commit of compareResult.data.commits) {
                const author = commit.commit.author;
                commits.push({
                    sha: commit.sha,
                    message: commit.commit.message || '',
                    author: commit.author?.login || author?.name || '',
                    authorName: author?.name || '',
                    date: (0, moment_1.default)(author?.date || new Date()),
                    htmlURL: commit.html_url
                });
            }
            if (compareResult.data.commits.length === 0) {
                break;
            }
            compareHead = `${compareResult.data.commits[0].sha}^`;
        }
        return {
            changedFiles,
            additions,
            deletions,
            changes,
            commits
        };
    }
    async getForCommitHash(owner, repo, commitSha, maxPullRequests) {
        const prs = [];
        try {
            const response = await this.octokit.repos.listPullRequestsAssociatedWithCommit({
                owner,
                repo,
                commit_sha: commitSha,
                per_page: maxPullRequests
            });
            for (const pr of response.data) {
                prs.push(this.mapPullRequest(pr, pr.merged_at ? 'merged' : 'open'));
            }
        }
        catch (error) {
            core.warning(`Failed to get PRs for commit ${commitSha}: ${error}`);
        }
        return prs;
    }
    async getBetweenDates(owner, repo, fromDate, toDate, maxPullRequests) {
        const prs = [];
        let page = 1;
        const perPage = 100;
        while (prs.length < maxPullRequests) {
            const response = await this.octokit.pulls.list({
                owner,
                repo,
                state: 'closed',
                sort: 'updated',
                direction: 'desc',
                per_page: Math.min(perPage, maxPullRequests - prs.length),
                page
            });
            if (response.data.length === 0) {
                break;
            }
            for (const pr of response.data) {
                if (!pr.merged_at)
                    continue;
                const mergedAt = (0, moment_1.default)(pr.merged_at);
                if (mergedAt.isAfter(fromDate) && mergedAt.isBefore(toDate)) {
                    prs.push(this.mapPullRequest(pr, 'merged'));
                }
            }
            if (response.data.length < perPage) {
                break;
            }
            page++;
        }
        return prs;
    }
    async getOpen(owner, repo, maxPullRequests) {
        const prs = [];
        let page = 1;
        const perPage = 100;
        while (prs.length < maxPullRequests) {
            const response = await this.octokit.pulls.list({
                owner,
                repo,
                state: 'open',
                sort: 'updated',
                direction: 'desc',
                per_page: Math.min(perPage, maxPullRequests - prs.length),
                page
            });
            if (response.data.length === 0) {
                break;
            }
            for (const pr of response.data) {
                prs.push(this.mapPullRequest(pr, 'open'));
            }
            if (response.data.length < perPage) {
                break;
            }
            page++;
        }
        return prs;
    }
    async getCommits(owner, repo, base, head) {
        const commits = [];
        let compareHead = head;
        while (true) {
            const compareResult = await this.octokit.repos.compareCommits({
                owner,
                repo,
                base,
                head: compareHead
            });
            if (compareResult.data.total_commits === 0) {
                break;
            }
            for (const commit of compareResult.data.commits) {
                const author = commit.commit.author;
                commits.push({
                    sha: commit.sha,
                    message: commit.commit.message || '',
                    author: commit.author?.login || author?.name || '',
                    authorName: author?.name || '',
                    date: (0, moment_1.default)(author?.date || new Date()),
                    htmlURL: commit.html_url
                });
            }
            if (compareResult.data.commits.length === 0) {
                break;
            }
            compareHead = `${compareResult.data.commits[0].sha}^`;
        }
        return commits;
    }
    mapPullRequest(pr, status = 'open') {
        return {
            number: pr.number,
            title: pr.title,
            htmlURL: pr.html_url,
            baseBranch: pr.base.ref,
            branch: pr.head.ref,
            createdAt: (0, moment_1.default)(pr.created_at),
            mergedAt: pr.merged_at ? (0, moment_1.default)(pr.merged_at) : undefined,
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
        };
    }
}
exports.GithubProvider = GithubProvider;
//# sourceMappingURL=github.js.map