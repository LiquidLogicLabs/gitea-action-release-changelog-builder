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
exports.detectPlatform = detectPlatform;
exports.getApiBaseUrl = getApiBaseUrl;
const core = __importStar(require("@actions/core"));
/**
 * Detect the platform from environment variables or input
 */
function detectPlatform(inputPlatform, baseUrl) {
    // If explicitly provided, use it
    if (inputPlatform) {
        if (inputPlatform === 'github' || inputPlatform === 'gitea') {
            return inputPlatform;
        }
        throw new Error(`Unsupported platform: ${inputPlatform}. Supported platforms: github, gitea`);
    }
    // Try to detect from environment variables
    const giteaServerUrl = process.env.GITEA_SERVER_URL;
    const githubServerUrl = process.env.GITHUB_SERVER_URL || process.env.GITHUB_API_URL;
    // Check baseUrl if provided
    if (baseUrl) {
        const url = baseUrl.toLowerCase();
        if (url.includes('gitea')) {
            return 'gitea';
        }
        if (url.includes('github')) {
            return 'github';
        }
    }
    // Check environment variables
    if (giteaServerUrl) {
        core.info(`ℹ️ Detected Gitea platform from GITEA_SERVER_URL`);
        return 'gitea';
    }
    if (githubServerUrl) {
        core.info(`ℹ️ Detected GitHub platform from GITHUB_SERVER_URL`);
        return 'github';
    }
    // Default to GitHub if nothing is detected
    core.info(`ℹ️ No platform detected from environment, defaulting to GitHub`);
    return 'github';
}
/**
 * Get the appropriate API base URL for the platform
 */
function getApiBaseUrl(platform, inputBaseUrl) {
    if (inputBaseUrl) {
        return inputBaseUrl;
    }
    switch (platform) {
        case 'gitea':
            return process.env.GITEA_SERVER_URL || 'https://gitea.com';
        case 'github':
            return process.env.GITHUB_API_URL || process.env.GITHUB_SERVER_URL || 'https://api.github.com';
        default:
            return 'https://api.github.com';
    }
}
//# sourceMappingURL=platform.js.map