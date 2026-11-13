// Converts the single-file Vite build into an Artifact page body (the Artifact host adds doctype/html/head/body).
import { readFileSync, writeFileSync } from 'node:fs';
const html = readFileSync('dist/index.html', 'utf8');
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1]
  .replace(/<meta charset[^>]*>/i, '')
  .replace(/<meta name="viewport"[^>]*>/i, '');
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
const title = head.match(/<title>[\s\S]*?<\/title>/)[0];
const rest = head.replace(title, '');
writeFileSync('dist/miftah-app.html', `${title}\n${rest.trim()}\n${body.trim()}\n`);
console.log('wrote dist/miftah-app.html', (readFileSync('dist/miftah-app.html').length / 1024).toFixed(0) + ' KB');
