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
  // Playwright specs: `npx playwright test` owns e2e/ (playwright.config.ts testDir).
  // tests/e2e/ holds two more Playwright specs that no runner currently executes.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/e2e/', '<rootDir>/tests/e2e/'],
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

// ESM-only packages that jest must transform. next/jest ignores all of
// node_modules, so `import` statements in these crashed 6 suites at parse time:
// @react-pdf/renderer (via src/lib/export.ts) and remark (via src/lib/blog.ts).
const ESM_PACKAGES = [
  '@react-pdf', 'yoga-layout',
  'remark', 'remark-.*', 'unified', 'bail', 'is-plain-obj', 'trough', 'vfile.*', 'unist-.*',
  'mdast-.*', 'micromark.*', 'decode-named-character-reference', 'character-entities.*',
  'hast-.*', 'html-void-elements', 'property-information', 'space-separated-tokens',
  'comma-separated-tokens', 'zwitch', 'stringify-entities', 'ccount', 'longest-streak',
  'devlop', 'trim-lines', 'markdown-table', 'escape-string-regexp', 'web-namespaces',
  '@ungap', 'emoticon', 'extend',
]

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = async () => {
  const config = await createJestConfig(customJestConfig)()
  // next/jest's first pattern ignores every node_modules package except its own
  // transpile list; re-open it for the ESM packages above.
  config.transformIgnorePatterns[0] = `/node_modules/(?!.pnpm)(?!(geist|${ESM_PACKAGES.join('|')})/)`
  return config
}
