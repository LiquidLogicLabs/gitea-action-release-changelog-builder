import { ProviderPlatform } from './types';
/**
 * Detect the platform from environment variables or input
 */
export declare function detectPlatform(inputPlatform?: string, repositoryPath?: string): ProviderPlatform;
/**
 * Get the appropriate API base URL for the platform
 */
export declare function getApiBaseUrl(platform: ProviderPlatform, inputBaseUrl?: string): string;
//# sourceMappingURL=platform.d.ts.map