import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['electron/__tests__/**/*.test.{js,mjs}'],
    globals: true
  }
})
