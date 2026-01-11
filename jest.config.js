module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.test.ts', '!src/**/__tests__/**'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  // For E2E tests with real APIs, we need to handle ES modules in node_modules
  // @octokit/rest is ESM-only, so we need to tell Jest to ignore it during transformation
  // but allow it to be loaded at runtime
  transformIgnorePatterns: [
    'node_modules/(?!(@octokit|gitea-js)/)'
  ]
}
