// Bundles src/index.js into dist/index.js: a single ES2017 IIFE, the form
// Gopeed's goja engine runs. The bundle is committed so Gopeed can install the
// extension straight from the git repository.
import * as esbuild from 'esbuild';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

await esbuild.build({
  absWorkingDir: dirname(fileURLToPath(import.meta.url)),
  entryPoints: ['src/index.js'],
  bundle: true,
  format: 'iife',
  target: 'es2017',
  platform: 'neutral',
  minify: false,
  legalComments: 'none',
  outfile: 'dist/index.js',
  logLevel: 'info',
});
