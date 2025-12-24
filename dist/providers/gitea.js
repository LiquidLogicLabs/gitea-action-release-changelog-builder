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
exports.GiteaProvider = void 0;
const base_1 = require("./base");
const gitea_js_1 = require("gitea-js");
const core = __importStar(require("@actions/core"));
const moment_1 = __importDefault(require("moment"));
const git_1 = require("../git");
const exec = __importStar(require("@actions/exec"));
class GiteaProvider extends base_1.BaseProvider {
    api;
    get defaultUrl() {
        return 'https://gitea.com';
    }
    get homeUrl() {
        return 'https://gitea.com';
    }
    constructor(token, baseUrl, repositoryPath) {
        super(token, baseUrl, repositoryPath);
        const apiUrl = baseUrl || this.defaultUrl;
        this.api = (0, gitea_js_1.giteaApi)(apiUrl, {
            token
        });
    }
    async getTags(owner, repo, maxTagsToFetch) {
        const tagsInfo = [];
        let page = 1;
        const limit = 50; // Gitea default limit
        while (tagsInfo.length < maxTagsToFetch) {
            const response = await this.api.repos.repoListTags(owner, repo, {
                page,
                limit: Math.min(limit, maxTagsToFetch - tagsInfo.length)
            });
            if (response.error !== null) {
                core.warning(`Failed to fetch tags: ${response.error}`);
                break;
            }
            const tags = response.data || [];
            if (tags.length === 0) {
                break;
            }
            for (const tag of tags) {
                tagsInfo.push({
                    name: tag.name || '',
                    sha: tag.commit?.sha || '',
                    date: undefined
                });
            }
            if (tags.length < limit) {
                break;
            }
            page++;
        }
        return tagsInfo;
    }
    async fillTagInformation(repositoryPath, owner, repo, tagInfo) {
        const response = await this.api.repos.repoGetTag(owner, repo, tagInfo.name);
        if (response.error === null && response.data.commit) {
            tagInfo.date = (0, moment_1.default)(response.data.commit.created);
            core.info(`ℹ️ Retrieved tag information for ${tagInfo.name} from Gitea API`);
            return tagInfo;
        }
        // Fallback to git command
        return await this.getTagByCreateTime(repositoryPath, tagInfo);
    }
    async getTagAnnotation(tag) {
        // Gitea API doesn't expose tag annotations, use git command
        return await (0, git_1.getTagAnnotation)(this.repositoryPath, tag);
    }
    async getTagByCreateTime(repositoryPath, tagInfo) {
        try {
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
        // Gitea API limitation: can't get diff via API easily, use git command
        // For now, return basic info and let the git helper handle the actual diff
        // This is a simplified version - in practice, you'd use git commands
        const commits = await this.getCommits(owner, repo, base, head);
        // Use git to get file stats
        let changedFiles = 0;
        let additions = 0;
        let deletions = 0;
        try {
            let diffOutput = '';
            await exec.exec('git', ['diff', '--stat', '--numstat', `${base}...${head}`], {
                cwd: this.repositoryPath,
                silent: true,
                listeners: {
                    stdout: (data) => {
                        diffOutput += data.toString();
                    }
                }
            });
            // Parse numstat output (format: additions deletions filename)
            const lines = diffOutput.trim().split('\n');
            for (const line of lines) {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 2) {
                    const add = parseInt(parts[0] || '0', 10);
                    const del = parseInt(parts[1] || '0', 10);
                    if (!isNaN(add) && !isNaN(del)) {
                        changedFiles++;
                        additions += add;
                        deletions += del;
                    }
                }
            }
        }
        catch (error) {
            core.warning(`Failed to get diff stats: ${error}`);
        }
        return {
            changedFiles,
            additions,
            deletions,
            changes: additions + deletions,
            commits
        };
    }
    async getForCommitHash(owner, repo, commitSha, maxPullRequests) {
        // Gitea API: get commits and find associated PRs
        // This is a simplified implementation
        const prs = [];
        try {
            // List all PRs and filter by commit SHA
            let page = 1;
            const limit = 50;
            while (prs.length < maxPullRequests) {
                const response = await this.api.repos.repoListPullRequests(owner, repo, {
                    state: 'all',
                    page,
                    limit
                });
                if (response.error !== null) {
                    break;
                }
                const pullRequests = response.data || [];
                if (pullRequests.length === 0) {
                    break;
                }
                for (const pr of pullRequests) {
                    if (pr.merge_commit_sha === commitSha || pr.head?.sha === commitSha) {
                        prs.push(this.mapPullRequest(pr, pr.merged_at ? 'merged' : 'open'));
                    }
                }
                if (pullRequests.length < limit) {
                    break;
                }
                page++;
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
        const limit = 50;
        while (prs.length < maxPullRequests) {
            const response = await this.api.repos.repoListPullRequests(owner, repo, {
                state: 'closed',
                page,
                limit: Math.min(limit, maxPullRequests - prs.length)
            });
            if (response.error !== null) {
                break;
            }
            const pullRequests = response.data || [];
            if (pullRequests.length === 0) {
                break;
            }
            for (const pr of pullRequests) {
                if (!pr.merged_at)
                    continue;
                const mergedAt = (0, moment_1.default)(pr.merged_at);
                if (mergedAt.isAfter(fromDate) && mergedAt.isBefore(toDate)) {
                    prs.push(this.mapPullRequest(pr, 'merged'));
                }
            }
            if (pullRequests.length < limit) {
                break;
            }
            page++;
        }
        return prs;
    }
    async getOpen(owner, repo, maxPullRequests) {
        const prs = [];
        let page = 1;
        const limit = 50;
        while (prs.length < maxPullRequests) {
            const response = await this.api.repos.repoListPullRequests(owner, repo, {
                state: 'open',
                page,
                limit: Math.min(limit, maxPullRequests - prs.length)
            });
            if (response.error !== null) {
                break;
            }
            const pullRequests = response.data || [];
            if (pullRequests.length === 0) {
                break;
            }
            for (const pr of pullRequests) {
                prs.push(this.mapPullRequest(pr, 'open'));
            }
            if (pullRequests.length < limit) {
                break;
            }
            page++;
        }
        return prs;
    }
    async getCommits(owner, repo, base, head) {
        const commits = [];
        try {
            // Use git command since Gitea API commit comparison is limited
            let output = '';
            await exec.exec('git', ['log', '--pretty=format:%H|%s|%an|%ae|%ad', '--date=rfc', `${base}..${head}`], {
                cwd: this.repositoryPath,
                silent: true,
                listeners: {
                    stdout: (data) => {
                        output += data.toString();
                    }
                }
            });
            const lines = output.trim().split('\n');
            for (const line of lines) {
                if (!line.trim())
                    continue;
                const parts = line.split('|');
                if (parts.length >= 5) {
                    const [sha, message, authorName, authorEmail, dateStr] = parts;
                    commits.push({
                        sha: sha || '',
                        message: message || '',
                        author: authorEmail || authorName || '',
                        authorName: authorName || '',
                        date: (0, moment_1.default)(dateStr),
                        htmlURL: `${this.homeUrl}/${owner}/${repo}/commit/${sha}`
                    });
                }
            }
        }
        catch (error) {
            core.warning(`Failed to get commits: ${error}`);
        }
        return commits;
    }
    mapPullRequest(pr, status = 'open') {
        return {
            number: pr.number || 0,
            title: pr.title || '',
            htmlURL: pr.html_url || '',
            baseBranch: pr.base?.ref || '',
            branch: pr.head?.ref || '',
            createdAt: (0, moment_1.default)(pr.created_at),
            mergedAt: pr.merged_at ? (0, moment_1.default)(pr.merged_at) : undefined,
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
        };
    }
}
exports.GiteaProvider = GiteaProvider;
//# sourceMappingURL=gitea.js.map