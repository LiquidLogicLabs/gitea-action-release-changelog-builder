/**
 * Get tag annotation message using git command
 * @param repositoryPath Path to the repository
 * @param tag Tag name
 * @returns Tag annotation message or null if tag doesn't exist or isn't annotated
 */
export declare function getTagAnnotation(repositoryPath: string, tag: string): Promise<string | null>;
/**
 * Check if a tag exists
 */
export declare function tagExists(repositoryPath: string, tag: string): Promise<boolean>;
/**
 * Get the commit SHA that a tag points to
 */
export declare function getTagCommit(repositoryPath: string, tag: string): Promise<string | null>;
//# sourceMappingURL=git.d.ts.map