import * as core from '@actions/core'
import * as github from '@actions/github'
import {BaseProvider} from './providers/base'
import {GithubProvider} from './providers/github'
import {GiteaProvider} from './providers/gitea'
import {detectPlatform, getApiBaseUrl} from './platform'
import {resolveConfiguration} from './config'
import {generateChangelog} from './changelog'
import {TagInfo, PullRequestInfo} from './types'
import moment from 'moment'
import * as path from 'path'

async function run(): Promise<void> {
  try {
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
    const repositoryPath = process.env.GITHUB_WORKSPACE || process.cwd()

    // Detect platform
    const platform = detectPlatform(platformInput, baseUrlInput)
    const baseUrl = getApiBaseUrl(platform, baseUrlInput)

    // Get token
    const token = tokenInput || process.env.GITHUB_TOKEN || process.env.GITEA_TOKEN || ''
    if (!token) {
      throw new Error('Token is required. Provide via input or environment variable.')
    }

    // Get owner and repo
    const owner = ownerInput || github.context.repo.owner
    const repo = repoInput || github.context.repo.repo

    if (!owner || !repo) {
      throw new Error('Owner and repo are required')
    }

    core.info(`ℹ️ Processing ${owner}/${repo} on ${platform}`)

    // Initialize provider
    let provider: BaseProvider
    if (platform === 'github') {
      provider = new GithubProvider(token, baseUrl, repositoryPath)
    } else {
      provider = new GiteaProvider(token, baseUrl, repositoryPath)
    }

    // Resolve configuration
    const config = resolveConfiguration(repositoryPath, configurationJson, configurationFile)

    // Resolve tags
    let fromTag: TagInfo | null = null
    let toTag: TagInfo | null = null

    if (fromTagInput) {
      const tags = await provider.getTags(owner, repo, 200)
      fromTag = tags.find(t => t.name === fromTagInput) || null
      if (fromTag) {
        fromTag = await provider.fillTagInformation(repositoryPath, owner, repo, fromTag)
      }
    }

    if (toTagInput) {
      const tags = await provider.getTags(owner, repo, 200)
      toTag = tags.find(t => t.name === toTagInput) || null
      if (toTag) {
        toTag = await provider.fillTagInformation(repositoryPath, owner, repo, toTag)
      }
    }

    // If tags not provided, try to get from context
    if (!toTag && github.context.ref?.startsWith('refs/tags/')) {
      const tagName = github.context.ref.replace('refs/tags/', '')
      const tags = await provider.getTags(owner, repo, 200)
      toTag = tags.find(t => t.name === tagName) || null
      if (toTag) {
        toTag = await provider.fillTagInformation(repositoryPath, owner, repo, toTag)
      }
    }

    if (!toTag) {
      throw new Error('toTag is required. Provide via input or ensure running on a tag.')
    }

    // Find fromTag if not provided
    if (!fromTag) {
      const tags = await provider.getTags(owner, repo, 200)
      // Find the tag before toTag
      const toTagIndex = tags.findIndex(t => t.name === toTag!.name)
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

    core.info(`ℹ️ Comparing ${fromTag.name}...${toTag.name}`)

    // Fetch tag annotation if requested
    let tagAnnotation: string | null = null
    if (fetchTagAnnotations && toTag) {
      tagAnnotation = await provider.getTagAnnotation(toTag.name)
      if (tagAnnotation) {
        core.info(`ℹ️ Retrieved tag annotation for ${toTag.name}`)
        core.setOutput('tag_annotation', tagAnnotation)
      }
    }

    // Collect pull requests based on mode
    let pullRequests: PullRequestInfo[] = []

    if (modeInput === 'PR' || modeInput === 'HYBRID') {
      // Get PRs between dates
      const fromDate = fromTag.date || moment().subtract(365, 'days')
      const toDate = toTag.date || moment()
      
      const mergedPRs = await provider.getBetweenDates(owner, repo, fromDate, toDate, 200)
      pullRequests.push(...mergedPRs)

      if (includeOpen) {
        const openPRs = await provider.getOpen(owner, repo, 200)
        pullRequests.push(...openPRs)
      }
    }

    if (modeInput === 'COMMIT' || modeInput === 'HYBRID') {
      // Get commits and convert to PR-like structure
      const commits = await provider.getCommits(owner, repo, fromTag.name, toTag.name)
      
      // Convert commits to PR-like structure
      for (const commit of commits) {
        pullRequests.push({
          number: 0, // Commits don't have PR numbers
          title: commit.message.split('\n')[0],
          htmlURL: commit.htmlURL,
          baseBranch: '',
          branch: '',
          createdAt: commit.date,
          mergedAt: commit.date,
          mergeCommitSha: commit.sha,
          author: commit.author,
          authorName: commit.authorName,
          repoName: `${owner}/${repo}`,
          labels: [],
          milestone: '',
          body: commit.message,
          assignees: [],
          requestedReviewers: [],
          approvedReviewers: [],
          status: 'merged'
        })
      }
    }

    core.info(`ℹ️ Found ${pullRequests.length} items to include in changelog`)

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

    core.info('✅ Changelog generated successfully')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    core.setOutput('failed', 'true')
    
    const failOnError = core.getInput('failOnError') === 'true'
    if (failOnError) {
      core.setFailed(errorMessage)
    } else {
      core.error(errorMessage)
    }
  }
}

run()

