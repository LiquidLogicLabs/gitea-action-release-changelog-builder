import * as core from '@actions/core'
import {BaseProvider} from './providers/base'
import {createProvider} from './providers/factory'
import {detectPlatform, getApiBaseUrl} from './platform'
import {resolveConfiguration} from './config'
import {generateChangelog} from './changelog'
import {detectOwnerRepo} from './context'
import {detectToken} from './token'
import {resolveTags} from './tags'
import {collectPullRequests} from './collector'
import {TagInfo, PullRequestInfo} from './types'
import {Logger} from './logger'
import moment from 'moment'
import * as path from 'path'

/**
 * Main entry point for the action
 * Exported for testing purposes
 */
export async function run(): Promise<void> {
  try {
    // Get verbose input and create logger
    const verbose = core.getBooleanInput('verbose')
    const logger = new Logger(verbose)

    core.setOutput('failed', 'false')

    // Read inputs
    const platformInput = core.getInput('platform')
    const tokenInput = core.getInput('token')
    const baseUrlInput = core.getInput('baseUrl')
    const ownerInput = core.getInput('owner')
    const repoInput = core.getInput('repo')
    const fromTagInput = core.getInput('fromTag')
    const toTagInput = core.getInput('toTag')
    const modeInput = core.getInput('mode') || 'PR'
    const configurationJson = core.getInput('configurationJson')
    const configurationFile = core.getInput('configuration')
    const ignorePreReleases = core.getInput('ignorePreReleases') === 'true'
    const fetchTagAnnotations = core.getInput('fetchTagAnnotations') === 'true'
    const prefixMessage = core.getInput('prefixMessage')
    const postfixMessage = core.getInput('postfixMessage')
    const includeOpen = core.getInput('includeOpen') === 'true'
    const failOnError = core.getInput('failOnError') === 'true'

    // Get repository path
    const repositoryPath = process.env.GITHUB_WORKSPACE || process.env.GITEA_WORKSPACE || process.cwd()

    // Detect platform
    const platform = detectPlatform(platformInput, baseUrlInput, repositoryPath)
    const baseUrl = getApiBaseUrl(platform, baseUrlInput)

    // Get token
    const token = detectToken(platform, tokenInput)

    // Get owner and repo - handle both GitHub and Gitea contexts
    const {owner, repo} = await detectOwnerRepo(ownerInput, repoInput, platform, logger)

    logger.info(`ℹ️ Processing ${owner}/${repo} on ${platform}`)
    logger.debug(`Platform: ${platform}, Base URL: ${baseUrl}, Owner: ${owner}, Repo: ${repo}`)

    // Validate mode for local/git platform (COMMIT only)
    if ((platform === 'local' || platform === 'git') && (modeInput === 'PR' || modeInput === 'HYBRID')) {
      throw new Error(`PR and HYBRID modes are not supported for ${platform} platform. Use COMMIT mode instead.`)
    }

    // Initialize provider via factory
    const provider = createProvider(platform, token, baseUrl, repositoryPath)

    // Resolve configuration
    const config = resolveConfiguration(repositoryPath, configurationJson, configurationFile)

    // Resolve tags
    const {fromTag, toTag} = await resolveTags(
      provider,
      owner,
      repo,
      repositoryPath,
      fromTagInput,
      toTagInput,
      platform,
      logger
    )

    logger.info(`ℹ️ Comparing ${fromTag.name}...${toTag.name}`)

    // Fetch tag annotation if requested
    let tagAnnotation: string | null = null
    if (fetchTagAnnotations && toTag) {
      tagAnnotation = await provider.getTagAnnotation(toTag.name)
      if (tagAnnotation) {
        logger.info(`ℹ️ Retrieved tag annotation for ${toTag.name}`)
        logger.debug(`Tag annotation: ${tagAnnotation.substring(0, 100)}...`)
        core.setOutput('tag_annotation', tagAnnotation)
      }
    }

    // Collect pull requests based on mode
    const pullRequests = await collectPullRequests(
      provider,
      owner,
      repo,
      fromTag,
      toTag,
      modeInput,
      includeOpen,
      platform,
      logger
    )

    logger.info(`ℹ️ Found ${pullRequests.length} items to include in changelog`)
    logger.debug(`Mode: ${modeInput}, Pull requests: ${pullRequests.length}`)

    // Generate changelog
    const changelog = generateChangelog(
      pullRequests,
      config,
      tagAnnotation,
      prefixMessage,
      postfixMessage
    )

    // Set outputs
    core.setOutput('changelog', changelog)
    core.setOutput('owner', owner)
    core.setOutput('repo', repo)
    core.setOutput('fromTag', fromTag.name)
    core.setOutput('toTag', toTag.name)

    // Contributors
    const contributors = Array.from(new Set(pullRequests.map(pr => pr.author))).join(', ')
    core.setOutput('contributors', contributors)

    // PR numbers
    const prNumbers = pullRequests
      .filter(pr => pr.number > 0)
      .map(pr => pr.number)
      .join(', ')
    core.setOutput('pull_requests', prNumbers)

    logger.info('✅ Changelog generated successfully')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    core.setOutput('failed', 'true')
    
    // Create logger even in error case (may not have been created if error occurred early)
    const verbose = core.getBooleanInput('verbose')
    const logger = new Logger(verbose)
    
    const failOnError = core.getInput('failOnError') === 'true'
    if (failOnError) {
      logger.error(errorMessage)
      core.setFailed(errorMessage)
    } else {
      logger.error(errorMessage)
    }
  }
}

run()

