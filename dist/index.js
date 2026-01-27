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
exports.run = run;
const core = __importStar(require("@actions/core"));
const factory_1 = require("./providers/factory");
const platform_1 = require("./platform");
const config_1 = require("./config");
const changelog_1 = require("./changelog");
const context_1 = require("./context");
const token_1 = require("./token");
const tags_1 = require("./tags");
const collector_1 = require("./collector");
const logger_1 = require("./logger");
/**
 * Main entry point for the action
 * Exported for testing purposes
 */
async function run() {
    // Keep these available for graceful error handling
    let resolvedConfig;
    let resolvedPrefixMessage;
    let resolvedPostfixMessage;
    const normalizeOptional = (value) => {
        const trimmed = value.trim();
        return trimmed ? trimmed : undefined;
    };
    try {
        // Get verbose input and create logger
        const verbose = core.getBooleanInput('verbose');
        const logger = new logger_1.Logger(verbose);
        core.setOutput('failed', 'false');
        // Read inputs
        const platformInput = normalizeOptional(core.getInput('platform') || '');
        const tokenInput = normalizeOptional(core.getInput('token') || '');
        const repoInput = normalizeOptional(core.getInput('repo') || '');
        const fromTagInput = normalizeOptional(core.getInput('fromTag') || '');
        const toTagInput = normalizeOptional(core.getInput('toTag') || '');
        const modeInput = core.getInput('mode') || 'PR';
        const configurationJson = core.getInput('configurationJson');
        const configurationFile = core.getInput('configuration');
        const ignorePreReleases = core.getInput('ignorePreReleases') === 'true';
        const fetchTagAnnotations = core.getInput('fetchTagAnnotations') === 'true';
        const prefixMessage = core.getInput('prefixMessage');
        const postfixMessage = core.getInput('postfixMessage');
        const includeOpen = core.getInput('includeOpen') === 'true';
        const failOnError = core.getInput('failOnError') === 'true';
        const maxTagsToFetchInput = core.getInput('maxTagsToFetch');
        const maxTagsToFetch = maxTagsToFetchInput ? parseInt(maxTagsToFetchInput, 10) : 1000;
        // Get repository path
        const repositoryPath = process.env.GITHUB_WORKSPACE || process.env.GITEA_WORKSPACE || process.cwd();
        // Detect platform
        const platform = await (0, platform_1.detectPlatform)(platformInput, repositoryPath);
        const baseUrl = (0, platform_1.getApiBaseUrl)(platform);
        // Get token
        const token = (0, token_1.detectToken)(platform, tokenInput);
        // Get owner and repo - handle both GitHub and Gitea contexts
        const { owner, repo } = await (0, context_1.detectOwnerRepo)(repoInput, platform, logger);
        logger.info(`ℹ️ Processing ${owner}/${repo} on ${platform}`);
        logger.debug(`Platform: ${platform}, Base URL: ${baseUrl}, Owner: ${owner}, Repo: ${repo}`);
        // Validate mode for local/git platform (COMMIT only)
        if ((platform === 'local' || platform === 'git') && (modeInput === 'PR' || modeInput === 'HYBRID')) {
            throw new Error(`PR and HYBRID modes are not supported for ${platform} platform. Use COMMIT mode instead.`);
        }
        // Initialize provider via factory
        const provider = (0, factory_1.createProvider)(platform, token, baseUrl, repositoryPath);
        // Resolve configuration
        const config = (0, config_1.resolveConfiguration)(repositoryPath, configurationJson, configurationFile);
        resolvedConfig = config;
        resolvedPrefixMessage = prefixMessage || undefined;
        resolvedPostfixMessage = postfixMessage || undefined;
        // Resolve tags
        const { fromTag, toTag } = await (0, tags_1.resolveTags)(provider, owner, repo, repositoryPath, fromTagInput, toTagInput, platform, logger, maxTagsToFetch);
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
        const pullRequests = await (0, collector_1.collectPullRequests)(provider, owner, repo, fromTag, toTag, modeInput, includeOpen, platform, logger);
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
        // Graceful fallback: always emit a non-empty changelog output so downstream steps
        // (like release creation) don't end up with an empty body.
        try {
            const cfg = resolvedConfig ?? (0, config_1.resolveConfiguration)(process.cwd(), core.getInput('configurationJson'), core.getInput('configuration'));
            const isNoTags = /no tags found in repository/i.test(errorMessage);
            const fallback = isNoTags
                ? `⚠️ ${errorMessage}\n\n${cfg.empty_template ?? '- no changes'}`
                : `⚠️ Changelog generation failed: ${errorMessage}`;
            // Include prefix/postfix if we have them, and apply the template consistently.
            const fallbackChangelog = (0, changelog_1.generateChangelog)([], { ...cfg, empty_template: fallback }, null, resolvedPrefixMessage, resolvedPostfixMessage);
            core.setOutput('changelog', fallbackChangelog);
            // These may be unknown in error cases; emit empty values instead of omitting.
            core.setOutput('owner', '');
            core.setOutput('repo', '');
            core.setOutput('fromTag', '');
            core.setOutput('toTag', '');
            core.setOutput('contributors', '');
            core.setOutput('pull_requests', '');
        }
        catch {
            // If even fallback generation fails, ensure at least changelog is set.
            core.setOutput('changelog', `⚠️ Changelog generation failed: ${errorMessage}`);
        }
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