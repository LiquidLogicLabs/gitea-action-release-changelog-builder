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
 * Resolve tags from inputs or context
 * @param provider Provider instance
 * @param owner Repository owner
 * @param repo Repository name
 * @param repositoryPath Path to the repository
 * @param fromTagInput Optional fromTag input
 * @param toTagInput Optional toTag input
 * @param platform Platform type
 * @param logger Logger instance
 * @returns Object with fromTag and toTag
 */
async function resolveTags(provider, owner, repo, repositoryPath, fromTagInput, toTagInput, platform, logger) {
    let fromTag = null;
    let toTag = null;
    // Get fromTag if provided
    if (fromTagInput) {
        const tags = await provider.getTags(owner, repo, 200);
        fromTag = tags.find((t) => t.name === fromTagInput) || null;
        if (fromTag) {
            fromTag = await provider.fillTagInformation(repositoryPath, owner, repo, fromTag);
        }
    }
    // Get toTag if provided
    if (toTagInput) {
        const tags = await provider.getTags(owner, repo, 200);
        toTag = tags.find((t) => t.name === toTagInput) || null;
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
            toTag = tags.find((t) => t.name === tagName) || null;
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
        const toTagIndex = tags.findIndex((t) => t.name === toTag.name);
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
    return { fromTag, toTag };
}
//# sourceMappingURL=tags.js.map