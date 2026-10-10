import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    cli: 'src/index.ts',
  },
  format: ['esm'],
  target: 'node18',
  dts: false,
  clean: true,
  sourcemap: true,
  shims: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
})
