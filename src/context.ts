import * as github from '@actions/github'
import * as exec from '@actions/exec'
import * as path from 'path'
import {ProviderPlatform} from './types'
import {Logger} from './logger'

export interface OwnerRepo {
  owner: string
  repo: string
}

/**
 * Detect owner and repo from various sources (inputs, environment variables, context)
 */
export async function detectOwnerRepo(
  ownerInput: string | undefined,
  repoInput: string | undefined,
  platform: ProviderPlatform,
  logger: Logger
): Promise<OwnerRepo> {
  let owner = ownerInput
  let repo = repoInput

  if (!owner || !repo) {
    // GITHUB_REPOSITORY is available in both GitHub and Gitea Actions (format: "owner/repo")
    const githubRepo = process.env.GITHUB_REPOSITORY
    if (githubRepo) {
      const parts = githubRepo.split('/')
      if (parts.length === 2) {
        owner = ownerInput || parts[0]
        repo = repoInput || parts[1]
        logger.debug(`Using owner/repo from GITHUB_REPOSITORY: ${owner}/${repo}`)
      }
    }

    // Fallback: Try GITEA_REPOSITORY for Gitea (if not already set)
    if ((!owner || !repo) && platform === 'gitea') {
      const giteaRepo = process.env.GITEA_REPOSITORY
      if (giteaRepo) {
        const parts = giteaRepo.split('/')
        if (parts.length === 2) {
          owner = ownerInput || parts[0]
          repo = repoInput || parts[1]
          logger.debug(`Using owner/repo from GITEA_REPOSITORY: ${owner}/${repo}`)
        }
      }
    }

    // Fallback: Try github.context for GitHub (if not already set)
    if ((!owner || !repo) && platform === 'github') {
      try {
        if (github.context && github.context.repo) {
          owner = ownerInput || github.context.repo.owner
          repo = repoInput || github.context.repo.repo
          logger.debug(`Using owner/repo from github.context: ${owner}/${repo}`)
        }
      } catch (error) {
        logger.debug(`Failed to get owner/repo from github.context: ${error}`)
      }
    }

    // For local/git platforms, try to get owner/repo from git config or repository path
    if ((!owner || !repo) && (platform === 'local' || platform === 'git')) {
      try {
        // Try to get from git config remote.origin.url
        let gitRemoteUrl = ''
        try {
          let output = ''
          await exec.exec(
            'git',
            ['config', '--get', 'remote.origin.url'],
            {
              cwd: process.env.GITHUB_WORKSPACE || process.env.GITEA_WORKSPACE || process.cwd(),
              silent: true,
              listeners: {
                stdout: (data: Buffer) => {
                  output += data.toString()
                }
              }
            }
          )
          gitRemoteUrl = output.trim()
        } catch {
          // Git config not available, continue with fallback
        }

        // Parse owner/repo from git remote URL (format: git@github.com:owner/repo.git or https://github.com/owner/repo.git)
        if (gitRemoteUrl) {
          const match = gitRemoteUrl.match(/(?:git@|https?:\/\/)(?:[\w.-]+@)?([\w.-]+)[\/:]([\w.-]+)\/([\w.-]+)(?:\.git)?/)
          if (match && match[2] && match[3]) {
            owner = ownerInput || match[2]
            repo = repoInput || match[3].replace(/\.git$/, '')
            logger.debug(`Using owner/repo from git remote.origin.url: ${owner}/${repo}`)
          }
        }

        // Fallback: Use repository path directory name as repo name
        if ((!owner || !repo) && (process.env.GITHUB_WORKSPACE || process.env.GITEA_WORKSPACE)) {
          const workspace = process.env.GITHUB_WORKSPACE || process.env.GITEA_WORKSPACE || ''
          const workspaceName = path.basename(workspace)
          if (workspaceName) {
            repo = repoInput || workspaceName
            owner = ownerInput || 'local'
            logger.debug(`Using owner/repo from workspace path: ${owner}/${repo}`)
          }
        }
      } catch (error) {
        logger.debug(`Failed to get owner/repo from git config: ${error}`)
      }
    }
  }

  if (!owner || !repo) {
    const envInfo = [
      `GITHUB_REPOSITORY=${process.env.GITHUB_REPOSITORY || 'not set'}`,
      `GITEA_REPOSITORY=${process.env.GITEA_REPOSITORY || 'not set'}`,
      `Platform=${platform}`,
      `Owner input=${ownerInput || 'not provided'}`,
      `Repo input=${repoInput || 'not provided'}`
    ].join(', ')
    logger.debug(`Environment info: ${envInfo}`)
    throw new Error(
      `Owner and repo are required. Provide via inputs or ensure running in a GitHub/Gitea Actions environment. (${envInfo})`
    )
  }

  return {owner, repo}
}
