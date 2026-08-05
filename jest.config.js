const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  // Avoid scanning nested duplicate project trees to prevent haste collisions.
  // `.claude/worktrees/` holds live git worktrees checked out INSIDE the repo, so
  // without this jest collects a second, older copy of the whole suite and reports
  // its failures as if they were this tree's. Measured 2026-08-05: 148 suites /
  // 869 tests with it, 74 / 435 without — exactly half the run was a stale clone,
  // contributing 80 of 156 failures.
  modulePathIgnorePatterns: [
    '<rootDir>/resume-builder-ai/',
    '<rootDir>/.claude/worktrees/',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: [
    '**/__tests__/**/*.test.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/types/**/*',
  ],
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)
