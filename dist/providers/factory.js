"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProvider = createProvider;
const github_1 = require("./github");
const gitea_1 = require("./gitea");
const git_1 = require("./git");
/**
 * Create a provider instance based on the platform
 * @param platform Platform type (github, gitea, local, git)
 * @param token Token for API access (empty string for local/git)
 * @param baseUrl Optional API base URL
 * @param repositoryPath Path to the repository
 * @returns Provider instance
 */
function createProvider(platform, token, baseUrl, repositoryPath) {
    switch (platform) {
        case 'github':
            return new github_1.GithubProvider(token, baseUrl, repositoryPath);
        case 'gitea':
            return new gitea_1.GiteaProvider(token, baseUrl, repositoryPath);
        case 'local':
        case 'git':
            return new git_1.GitProvider(repositoryPath); // No token/baseUrl needed, both 'local' and 'git' use GitProvider
        default:
            throw new Error(`Unsupported platform: ${platform}`);
    }
}
//# sourceMappingURL=factory.js.map