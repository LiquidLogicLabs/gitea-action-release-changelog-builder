import { BaseProvider } from './providers/base';
import { TagInfo, ProviderPlatform } from './types';
import { Logger } from './logger';
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
export declare function resolveTags(provider: BaseProvider, owner: string, repo: string, repositoryPath: string, fromTagInput: string | undefined, toTagInput: string | undefined, platform: ProviderPlatform, logger: Logger, maxTagsToFetch?: number): Promise<{
    fromTag: TagInfo;
    toTag: TagInfo;
}>;
//# sourceMappingURL=tags.d.ts.map