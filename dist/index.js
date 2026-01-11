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
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const github_1 = require("./providers/github");
const gitea_1 = require("./providers/gitea");
const platform_1 = require("./platform");
const config_1 = require("./config");
const changelog_1 = require("./changelog");
const logger_1 = require("./logger");
const moment_1 = __importDefault(require("moment"));
async function run() {
    try {
        // Get verbose input and create logger
        const verbose = core.getBooleanInput('verbose');
        const logger = new logger_1.Logger(verbose);
        core.setOutput('failed', 'false');
        // Read inputs
        const platformInput = core.getInput('platform');
        const tokenInput = core.getInput('token');
        const baseUrlInput = core.getInput('baseUrl');
        const ownerInput = core.getInput('owner');
        const repoInput = core.getInput('repo');
        const fromTagInput = core.getInput('fromTag');
        const toTagInput = core.getInput('toTag');
        const modeInput = core.getInput('mode') || 'PR';
        const configurationJson = core.getInput('configurationJson');
        const configurationFile = core.getInput('configuration');
        const ignorePreReleases = core.getInput('ignorePreReleases') === 'true';
        const fetchTagAnnotations = core.getInput('fetchTagAnnotations') === 'true';
        const prefixMessage = core.getInput('prefixMessage');
        const postfixMessage = core.getInput('postfixMessage');
        const includeOpen = core.getInput('includeOpen') === 'true';
        const failOnError = core.getInput('failOnError') === 'true';
        // Get repository path
        const repositoryPath = process.env.GITHUB_WORKSPACE || process.env.GITEA_WORKSPACE || process.cwd();
        // Detect platform
        const platform = (0, platform_1.detectPlatform)(platformInput, baseUrlInput);
        const baseUrl = (0, platform_1.getApiBaseUrl)(platform, baseUrlInput);
        // Get token
        const token = tokenInput || process.env.GITHUB_TOKEN || process.env.GITEA_TOKEN || '';
        if (!token) {
            throw new Error('Token is required. Provide via input or environment variable.');
        }
        // Get owner and repo - handle both GitHub and Gitea contexts
        let owner = ownerInput;
        let repo = repoInput;
        if (!owner || !repo) {
            // GITHUB_REPOSITORY is available in both GitHub and Gitea Actions (format: "owner/repo")
            const githubRepo = process.env.GITHUB_REPOSITORY;
            if (githubRepo) {
                const parts = githubRepo.split('/');
                if (parts.length === 2) {
                    owner = ownerInput || parts[0];
                    repo = repoInput || parts[1];
                    logger.debug(`Using owner/repo from GITHUB_REPOSITORY: ${owner}/${repo}`);
                }
            }
            // Fallback: Try GITEA_REPOSITORY for Gitea (if not already set)
            if ((!owner || !repo) && platform === 'gitea') {
                const giteaRepo = process.env.GITEA_REPOSITORY;
                if (giteaRepo) {
                    const parts = giteaRepo.split('/');
                    if (parts.length === 2) {
                        owner = ownerInput || parts[0];
                        repo = repoInput || parts[1];
                        logger.debug(`Using owner/repo from GITEA_REPOSITORY: ${owner}/${repo}`);
                    }
                }
            }
            // Fallback: Try github.context for GitHub (if not already set)
            if ((!owner || !repo) && platform === 'github') {
                try {
                    if (github.context && github.context.repo) {
                        owner = ownerInput || github.context.repo.owner;
                        repo = repoInput || github.context.repo.repo;
                        logger.debug(`Using owner/repo from github.context: ${owner}/${repo}`);
                    }
                }
                catch (error) {
                    logger.debug(`Failed to get owner/repo from github.context: ${error}`);
                }
            }
        }
        if (!owner || !repo) {
            const envInfo = [
                `GITHUB_REPOSITORY=${process.env.GITHUB_REPOSITORY || 'not set'}`,
                `GITEA_REPOSITORY=${process.env.GITEA_REPOSITORY || 'not set'}`,
                `Platform=${platform}`,
                `Owner input=${ownerInput || 'not provided'}`,
                `Repo input=${repoInput || 'not provided'}`
            ].join(', ');
            logger.debug(`Environment info: ${envInfo}`);
            throw new Error(`Owner and repo are required. Provide via inputs or ensure running in a GitHub/Gitea Actions environment. (${envInfo})`);
        }
        logger.info(`ℹ️ Processing ${owner}/${repo} on ${platform}`);
        logger.debug(`Platform: ${platform}, Base URL: ${baseUrl}, Owner: ${owner}, Repo: ${repo}`);
        // Initialize provider
        let provider;
        if (platform === 'github') {
            provider = new github_1.GithubProvider(token, baseUrl, repositoryPath);
        }
        else {
            provider = new gitea_1.GiteaProvider(token, baseUrl, repositoryPath);
        }
        // Resolve configuration
        const config = (0, config_1.resolveConfiguration)(repositoryPath, configurationJson, configurationFile);
        // Resolve tags
        let fromTag = null;
        let toTag = null;
        if (fromTagInput) {
            const tags = await provider.getTags(owner, repo, 200);
            fromTag = tags.find(t => t.name === fromTagInput) || null;
            if (fromTag) {
                fromTag = await provider.fillTagInformation(repositoryPath, owner, repo, fromTag);
            }
        }
        if (toTagInput) {
            const tags = await provider.getTags(owner, repo, 200);
            toTag = tags.find(t => t.name === toTagInput) || null;
            if (toTag) {
                toTag = await provider.fillTagInformation(repositoryPath, owner, repo, toTag);
            }
        }
        // If tags not provided, try to get from context (both GitHub and Gitea)
        if (!toTag) {
            let ref;
            if (platform === 'gitea') {
                ref = process.env.GITEA_REF;
            }
            else {
                try {
                    ref = github.context.ref;
                }
                catch (error) {
                    logger.debug(`Failed to get ref from github.context: ${error}`);
                }
            }
            if (ref && ref.startsWith('refs/tags/')) {
                const tagName = ref.replace('refs/tags/', '');
                logger.debug(`Detected tag from context: ${tagName}`);
                const tags = await provider.getTags(owner, repo, 200);
                toTag = tags.find(t => t.name === tagName) || null;
                if (toTag) {
                    toTag = await provider.fillTagInformation(repositoryPath, owner, repo, toTag);
                }
                else {
                    logger.debug(`Tag ${tagName} not found in repository tags`);
                }
            }
        }
        if (!toTag) {
            throw new Error('toTag is required. Provide via input or ensure running on a tag.');
        }
        // Find fromTag if not provided
        if (!fromTag) {
            const tags = await provider.getTags(owner, repo, 200);
            // Find the tag before toTag
            const toTagIndex = tags.findIndex(t => t.name === toTag.name);
            if (toTagIndex >= 0 && toTagIndex < tags.length - 1) {
                fromTag = tags[toTagIndex + 1];
                if (fromTag) {
                    fromTag = await provider.fillTagInformation(repositoryPath, owner, repo, fromTag);
                }
            }
        }
        if (!fromTag) {
            throw new Error('Could not determine fromTag');
        }
        logger.info(`ℹ️ Comparing ${fromTag.name}...${toTag.name}`);
        // Fetch tag annotation if requested
        let tagAnnotation = null;
        if (fetchTagAnnotations && toTag) {
            tagAnnotation = await provider.getTagAnnotation(toTag.name);
            if (tagAnnotation) {
                logger.info(`ℹ️ Retrieved tag annotation for ${toTag.name}`);
                logger.debug(`Tag annotation: ${tagAnnotation.substring(0, 100)}...`);
                core.setOutput('tag_annotation', tagAnnotation);
            }
        }
        // Collect pull requests based on mode
        let pullRequests = [];
        if (modeInput === 'PR' || modeInput === 'HYBRID') {
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
        if (modeInput === 'COMMIT' || modeInput === 'HYBRID') {
            // Get commits and convert to PR-like structure
            const commits = await provider.getCommits(owner, repo, fromTag.name, toTag.name);
            // Convert commits to PR-like structure
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
        }
        logger.info(`ℹ️ Found ${pullRequests.length} items to include in changelog`);
        logger.debug(`Mode: ${modeInput}, Pull requests: ${pullRequests.length}`);
        // Generate changelog
        const changelog = (0, changelog_1.generateChangelog)(pullRequests, config, tagAnnotation, prefixMessage, postfixMessage);
        // Set outputs
        core.setOutput('changelog', changelog);
        core.setOutput('owner', owner);
        core.setOutput('repo', repo);
        core.setOutput('fromTag', fromTag.name);
        core.setOutput('toTag', toTag.name);
        // Contributors
        const contributors = Array.from(new Set(pullRequests.map(pr => pr.author))).join(', ');
        core.setOutput('contributors', contributors);
        // PR numbers
        const prNumbers = pullRequests
            .filter(pr => pr.number > 0)
            .map(pr => pr.number)
            .join(', ');
        core.setOutput('pull_requests', prNumbers);
        logger.info('✅ Changelog generated successfully');
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        core.setOutput('failed', 'true');
        // Create logger even in error case (may not have been created if error occurred early)
        const verbose = core.getBooleanInput('verbose');
        const logger = new logger_1.Logger(verbose);
        const failOnError = core.getInput('failOnError') === 'true';
        if (failOnError) {
            logger.error(errorMessage);
            core.setFailed(errorMessage);
        }
        else {
            logger.error(errorMessage);
        }
    }
}
run();
//# sourceMappingURL=index.js.map