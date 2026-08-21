import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Espelha o `paths` do tsconfig: sem isto, todo import de valor via `@/`
  // resolve no type-check mas quebra em teste.
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
