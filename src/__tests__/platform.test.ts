import {detectPlatform, getApiBaseUrl} from '../platform'

describe('platform detection', () => {
  const originalEnv = process.env

  beforeEach(() => {
    // Clear all platform-related environment variables to ensure clean test state
    const cleanedEnv = { ...originalEnv }
    delete cleanedEnv.GITHUB_SERVER_URL
    delete cleanedEnv.GITHUB_REPOSITORY
    delete cleanedEnv.GITHUB_API_URL
    delete cleanedEnv.GITHUB_ACTIONS
    delete cleanedEnv.GITHUB_TOKEN
    delete cleanedEnv.GITEA_SERVER_URL
    delete cleanedEnv.GITEA_REPOSITORY
    delete cleanedEnv.GITEA_TOKEN
    delete cleanedEnv.GITHUB_WORKSPACE
    delete cleanedEnv.GITEA_WORKSPACE
    process.env = cleanedEnv
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should detect GitHub from GITHUB_SERVER_URL', async () => {
    process.env = {
      ...process.env,
      GITHUB_SERVER_URL: 'https://github.com'
    }
    const platform = await detectPlatform()
    expect(platform).toBe('github')
  })

  it('should detect Gitea from GITEA_SERVER_URL', async () => {
    process.env = {
      ...process.env,
      GITEA_SERVER_URL: 'https://gitea.com'
    }
    const platform = await detectPlatform()
    expect(platform).toBe('gitea')
  })

  it('should use explicit platform input', async () => {
    const platform = await detectPlatform('gitea')
    expect(platform).toBe('gitea')
  })

  it('should default to GitHub if nothing detected', async () => {
    // Ensure all platform env vars are cleared
    process.env = {}
    const platform = await detectPlatform()
    expect(platform).toBe('github')
  })

  it('should get correct API base URL for GitHub', () => {
    const url = getApiBaseUrl('github')
    expect(url).toBe('https://api.github.com')
  })

  it('should get correct API base URL for Gitea', () => {
    const url = getApiBaseUrl('gitea')
    expect(url).toBe('https://gitea.com')
  })
})

