import { join } from 'node:path';
import { defineConfig } from 'vitest/config';

const defaultExclude = ['node_modules', 'dist', '.umi'];

const shardedSuites = [
  ...[
    'rental-estates',
    'rental-contacts',
    'rental-viewing-list',
    'rental-houses',
    'rental-house-filters',
    'rental-viewing-workflows',
    'rental-leases',
  ].map((name) => ({
    name,
    file: 'src/pages/rental/__tests__/domain-list-pages.test.tsx',
  })),
  ...[
    'house-detail-inline',
    'house-detail-overview',
    'house-detail-workflows',
    'house-detail-routing',
  ].map((name) => ({
    name,
    file: 'src/pages/rental/houses/__tests__/detail.test.tsx',
  })),
  ...['house-new-core', 'house-new-actions'].map((name) => ({
    name,
    file: 'src/pages/rental/houses/__tests__/new.test.tsx',
  })),
  ...['notification-scopes', 'notification-validation'].map((name) => ({
    name,
    file: 'src/pages/platform-management/notification-dispatches/index.test.tsx',
  })),
];

const shardedFiles = [...new Set(shardedSuites.map(({ file }) => file))];
const resolveAlias = {
  '@': join(__dirname, 'src'),
  '@root': join(__dirname),
  '@@': join(__dirname, 'src', '.umi'),
};

export default defineConfig({
  resolve: {
    alias: resolveAlias,
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./tests/setupTests.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: defaultExclude,
    maxWorkers: 10,
    projects: [
      {
        extends: true,
        test: {
          name: 'main',
          exclude: [...defaultExclude, ...shardedFiles],
        },
      },
      ...shardedSuites.map(({ file, name }) => ({
        define: {
          __TEST_SUITE_SHARD__: JSON.stringify(name),
        },
        resolve: {
          alias: resolveAlias,
        },
        test: {
          name,
          environment: 'happy-dom',
          globals: true,
          setupFiles: ['./tests/setupTests.ts'],
          include: [file],
          exclude: defaultExclude,
          passWithNoTests: true,
          testTimeout: 15000,
        },
      })),
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/.umi/**',
        'src/services/ant-design-pro/**',
        'src/**/*.d.ts',
        'src/**/index.style.ts',
      ],
    },
    passWithNoTests: true,
    testTimeout: 15000,
  },
});
