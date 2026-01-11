import { ProviderPlatform } from './types';
import { Logger } from './logger';
export interface OwnerRepo {
    owner: string;
    repo: string;
}
/**
 * Detect owner and repo from various sources (inputs, environment variables, context)
 */
export declare function detectOwnerRepo(ownerInput: string | undefined, repoInput: string | undefined, platform: ProviderPlatform, logger: Logger): Promise<OwnerRepo>;
//# sourceMappingURL=context.d.ts.map