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
exports.resolveTags = resolveTags;
const github = __importStar(require("@actions/github"));
/**
 * Resolve tags from inputs or auto-detect from repository tags
 * @param provider Provider instance
 * @param owner Repository owner
 * @param repo Repository name
 * @param repositoryPath Path to the repository
 * @param fromTagInput Optional fromTag input
 * @param toTagInput Optional toTag input
 * @param platform Platform type
 * @param logger Logger instance
 * @param maxTagsToFetch Maximum number of tags to fetch (default: 1000)
 * @returns Object with fromTag and toTag
 */
async function resolveTags(provider, owner, repo, repositoryPath, fromTagInput, toTagInput, platform, logger, maxTagsToFetch = 1000) {
    let fromTag = null;
    let toTag = null;
    // Initial tag fetch limit (optimistic - most repos have <200 tags)
    const INITIAL_TAG_LIMIT = 200;
    // Get initial batch of tags (sorted by date, newest first)
    let allTags = await provider.getTags(owner, repo, Math.min(INITIAL_TAG_LIMIT, maxTagsToFetch));
    if (allTags.length === 0) {
        throw new Error('No tags found in repository');
    }
    logger.debug(`Fetched ${allTags.length} tags (limit: ${Math.min(INITIAL_TAG_LIMIT, maxTagsToFetch)})`);
    /**
     * Find a tag by name, fetching more tags if not found (dynamic fetching)
     */
    const findTag = async (tagName) => {
        const normalizedTagName = tagName.trim();
        if (!normalizedTagName)
            return null;
        // First try in the current tag list
        let foundTag = allTags.find((t) => t.name === normalizedTagName) || null;
        // If not found and we haven't reached max limit, fetch more tags
        if (!foundTag && allTags.length < maxTagsToFetch) {
            logger.debug(`Tag '${normalizedTagName}' not found in first ${allTags.length} tags, fetching more...`);
            allTags = await provider.getTags(owner, repo, maxTagsToFetch);
            logger.debug(`Fetched ${allTags.length} total tags (up to limit: ${maxTagsToFetch})`);
            foundTag = allTags.find((t) => t.name === normalizedTagName) || null;
        }
        return foundTag;
    };
    // Get fromTag if provided
    if (fromTagInput) {
        const foundTag = await findTag(fromTagInput);
        if (!foundTag) {
            throw new Error(`Tag '${fromTagInput}' not found in repository. ` +
                `Searched ${allTags.length} tag(s). ` +
                `If this is an old tag, try increasing maxTagsToFetch (current: ${maxTagsToFetch}).`);
        }
        fromTag = foundTag;
        fromTag = await provider.fillTagInformation(repositoryPath, owner, repo, fromTag);
        logger.info(`✓ Using provided fromTag: ${fromTag.name}`);
    }
    // Get toTag if provided
    if (toTagInput) {
        const foundTag = await findTag(toTagInput);
        if (!foundTag) {
            // Graceful fallback: if user provided a toTag but we can't find it, fall back to auto-detection.
            logger.warning(`⚠️ toTag '${toTagInput}' not found in repository. Falling back to latest tag. ` +
                `Searched ${allTags.length} tag(s).`);
        }
        else {
            toTag = foundTag;
            toTag = await provider.fillTagInformation(repositoryPath, owner, repo, toTag);
            logger.info(`✓ Using provided toTag: ${toTag.name}`);
        }
    }
    // Auto-detect toTag if not provided
    if (!toTag) {
        // Try to get from context first (for backwards compatibility with tag push events)
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
            const foundTag = await findTag(tagName);
            if (foundTag) {
                toTag = foundTag;
                toTag = await provider.fillTagInformation(repositoryPath, owner, repo, toTag);
                logger.info(`✓ Using toTag from context: ${toTag.name}`);
            }
        }
        // If not found in context, use the latest tag (first in the sorted list)
        if (!toTag) {
            toTag = allTags[0]; // Latest tag (newest first)
            toTag = await provider.fillTagInformation(repositoryPath, owner, repo, toTag);
            logger.info(`✓ Auto-detected toTag (latest): ${toTag.name}`);
        }
    }
    // Auto-detect fromTag if not provided (find the tag before toTag)
    if (!fromTag) {
        const toTagIndex = allTags.findIndex((t) => t.name === toTag.name);
        if (toTagIndex >= 0 && toTagIndex < allTags.length - 1) {
            // Tags are sorted newest first, so the previous tag is at index + 1
            fromTag = allTags[toTagIndex + 1];
            fromTag = await provider.fillTagInformation(repositoryPath, owner, repo, fromTag);
            logger.info(`✓ Auto-detected fromTag (previous): ${fromTag.name}`);
        }
        else {
            throw new Error(`Could not determine fromTag: no tag found before ${toTag.name}. ` +
                `Searched ${allTags.length} tag(s). ` +
                `If ${toTag.name} is not the latest tag, try increasing maxTagsToFetch (current: ${maxTagsToFetch}).`);
        }
    }
    return { fromTag, toTag };
}
//# sourceMappingURL=tags.js.map