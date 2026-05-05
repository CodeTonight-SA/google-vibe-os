import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    exclude: ['electron/__tests__/**', 'node_modules/**']
  }
})
