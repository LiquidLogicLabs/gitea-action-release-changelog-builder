import {BaseProvider} from './providers/base'
import {TagInfo, ProviderPlatform} from './types'
import {Logger} from './logger'
import * as github from '@actions/github'

/**
 * Resolve tags from inputs or context
 * @param provider Provider instance
 * @param owner Repository owner
 * @param repo Repository name
 * @param repositoryPath Path to the repository
 * @param fromTagInput Optional fromTag input
 * @param toTagInput Optional toTag input
 * @param platform Platform type
 * @param logger Logger instance
 * @returns Object with fromTag and toTag
 */
export async function resolveTags(
  provider: BaseProvider,
  owner: string,
  repo: string,
  repositoryPath: string,
  fromTagInput: string | undefined,
  toTagInput: string | undefined,
  platform: ProviderPlatform,
  logger: Logger
): Promise<{fromTag: TagInfo, toTag: TagInfo}> {
  let fromTag: TagInfo | null = null
  let toTag: TagInfo | null = null

  // Get fromTag if provided
  if (fromTagInput) {
    const tags = await provider.getTags(owner, repo, 200)
    fromTag = tags.find((t: TagInfo) => t.name === fromTagInput) || null
    if (fromTag) {
      fromTag = await provider.fillTagInformation(repositoryPath, owner, repo, fromTag)
    }
  }

  // Get toTag if provided
  if (toTagInput) {
    const tags = await provider.getTags(owner, repo, 200)
    toTag = tags.find((t: TagInfo) => t.name === toTagInput) || null
    if (toTag) {
      toTag = await provider.fillTagInformation(repositoryPath, owner, repo, toTag)
    }
  }

  // If tags not provided, try to get from context (both GitHub and Gitea)
  if (!toTag) {
    let ref: string | undefined
    if (platform === 'gitea') {
      ref = process.env.GITEA_REF
    } else {
      try {
        ref = github.context.ref
      } catch (error) {
        logger.debug(`Failed to get ref from github.context: ${error}`)
      }
    }

    if (ref && ref.startsWith('refs/tags/')) {
      const tagName = ref.replace('refs/tags/', '')
      logger.debug(`Detected tag from context: ${tagName}`)
      const tags = await provider.getTags(owner, repo, 200)
      toTag = tags.find((t: TagInfo) => t.name === tagName) || null
      if (toTag) {
        toTag = await provider.fillTagInformation(repositoryPath, owner, repo, toTag)
      } else {
        logger.debug(`Tag ${tagName} not found in repository tags`)
      }
    }
  }

  if (!toTag) {
    throw new Error('toTag is required. Provide via input or ensure running on a tag.')
  }

  // Find fromTag if not provided
  if (!fromTag) {
    const tags = await provider.getTags(owner, repo, 200)
    // Find the tag before toTag
    const toTagIndex = tags.findIndex((t: TagInfo) => t.name === toTag!.name)
    if (toTagIndex >= 0 && toTagIndex < tags.length - 1) {
      fromTag = tags[toTagIndex + 1]
      if (fromTag) {
        fromTag = await provider.fillTagInformation(repositoryPath, owner, repo, fromTag)
      }
    }
  }

  if (!fromTag) {
    throw new Error('Could not determine fromTag')
  }

  return {fromTag, toTag}
}
