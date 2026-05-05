import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        include: ['electron/__tests__/**/*.test.mjs'],
        setupFiles: ['./electron/__tests__/setup.mjs'],
        testTimeout: 10000,
    },
})
