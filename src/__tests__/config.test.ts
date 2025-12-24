import {
  parseConfigurationJson,
  loadConfigurationFromFile,
  resolveConfiguration,
  DefaultConfiguration
} from '../config'
import * as fs from 'fs'
import * as path from 'path'

// Mock fs module
jest.mock('fs')
jest.mock('path')
jest.mock('@actions/core', () => ({
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn()
}))

describe('config', () => {
  const mockedFs = fs as jest.Mocked<typeof fs>
  const mockedPath = path as jest.Mocked<typeof path>

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('parseConfigurationJson', () => {
    it('should parse valid JSON configuration', () => {
      const configJson = JSON.stringify({
        template: '# Custom Template',
        categories: [
          {title: '## Custom', labels: ['custom']}
        ]
      })

      const result = parseConfigurationJson(configJson)
      expect(result).not.toBeNull()
      expect(result?.template).toBe('# Custom Template')
      expect(result?.categories).toHaveLength(1)
      expect(result?.categories?.[0]?.title).toBe('## Custom')
    })

    it('should merge with defaults for missing fields', () => {
      const configJson = JSON.stringify({
        template: '# Custom Template'
      })

      const result = parseConfigurationJson(configJson)
      expect(result).not.toBeNull()
      expect(result?.template).toBe('# Custom Template')
      expect(result?.pr_template).toBe(DefaultConfiguration.pr_template)
      expect(result?.categories).toEqual(DefaultConfiguration.categories)
    })

    it('should return null for invalid JSON', () => {
      const result = parseConfigurationJson('invalid json')
      expect(result).toBeNull()
    })

    it('should return null for empty string', () => {
      const result = parseConfigurationJson('')
      expect(result).toBeNull()
    })
  })

  describe('loadConfigurationFromFile', () => {
    it('should load configuration from valid file', () => {
      const repositoryPath = '/tmp/repo'
      const configPath = 'config.json'
      const fullPath = '/tmp/repo/config.json'
      const configContent = JSON.stringify({
        template: '# File Template',
        categories: [{title: '## From File', labels: ['file']}]
      })

      mockedPath.resolve.mockReturnValue(fullPath)
      mockedFs.existsSync.mockReturnValue(true)
      mockedFs.readFileSync.mockReturnValue(configContent)

      const result = loadConfigurationFromFile(repositoryPath, configPath)
      expect(result).not.toBeNull()
      expect(result?.template).toBe('# File Template')
      expect(mockedFs.readFileSync).toHaveBeenCalledWith(fullPath, 'utf8')
    })

    it('should return null if file does not exist', () => {
      const repositoryPath = '/tmp/repo'
      const configPath = 'nonexistent.json'
      const fullPath = '/tmp/repo/nonexistent.json'

      mockedPath.resolve.mockReturnValue(fullPath)
      mockedFs.existsSync.mockReturnValue(false)

      const result = loadConfigurationFromFile(repositoryPath, configPath)
      expect(result).toBeNull()
      expect(mockedFs.readFileSync).not.toHaveBeenCalled()
    })

    it('should return null for invalid JSON in file', () => {
      const repositoryPath = '/tmp/repo'
      const configPath = 'invalid.json'
      const fullPath = '/tmp/repo/invalid.json'

      mockedPath.resolve.mockReturnValue(fullPath)
      mockedFs.existsSync.mockReturnValue(true)
      mockedFs.readFileSync.mockReturnValue('invalid json')

      const result = loadConfigurationFromFile(repositoryPath, configPath)
      expect(result).toBeNull()
    })
  })

  describe('resolveConfiguration', () => {
    it('should prefer configurationJson over configFile', () => {
      const configJson = JSON.stringify({template: '# JSON Template'})
      const repositoryPath = '/tmp/repo'

      const result = resolveConfiguration(repositoryPath, configJson, 'config.json')
      expect(result.template).toBe('# JSON Template')
      expect(mockedFs.existsSync).not.toHaveBeenCalled()
    })

    it('should use configFile if configurationJson is not provided', () => {
      const repositoryPath = '/tmp/repo'
      const configPath = 'config.json'
      const fullPath = '/tmp/repo/config.json'
      const configContent = JSON.stringify({template: '# File Template'})

      mockedPath.resolve.mockReturnValue(fullPath)
      mockedFs.existsSync.mockReturnValue(true)
      mockedFs.readFileSync.mockReturnValue(configContent)

      const result = resolveConfiguration(repositoryPath, undefined, configPath)
      expect(result.template).toBe('# File Template')
    })

    it('should use defaults if neither configJson nor configFile provided', () => {
      const repositoryPath = '/tmp/repo'

      const result = resolveConfiguration(repositoryPath)
      expect(result).toEqual(DefaultConfiguration)
    })

    it('should fall back to configFile if configurationJson is invalid', () => {
      const repositoryPath = '/tmp/repo'
      const configPath = 'config.json'
      const fullPath = '/tmp/repo/config.json'
      const configContent = JSON.stringify({template: '# File Template'})

      mockedPath.resolve.mockReturnValue(fullPath)
      mockedFs.existsSync.mockReturnValue(true)
      mockedFs.readFileSync.mockReturnValue(configContent)

      const result = resolveConfiguration(repositoryPath, 'invalid json', configPath)
      expect(result.template).toBe('# File Template')
    })
  })
})

