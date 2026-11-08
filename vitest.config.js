import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    pool: process.platform === 'win32' ? 'threads' : 'forks',
    include: ['tests/**/*.test.js'],
    environment: 'node',
  }
});
