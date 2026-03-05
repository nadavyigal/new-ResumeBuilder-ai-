import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^server-only$': '<rootDir>/tests/__mocks__/server-only.ts',
  },
  // Skip heavy suites requiring live services (e2e/contract/integration) for unit runs
  testPathIgnorePatterns: [
    '<rootDir>/tests/e2e/',
    '<rootDir>/tests/contract/',
    '<rootDir>/tests/integration/',
    '<rootDir>/tests/performance/',
  ],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  setupFiles: ['<rootDir>/tests/__mocks__/setup.ts'],
  testTimeout: 60000,
};

export default config;
