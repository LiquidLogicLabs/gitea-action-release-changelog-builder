import * as core from '@actions/core'
import * as fs from 'fs'
import * as path from 'path'
import {Configuration, Category} from './types'

/**
 * Default configuration
 */
export const DefaultConfiguration: Configuration = {
  template: '#{{CHANGELOG}}',
  pr_template: '- #{{TITLE}}\n   - PR: ##{{NUMBER}}',
  commit_template: '- #{{TITLE}}',
  empty_template: '- no changes',
  categories: [
    {
      title: '## 🚀 Features',
      labels: ['feature']
    },
    {
      title: '## 🐛 Bug Fixes',
      labels: ['bug', 'fix']
    },
    {
      title: '## 📝 Documentation',
      labels: ['documentation', 'docs']
    },
    {
      title: '## 🔧 Maintenance',
      labels: ['maintenance', 'chore']
    }
  ],
  ignore_labels: [],
  trim_values: true,
  defaultCategory: '## Other Changes'
}

/**
 * Parse configuration from JSON string
 */
export function parseConfigurationJson(configJson: string): Configuration | null {
  try {
    const config = JSON.parse(configJson)
    return mergeWithDefaults(config)
  } catch (error) {
    core.error(`Failed to parse configuration JSON: ${error}`)
    return null
  }
}

/**
 * Load configuration from file
 */
export function loadConfigurationFromFile(repositoryPath: string, configPath: string): Configuration | null {
  try {
    const fullPath = path.resolve(repositoryPath, configPath)
    
    if (!fs.existsSync(fullPath)) {
      core.warning(`Configuration file not found: ${fullPath}`)
      return null
    }

    const fileContent = fs.readFileSync(fullPath, 'utf8')
    const config = JSON.parse(fileContent)
    return mergeWithDefaults(config)
  } catch (error) {
    core.error(`Failed to load configuration from file: ${error}`)
    return null
  }
}

/**
 * Merge user configuration with defaults
 */
function mergeWithDefaults(userConfig: Partial<Configuration>): Configuration {
  return {
    template: userConfig.template ?? DefaultConfiguration.template,
    pr_template: userConfig.pr_template ?? DefaultConfiguration.pr_template,
    commit_template: userConfig.commit_template ?? DefaultConfiguration.commit_template,
    empty_template: userConfig.empty_template ?? DefaultConfiguration.empty_template,
    categories: userConfig.categories ?? DefaultConfiguration.categories,
    ignore_labels: userConfig.ignore_labels ?? DefaultConfiguration.ignore_labels,
    trim_values: userConfig.trim_values ?? DefaultConfiguration.trim_values,
    defaultCategory: userConfig.defaultCategory ?? DefaultConfiguration.defaultCategory
  }
}

/**
 * Resolve configuration from input (JSON string or file path)
 */
export function resolveConfiguration(
  repositoryPath: string,
  configJson?: string,
  configFile?: string
): Configuration {
  // Prefer JSON string over file
  if (configJson) {
    const config = parseConfigurationJson(configJson)
    if (config) {
      core.info('ℹ️ Using configuration from configurationJson input')
      return config
    }
  }

  // Try file path
  if (configFile) {
    const config = loadConfigurationFromFile(repositoryPath, configFile)
    if (config) {
      core.info('ℹ️ Using configuration from configuration file')
      return config
    }
  }

  // Use defaults
  core.info('ℹ️ No configuration provided, using defaults')
  return DefaultConfiguration
}

