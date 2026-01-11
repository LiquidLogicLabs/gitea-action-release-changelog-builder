import { ProviderPlatform } from './types';
/**
 * Detect token from input or environment variables
 * @param platform Platform type (github, gitea, local, git)
 * @param tokenInput Token provided via input (optional)
 * @returns Token string (empty string for local/git platforms)
 */
export declare function detectToken(platform: ProviderPlatform, tokenInput?: string): string;
//# sourceMappingURL=token.d.ts.map