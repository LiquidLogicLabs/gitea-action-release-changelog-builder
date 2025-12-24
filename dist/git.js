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
exports.getTagAnnotation = getTagAnnotation;
exports.tagExists = tagExists;
exports.getTagCommit = getTagCommit;
const exec = __importStar(require("@actions/exec"));
const core = __importStar(require("@actions/core"));
/**
 * Execute a git command and return the output
 */
async function execGit(repositoryPath, args, silent = false) {
    let output = '';
    let errorOutput = '';
    const options = {
        cwd: repositoryPath,
        silent: silent,
        listeners: {
            stdout: (data) => {
                output += data.toString();
            },
            stderr: (data) => {
                errorOutput += data.toString();
            }
        }
    };
    try {
        await exec.exec('git', args, options);
        return output.trim();
    }
    catch (error) {
        if (errorOutput) {
            core.debug(`Git command error: ${errorOutput}`);
        }
        throw error;
    }
}
/**
 * Get tag annotation message using git command
 * @param repositoryPath Path to the repository
 * @param tag Tag name
 * @returns Tag annotation message or null if tag doesn't exist or isn't annotated
 */
async function getTagAnnotation(repositoryPath, tag) {
    try {
        // Try to get annotated tag message
        // git tag -l -n999 <tag> will show the annotation if it exists
        const output = await execGit(repositoryPath, ['tag', '-l', '-n999', tag], true);
        if (!output) {
            // Tag doesn't exist
            return null;
        }
        // Parse the output: format is "tag-name    annotation message"
        // If it's an annotated tag, it will have the message after the tag name
        // If it's a lightweight tag, it will just be the tag name
        const lines = output.split('\n');
        const firstLine = lines[0] || '';
        // Extract annotation message (everything after the tag name and whitespace)
        const match = firstLine.match(new RegExp(`^${tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+(.+)$`));
        if (match && match[1]) {
            return match[1].trim();
        }
        // Alternative: try git cat-file to get annotated tag object
        try {
            const catOutput = await execGit(repositoryPath, ['cat-file', '-p', `refs/tags/${tag}`], true);
            // Parse annotated tag format
            // Annotated tags have a format like:
            // object <sha>
            // type commit
            // tag <tag-name>
            // tagger <author> <date>
            // <blank line>
            // <annotation message>
            const catLines = catOutput.split('\n');
            let inMessage = false;
            let messageLines = [];
            for (const line of catLines) {
                if (inMessage) {
                    messageLines.push(line);
                }
                else if (line.trim() === '') {
                    // Empty line signals start of message
                    inMessage = true;
                }
            }
            if (messageLines.length > 0) {
                return messageLines.join('\n').trim();
            }
        }
        catch {
            // Not an annotated tag or error reading, fall through
        }
        // Lightweight tag - no annotation
        return null;
    }
    catch (error) {
        core.debug(`Failed to get tag annotation for ${tag}: ${error}`);
        return null;
    }
}
/**
 * Check if a tag exists
 */
async function tagExists(repositoryPath, tag) {
    try {
        const output = await execGit(repositoryPath, ['tag', '-l', tag], true);
        return output.trim() === tag;
    }
    catch {
        return false;
    }
}
/**
 * Get the commit SHA that a tag points to
 */
async function getTagCommit(repositoryPath, tag) {
    try {
        return await execGit(repositoryPath, ['rev-list', '-n', '1', tag], true);
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=git.js.map