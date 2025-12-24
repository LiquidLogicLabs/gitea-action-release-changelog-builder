"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseProvider = void 0;
/**
 * Base abstract class for Git provider implementations
 * Provides a common interface for GitHub, Gitea, and future providers
 */
class BaseProvider {
    token;
    baseUrl;
    repositoryPath;
    constructor(token, baseUrl, repositoryPath) {
        this.token = token;
        this.baseUrl = baseUrl;
        this.repositoryPath = repositoryPath;
    }
}
exports.BaseProvider = BaseProvider;
//# sourceMappingURL=base.js.map