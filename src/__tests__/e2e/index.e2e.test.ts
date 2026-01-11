/**
 * E2E Tests for release-changelog-builder-action
 *
 * These tests run against real GitHub/Gitea APIs to verify the full action flow.
 * They gracefully skip if test repositories/tokens are not configured.
 */

import * as core from '@actions/core'
import {run} from '../../index'

// Mock @actions/core to capture outputs
jest.mock('@actions/core', () => ({
  getBooleanInput: jest.fn((name: string) => name === 'verbose'),
  getInput: jest.fn((name: string) => {
    // Return empty strings for inputs not provided
    return ''
  }),
  setOutput: jest.fn(),
  setFailed: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  setSecret: jest.fn(),
}))

// Mock @actions/github
jest.mock('@actions/github', () => ({
  context: {
    repo: {
      owner: 'test-owner',
      repo: 'test-repo',
    },
    ref: 'refs/tags/v1.0.0',
  },
}))

describe('E2E Tests', () => {
  const originalEnv = process.env
  const mockGetInput = core.getInput as jest.Mock
  const mockSetOutput = core.setOutput as jest.Mock
  const mockSetFailed = core.setFailed as jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = {...originalEnv}
    mockGetInput.mockImplementation((name: string) => {
      if (name === 'verbose') return 'false'
      if (name === 'mode') return 'PR'
      return ''
    })
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('GitHub E2E Tests', () => {
    const testRepo = process.env.TEST_GITHUB_REPO || 'LiquidLogicLabs/git-action-release-changelog-builder'
    const githubToken = process.env.GITHUB_TOKEN || process.env.TEST_GITHUB_TOKEN

    if (!githubToken) {
      it.skip('skipped - TEST_GITHUB_TOKEN or GITHUB_TOKEN not set', () => {})
      return
    }

    it('should generate changelog from GitHub repository', async () => {
      const [owner, repo] = testRepo.split('/')
      process.env.GITHUB_REPOSITORY = testRepo
      process.env.GITHUB_TOKEN = githubToken

      mockGetInput.mockImplementation((name: string) => {
        if (name === 'token') return githubToken || ''
        if (name === 'owner') return owner
        if (name === 'repo') return repo
        if (name === 'mode') return 'PR'
        if (name === 'fromTag') return 'v0.1.0'
        if (name === 'toTag') return 'v0.1.1'
        if (name === 'verbose') return 'false'
        return ''
      })

      await run()

      expect(mockSetFailed).not.toHaveBeenCalled()
      expect(mockSetOutput).toHaveBeenCalledWith('failed', 'false')
      expect(mockSetOutput).toHaveBeenCalledWith(
        'changelog',
        expect.stringContaining('#')
      )
    }, 30000)

    it('should handle missing tags gracefully', async () => {
      const [owner, repo] = testRepo.split('/')
      process.env.GITHUB_REPOSITORY = testRepo
      process.env.GITHUB_TOKEN = githubToken

      mockGetInput.mockImplementation((name: string) => {
        if (name === 'token') return githubToken || ''
        if (name === 'owner') return owner
        if (name === 'repo') return repo
        if (name === 'mode') return 'PR'
        if (name === 'fromTag') return 'v999.999.999' // Non-existent tag
        if (name === 'toTag') return 'v999.999.999' // Non-existent tag
        if (name === 'verbose') return 'false'
        return ''
      })

      await run()

      // Should complete without error (may have empty changelog)
      expect(mockSetFailed).not.toHaveBeenCalled()
      expect(mockSetOutput).toHaveBeenCalled()
    }, 30000)
  })

  describe('Gitea E2E Tests', () => {
    const testRepo = process.env.TEST_GITEA_REPO || ''
    const giteaToken = process.env.GITEA_TOKEN || process.env.TEST_GITEA_TOKEN
    const giteaUrl = process.env.TEST_GITEA_URL || ''

    if (!testRepo || !giteaToken || !giteaUrl) {
      it.skip('skipped - TEST_GITEA_REPO, TEST_GITEA_TOKEN, or TEST_GITEA_URL not set', () => {})
      return
    }

    it('should generate changelog from Gitea repository', async () => {
      const [owner, repo] = testRepo.split('/')
      process.env.GITEA_REPOSITORY = testRepo
      process.env.GITEA_TOKEN = giteaToken
      process.env.GITEA_SERVER_URL = giteaUrl

      mockGetInput.mockImplementation((name: string) => {
        if (name === 'token') return giteaToken || ''
        if (name === 'platform') return 'gitea'
        if (name === 'repo') return repo
        if (name === 'mode') return 'PR'
        if (name === 'fromTag') return 'v1.0.0'
        if (name === 'toTag') return 'v1.1.0'
        if (name === 'verbose') return 'false'
        return ''
      })

      await run()

      expect(mockSetFailed).not.toHaveBeenCalled()
      expect(mockSetOutput).toHaveBeenCalledWith('failed', 'false')
      expect(mockSetOutput).toHaveBeenCalledWith(
        'changelog',
        expect.any(String)
      )
    }, 30000)
  })
})
