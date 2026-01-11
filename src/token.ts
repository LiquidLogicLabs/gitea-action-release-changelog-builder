import {ProviderPlatform} from './types'

/**
 * Detect token from input or environment variables
 * @param platform Platform type (github, gitea, local, git)
 * @param tokenInput Token provided via input (optional)
 * @returns Token string (empty string for local/git platforms)
 */
export function detectToken(platform: ProviderPlatform, tokenInput?: string): string {
  // Local/Git platform doesn't need tokens
  if (platform === 'local' || platform === 'git') {
    return ''
  }

  if (tokenInput) {
    return tokenInput
  }

  // Try platform-specific token first
  if (platform === 'gitea') {
    const token = process.env.GITEA_TOKEN
    if (token) {
      return token
    }
  }

  // Fallback to GitHub token (works in both GitHub and Gitea Actions)
  const token = process.env.GITHUB_TOKEN
  if (token) {
    return token
  }

  throw new Error('Token is required. Provide via input or environment variable (GITHUB_TOKEN or GITEA_TOKEN).')
}
