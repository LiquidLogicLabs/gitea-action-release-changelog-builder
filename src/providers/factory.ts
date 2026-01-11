import {BaseProvider} from './base'
import {GithubProvider} from './github'
import {GiteaProvider} from './gitea'
import {GitProvider} from './git'
import {ProviderPlatform} from '../types'

/**
 * Create a provider instance based on the platform
 * @param platform Platform type (github, gitea, local, git)
 * @param token Token for API access (empty string for local/git)
 * @param baseUrl Optional API base URL
 * @param repositoryPath Path to the repository
 * @returns Provider instance
 */
export function createProvider(
  platform: ProviderPlatform,
  token: string,
  baseUrl: string | undefined,
  repositoryPath: string
): BaseProvider {
  switch (platform) {
    case 'github':
      return new GithubProvider(token, baseUrl, repositoryPath)
    case 'gitea':
      return new GiteaProvider(token, baseUrl, repositoryPath)
    case 'local':
    case 'git':
      return new GitProvider(repositoryPath) // No token/baseUrl needed, both 'local' and 'git' use GitProvider
    default:
      throw new Error(`Unsupported platform: ${platform}`)
  }
}
