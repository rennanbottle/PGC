// Testes das regras puras (sem navegador, sem banco, sem IA).
// Os testes de tela e de fluxo no navegador entram nas próximas etapas.
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['shared/**/*.test.js', 'server/**/*.test.js'],
    environment: 'node',
  },
})
