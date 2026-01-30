import { Configuration } from './types';
/**
 * Default configuration
 */
export declare const DefaultConfiguration: Configuration;
/**
 * Parse configuration from JSON string
 */
export declare function parseConfigurationJson(configJson: string): Configuration | null;
/**
 * Load configuration from file
 */
export declare function loadConfigurationFromFile(repositoryPath: string, configPath: string): Configuration | null;
/**
 * Resolve configuration from input (JSON string or file path)
 */
export declare function resolveConfiguration(repositoryPath: string, configJson?: string, configFile?: string): Configuration;
