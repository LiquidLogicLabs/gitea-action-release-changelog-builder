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
exports.GitProvider = void 0;
const base_1 = require("./base");
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const moment_1 = __importDefault(require("moment"));
const git_1 = require("../git");
/**
 * Git provider for local git repositories
 * Uses git commands directly (no API calls)
 * Only supports COMMIT mode (PR mode not available for local repos)
 */
class GitProvider extends base_1.BaseProvider {
    get defaultUrl() {
        return '';
    }
    get homeUrl() {
        return '';
    }
    constructor(repositoryPath) {
        // Git provider doesn't need token/baseUrl - uses git commands directly
        super('', undefined, repositoryPath);
    }
    async getTags(owner, repo, maxTagsToFetch) {
        const tagsInfo = [];
        try {
            let output = '';
            await exec.exec('git', ['tag', '--sort=-creatordate', `--list`], {
                cwd: this.repositoryPath,
                silent: true,
                listeners: {
                    stdout: (data) => {
                        output += data.toString();
                    }
                }
            });
            const tagNames = output
                .trim()
                .split('\n')
                .filter(name => name.trim().length > 0)
                .slice(0, maxTagsToFetch);
            for (const tagName of tagNames) {
                const commitSha = await (0, git_1.getTagCommit)(this.repositoryPath, tagName);
                if (commitSha) {
                    tagsInfo.push({
                        name: tagName.trim(),
                        sha: commitSha,
                        date: undefined
                    });
                }
            }
        }
        catch (error) {
            core.warning(`Failed to get tags: ${error}`);
        }
        return tagsInfo;
    }
    async fillTagInformation(repositoryPath, _owner, _repo, tagInfo) {
        return await this.getTagByCreateTime(repositoryPath, tagInfo);
    }
    async getTagAnnotation(tag) {
        return await (0, git_1.getTagAnnotation)(this.repositoryPath, tag);
    }
    async getTagByCreateTime(repositoryPath, tagInfo) {
        try {
            let output = '';
            await exec.exec('git', ['for-each-ref', '--format=%(creatordate:iso8601)', `refs/tags/${tagInfo.name}`], {
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
        const commits = await this.getCommits(owner, repo, base, head);
        let changedFiles = 0;
        let additions = 0;
        let deletions = 0;
        let changes = 0;
        try {
            let output = '';
            await exec.exec('git', ['diff', '--shortstat', `${base}..${head}`], {
                cwd: this.repositoryPath,
                silent: true,
                listeners: {
                    stdout: (data) => {
                        output += data.toString();
                    }
                }
            });
            // Parse shortstat output: "X files changed, Y insertions(+), Z deletions(-)"
            const statMatch = output.match(/(\d+)\s+files?\s+changed/);
            if (statMatch) {
                changedFiles = parseInt(statMatch[1], 10);
            }
            const insertionsMatch = output.match(/(\d+)\s+insertions?/);
            if (insertionsMatch) {
                additions = parseInt(insertionsMatch[1], 10);
            }
            const deletionsMatch = output.match(/(\d+)\s+deletions?/);
            if (deletionsMatch) {
                deletions = parseInt(deletionsMatch[1], 10);
            }
            changes = additions + deletions;
        }
        catch (error) {
            core.warning(`Failed to get diff stats: ${error}`);
        }
        return {
            changedFiles,
            additions,
            deletions,
            changes,
            commits
        };
    }
    /* eslint-disable @typescript-eslint/no-unused-vars */
    async getForCommitHash(_owner, _repo, _commitSha, _maxPullRequests) {
        throw new Error('PR mode is not supported for local git repositories. Use COMMIT mode instead.');
    }
    async getBetweenDates(_owner, _repo, _fromDate, _toDate, _maxPullRequests) {
        throw new Error('PR mode is not supported for local git repositories. Use COMMIT mode instead.');
    }
    async getOpen(_owner, _repo, _maxPullRequests) {
        throw new Error('PR mode is not supported for local git repositories. Use COMMIT mode instead.');
    }
    /* eslint-enable @typescript-eslint/no-unused-vars */
    async getCommits(owner, repo, base, head) {
        const commits = [];
        try {
            let output = '';
            await exec.exec('git', ['log', '--format=%H|%s|%an|%ae|%ai', `${base}..${head}`], {
                cwd: this.repositoryPath,
                silent: true,
                listeners: {
                    stdout: (data) => {
                        output += data.toString();
                    }
                }
            });
            const lines = output.trim().split('\n').filter(line => line.trim().length > 0);
            for (const line of lines) {
                const parts = line.split('|');
                if (parts.length >= 5) {
                    const sha = parts[0];
                    const message = parts[1] || '';
                    const authorName = parts[2] || '';
                    const authorEmail = parts[3] || '';
                    const dateStr = parts[4] || '';
                    commits.push({
                        sha,
                        message,
                        author: authorEmail, // Use email as author identifier
                        authorName,
                        date: (0, moment_1.default)(dateStr),
                        htmlURL: '' // Local repos don't have web URLs
                    });
                }
            }
        }
        catch (error) {
            core.warning(`Failed to get commits: ${error}`);
        }
        return commits;
    }
}
exports.GitProvider = GitProvider;
//# sourceMappingURL=git.js.map