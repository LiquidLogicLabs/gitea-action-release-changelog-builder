import {detectOwnerRepo} from '../context'
import {Logger} from '../logger'
import * as core from '@actions/core'

// Mock @actions/core
jest.mock('@actions/core', () => ({
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}))

// Mock @actions/github
const mockContext: {repo?: {owner: string; repo: string}} = {
  repo: {
    owner: 'context-owner',
    repo: 'context-repo',
  },
}

jest.mock('@actions/github', () => ({
  get context() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return mockContext as any
  },
  __esModule: true,
}))

describe('detectOwnerRepo', () => {
  const originalEnv = process.env
  let logger: Logger

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = {...originalEnv}
    logger = new Logger(false)
    // Reset github.context mock
    mockContext.repo = {
      owner: 'context-owner',
      repo: 'context-repo',
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('with inputs provided', () => {
    it('should use provided owner and repo', async () => {
      const result = await detectOwnerRepo('input-owner', 'input-repo', 'github', logger)
      expect(result).toEqual({owner: 'input-owner', repo: 'input-repo'})
      expect(core.debug).not.toHaveBeenCalled()
    })
  })

  describe('GITHUB_REPOSITORY environment variable', () => {
    it('should detect owner/repo from GITHUB_REPOSITORY when inputs not provided', async () => {
      process.env.GITHUB_REPOSITORY = 'env-owner/env-repo'

      const result = await detectOwnerRepo(undefined, undefined, 'github', logger)

      expect(result).toEqual({owner: 'env-owner', repo: 'env-repo'})
      expect(core.debug).toHaveBeenCalledWith(
        'Using owner/repo from GITHUB_REPOSITORY: env-owner/env-repo'
      )
    })

    it('should prefer input owner/repo over GITHUB_REPOSITORY', async () => {
      process.env.GITHUB_REPOSITORY = 'env-owner/env-repo'

      const result = await detectOwnerRepo('input-owner', 'input-repo', 'github', logger)

      expect(result).toEqual({owner: 'input-owner', repo: 'input-repo'})
      expect(core.debug).not.toHaveBeenCalled()
    })

    it('should work for Gitea platform with GITHUB_REPOSITORY', async () => {
      process.env.GITHUB_REPOSITORY = 'gitea-owner/gitea-repo'

      const result = await detectOwnerRepo(undefined, undefined, 'gitea', logger)

      expect(result).toEqual({owner: 'gitea-owner', repo: 'gitea-repo'})
      expect(core.debug).toHaveBeenCalledWith(
        'Using owner/repo from GITHUB_REPOSITORY: gitea-owner/gitea-repo'
      )
    })

    it('should handle invalid GITHUB_REPOSITORY format', async () => {
      process.env.GITHUB_REPOSITORY = 'invalid-format'
      mockContext.repo = {
        owner: 'context-owner',
        repo: 'context-repo',
      }

      const result = await detectOwnerRepo(undefined, undefined, 'github', logger)

      // Should fall back to github.context
      expect(result).toEqual({owner: 'context-owner', repo: 'context-repo'})
    })
  })

  describe('GITEA_REPOSITORY environment variable', () => {
    it('should detect owner/repo from GITEA_REPOSITORY for Gitea platform', async () => {
      process.env.GITEA_REPOSITORY = 'gitea-owner/gitea-repo'

      const result = await detectOwnerRepo(undefined, undefined, 'gitea', logger)

      expect(result).toEqual({owner: 'gitea-owner', repo: 'gitea-repo'})
      expect(core.debug).toHaveBeenCalledWith(
        'Using owner/repo from GITEA_REPOSITORY: gitea-owner/gitea-repo'
      )
    })

    it('should prefer GITHUB_REPOSITORY over GITEA_REPOSITORY', async () => {
      process.env.GITHUB_REPOSITORY = 'github-owner/github-repo'
      process.env.GITEA_REPOSITORY = 'gitea-owner/gitea-repo'

      const result = await detectOwnerRepo(undefined, undefined, 'gitea', logger)

      expect(result).toEqual({owner: 'github-owner', repo: 'github-repo'})
      expect(core.debug).toHaveBeenCalledWith(
        'Using owner/repo from GITHUB_REPOSITORY: github-owner/github-repo'
      )
    })

    it('should not use GITEA_REPOSITORY for GitHub platform', async () => {
      delete process.env.GITHUB_REPOSITORY
      process.env.GITEA_REPOSITORY = 'gitea-owner/gitea-repo'
      mockContext.repo = {
        owner: 'context-owner',
        repo: 'context-repo',
      }

      const result = await detectOwnerRepo(undefined, undefined, 'github', logger)

      // Should use github.context instead
      expect(result).toEqual({owner: 'context-owner', repo: 'context-repo'})
    })
  })

  describe('github.context fallback', () => {
    it('should use github.context when GITHUB_REPOSITORY not set for GitHub platform', async () => {
      delete process.env.GITHUB_REPOSITORY
      mockContext.repo = {
        owner: 'context-owner',
        repo: 'context-repo',
      }

      const result = await detectOwnerRepo(undefined, undefined, 'github', logger)

      expect(result).toEqual({owner: 'context-owner', repo: 'context-repo'})
      expect(core.debug).toHaveBeenCalledWith(
        'Using owner/repo from github.context: context-owner/context-repo'
      )
    })

    it('should handle github.context errors gracefully', async () => {
      delete process.env.GITHUB_REPOSITORY
      delete mockContext.repo

      await expect(detectOwnerRepo(undefined, undefined, 'github', logger)).rejects.toThrow('Owner and repo are required')
    })

    it('should not use github.context for Gitea platform', async () => {
      delete process.env.GITHUB_REPOSITORY
      delete process.env.GITEA_REPOSITORY
      mockContext.repo = {
        owner: 'context-owner',
        repo: 'context-repo',
      }

      await expect(detectOwnerRepo(undefined, undefined, 'gitea', logger)).rejects.toThrow('Owner and repo are required')
    })
  })

  describe('error handling', () => {
    it('should throw error when owner/repo cannot be detected', async () => {
      delete process.env.GITHUB_REPOSITORY
      delete process.env.GITEA_REPOSITORY
      delete mockContext.repo

      await expect(detectOwnerRepo(undefined, undefined, 'github', logger)).rejects.toThrow('Owner and repo are required')

      expect(core.debug).toHaveBeenCalledWith(
        expect.stringContaining('Environment info:')
      )
    })

    it('should include environment info in error message', async () => {
      delete process.env.GITHUB_REPOSITORY
      delete process.env.GITEA_REPOSITORY
      delete mockContext.repo

      try {
        await detectOwnerRepo(undefined, undefined, 'github', logger)
        expect(true).toBe(false) // Should have thrown error
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        expect(errorMessage).toContain('GITHUB_REPOSITORY=not set')
        expect(errorMessage).toContain('Platform=github')
        expect(errorMessage).toContain('Owner input=not provided')
        expect(errorMessage).toContain('Repo input=not provided')
      }
    })
  })
})
