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
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectOwnerRepo = detectOwnerRepo;
const github = __importStar(require("@actions/github"));
const exec = __importStar(require("@actions/exec"));
const path = __importStar(require("path"));
/**
 * Detect owner and repo from various sources (input repo string, environment variables, context)
 */
async function detectOwnerRepo(repoInput, platform, logger) {
    let owner;
    let repo;
    // If repo input provided, try to parse owner/repo from it (supports URL or owner/repo)
    if (repoInput) {
        const parsed = parseRepo(repoInput);
        if (parsed) {
            owner = parsed.owner;
            repo = parsed.repo;
            logger.debug(`Using owner/repo from repo input: ${owner}/${repo}`);
        }
        else {
            logger.debug(`Failed to parse repo input: ${repoInput}`);
        }
    }
    if (!owner || !repo) {
        // GITHUB_REPOSITORY is available in both GitHub and Gitea Actions (format: "owner/repo")
        const githubRepo = process.env.GITHUB_REPOSITORY;
        if (githubRepo) {
            const parts = githubRepo.split('/');
            if (parts.length === 2) {
                owner = parts[0];
                repo = parts[1];
                logger.debug(`Using owner/repo from GITHUB_REPOSITORY: ${owner}/${repo}`);
            }
        }
        // Fallback: Try GITEA_REPOSITORY for Gitea (if not already set)
        if ((!owner || !repo) && platform === 'gitea') {
            const giteaRepo = process.env.GITEA_REPOSITORY;
            if (giteaRepo) {
                const parts = giteaRepo.split('/');
                if (parts.length === 2) {
                    owner = parts[0];
                    repo = parts[1];
                    logger.debug(`Using owner/repo from GITEA_REPOSITORY: ${owner}/${repo}`);
                }
            }
        }
        // Fallback: Try github.context for GitHub (if not already set)
        if ((!owner || !repo) && platform === 'github') {
            try {
                if (github.context && github.context.repo) {
                    owner = github.context.repo.owner;
                    repo = github.context.repo.repo;
                    logger.debug(`Using owner/repo from github.context: ${owner}/${repo}`);
                }
            }
            catch (error) {
                logger.debug(`Failed to get owner/repo from github.context: ${error}`);
            }
        }
        // For local/git platforms, try to get owner/repo from git config or repository path
        if ((!owner || !repo) && (platform === 'local' || platform === 'git')) {
            try {
                // Try to get from git config remote.origin.url
                let gitRemoteUrl = '';
                try {
                    let output = '';
                    await exec.exec('git', ['config', '--get', 'remote.origin.url'], {
                        cwd: process.env.GITHUB_WORKSPACE || process.env.GITEA_WORKSPACE || process.cwd(),
                        silent: true,
                        listeners: {
                            stdout: (data) => {
                                output += data.toString();
                            }
                        }
                    });
                    gitRemoteUrl = output.trim();
                }
                catch {
                    // Git config not available, continue with fallback
                }
                // Parse owner/repo from git remote URL (format: git@github.com:owner/repo.git or https://github.com/owner/repo.git)
                if (gitRemoteUrl) {
                    const match = gitRemoteUrl.match(/(?:git@|https?:\/\/)(?:[\w.-]+@)?([\w.-]+)[\/:]([\w.-]+)\/([\w.-]+)(?:\.git)?/);
                    if (match && match[2] && match[3]) {
                        owner = match[2];
                        repo = match[3].replace(/\.git$/, '');
                        logger.debug(`Using owner/repo from git remote.origin.url: ${owner}/${repo}`);
                    }
                }
                // Fallback: Use repository path directory name as repo name
                if ((!owner || !repo) && (process.env.GITHUB_WORKSPACE || process.env.GITEA_WORKSPACE)) {
                    const workspace = process.env.GITHUB_WORKSPACE || process.env.GITEA_WORKSPACE || '';
                    const workspaceName = path.basename(workspace);
                    if (workspaceName) {
                        repo = workspaceName;
                        owner = 'local';
                        logger.debug(`Using owner/repo from workspace path: ${owner}/${repo}`);
                    }
                }
            }
            catch (error) {
                logger.debug(`Failed to get owner/repo from git config: ${error}`);
            }
        }
    }
    if (!owner || !repo) {
        const envInfo = [
            `GITHUB_REPOSITORY=${process.env.GITHUB_REPOSITORY || 'not set'}`,
            `GITEA_REPOSITORY=${process.env.GITEA_REPOSITORY || 'not set'}`,
            `Platform=${platform}`,
            `Repo input=${repoInput || 'not provided'}`
        ].join(', ');
        logger.debug(`Environment info: ${envInfo}`);
        throw new Error(`Owner and repo are required. Provide via repo input (owner/repo or URL) or ensure running in a GitHub/Gitea Actions environment. (${envInfo})`);
    }
    return { owner, repo };
}
/**
 * Parse a repository string into owner/repo.
 * Supports:
 * - owner/repo
 * - https://github.com/owner/repo(.git)
 * - git@github.com:owner/repo(.git)
 */
function parseRepo(repoInput) {
    const trimmed = repoInput.trim();
    if (!trimmed)
        return null;
    // URL or SSH formats
    const urlMatch = trimmed.match(/^(?:https?:\/\/|git@)([^/:]+)[/:]([^/]+)\/([^/]+?)(?:\.git)?$/);
    if (urlMatch) {
        return { owner: urlMatch[2], repo: urlMatch[3] };
    }
    // owner/repo format
    const parts = trimmed.split('/');
    if (parts.length === 2 && parts[0] && parts[1]) {
        return { owner: parts[0], repo: parts[1].replace(/\.git$/, '') };
    }
    return null;
}
//# sourceMappingURL=context.js.map