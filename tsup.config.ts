import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    cli: 'src/packages/plainpm-cli/cli.ts',
    index: 'src/index.ts',
  },
  format: ['esm'],
  target: 'node18',
  dts: true,
  clean: true,
  sourcemap: true,
  shims: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
})
