/**
 * The Artifact host wraps the published page in its own <!doctype html><html><body>.
 * Handing it Vite's complete index.html therefore nests one document inside another.
 * This emits dist/artifact.html: just the stylesheet, the mount point and the module
 * script, with the asset hashes taken from the current build.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const html = readFileSync('dist/index.html', 'utf8');
const css = html.match(/href="([^"]+\.css)"/)?.[1];
const js = html.match(/src="([^"]+\.js)"/)?.[1];
if (!css || !js) throw new Error('could not find built asset references in dist/index.html');

writeFileSync(
  'dist/artifact.html',
  `<link rel="stylesheet" href="${css}">\n<div id="root"></div>\n<script type="module" src="${js}"></script>\n`,
);
console.log(`dist/artifact.html -> css ${css}, js ${js}`);
