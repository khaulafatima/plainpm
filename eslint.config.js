import antfu from '@antfu/eslint-config'

export default antfu({
  type: 'app',
  ignores: [
    '**/dist/**',
    '**/node_modules/**',
    '**/bruno/**',
    '**/skills/**',
    '**/examples/**',
    '**/doc/**',
    '**/docs/**',
    '**/.plainpm/**',
    '**/*.md',
  ],
})
