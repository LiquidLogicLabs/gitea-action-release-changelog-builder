import { BaseProvider } from './base';
import { ProviderPlatform } from '../types';
/**
 * Create a provider instance based on the platform
 * @param platform Platform type (github, gitea, local, git)
 * @param token Token for API access (empty string for local/git)
 * @param baseUrl Optional API base URL
 * @param repositoryPath Path to the repository
 * @returns Provider instance
 */
export declare function createProvider(platform: ProviderPlatform, token: string, baseUrl: string | undefined, repositoryPath: string): BaseProvider;
//# sourceMappingURL=factory.d.ts.map