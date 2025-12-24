import {detectPlatform, getApiBaseUrl} from '../platform'

describe('platform detection', () => {
  const originalEnv = process.env

  afterEach(() => {
    process.env = originalEnv
  })

  it('should detect GitHub from GITHUB_SERVER_URL', () => {
    process.env = {
      ...originalEnv,
      GITHUB_SERVER_URL: 'https://github.com'
    }
    const platform = detectPlatform()
    expect(platform).toBe('github')
  })

  it('should detect Gitea from GITEA_SERVER_URL', () => {
    process.env = {
      ...originalEnv,
      GITEA_SERVER_URL: 'https://gitea.com'
    }
    const platform = detectPlatform()
    expect(platform).toBe('gitea')
  })

  it('should use explicit platform input', () => {
    const platform = detectPlatform('gitea')
    expect(platform).toBe('gitea')
  })

  it('should default to GitHub if nothing detected', () => {
    process.env = {}
    const platform = detectPlatform()
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

  it('should use custom baseUrl if provided', () => {
    const url = getApiBaseUrl('github', 'https://github.example.com/api/v3')
    expect(url).toBe('https://github.example.com/api/v3')
  })
})

