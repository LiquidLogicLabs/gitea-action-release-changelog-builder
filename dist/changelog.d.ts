import { Configuration, PullRequestInfo } from './types';
/**
 * Generate changelog from pull requests using configuration
 */
export declare function generateChangelog(pullRequests: PullRequestInfo[], config: Configuration, tagAnnotation?: string | null, prefixMessage?: string, postfixMessage?: string): string;
