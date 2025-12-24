import * as core from '@actions/core'
import {ProviderPlatform} from './types'

/**
 * Detect the platform from environment variables or input
 */
export function detectPlatform(inputPlatform?: string, baseUrl?: string): ProviderPlatform {
  // If explicitly provided, use it
  if (inputPlatform) {
    if (inputPlatform === 'github' || inputPlatform === 'gitea') {
      return inputPlatform
    }
    throw new Error(`Unsupported platform: ${inputPlatform}. Supported platforms: github, gitea`)
  }

  // Try to detect from environment variables
  const giteaServerUrl = process.env.GITEA_SERVER_URL
  const githubServerUrl = process.env.GITHUB_SERVER_URL || process.env.GITHUB_API_URL

  // Check baseUrl if provided
  if (baseUrl) {
    const url = baseUrl.toLowerCase()
    if (url.includes('gitea')) {
      return 'gitea'
    }
    if (url.includes('github')) {
      return 'github'
    }
  }

  // Check environment variables
  if (giteaServerUrl) {
    core.info(`ℹ️ Detected Gitea platform from GITEA_SERVER_URL`)
    return 'gitea'
  }

  if (githubServerUrl) {
    core.info(`ℹ️ Detected GitHub platform from GITHUB_SERVER_URL`)
    return 'github'
  }

  // Default to GitHub if nothing is detected
  core.info(`ℹ️ No platform detected from environment, defaulting to GitHub`)
  return 'github'
}

/**
 * Get the appropriate API base URL for the platform
 */
export function getApiBaseUrl(platform: ProviderPlatform, inputBaseUrl?: string): string {
  if (inputBaseUrl) {
    return inputBaseUrl
  }

  switch (platform) {
    case 'gitea':
      return process.env.GITEA_SERVER_URL || 'https://gitea.com'
    case 'github':
      return process.env.GITHUB_API_URL || process.env.GITHUB_SERVER_URL || 'https://api.github.com'
    default:
      return 'https://api.github.com'
  }
}

