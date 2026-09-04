import * as esbuild from 'esbuild';
import fs from 'fs';

await esbuild.build({
  entryPoints: ['src/content/dice.js', 'src/content/linkedin.js'],
  bundle: true,
  outdir: 'dist/content',
});
await fs.promises.cp('public', 'dist', {recursive: true});
