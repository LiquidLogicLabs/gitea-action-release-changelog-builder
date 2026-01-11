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
  // Exclude E2E Jest suite (E2E now runs via workflow using the built action)
  testPathIgnorePatterns: ['__tests__/e2e/'],
  // For E2E tests with real APIs, we need to handle ES modules in node_modules
  // @octokit/* packages are ESM-only, so we need to tell Jest to NOT transform them
  // transformIgnorePatterns: patterns that MATCH are NOT transformed
  // Using separate patterns for each package (simpler and more reliable)
  transformIgnorePatterns: [
    'node_modules/@octokit',
    'node_modules/gitea-js'
  ]
}
