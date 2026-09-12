/**
 * Fails the build if any server-reachable module uses an extensionless
 * relative import.
 *
 * Vercel runs api/ as native Node ESM, where "./riskEngine" is not a
 * resolvable specifier — only "./riskEngine.js" is. Vite and tsc both accept
 * the extensionless form, so a broken import passes every local check and
 * then kills the serverless function on cold start: the API answers every
 * route with a 500 while the static site looks perfectly healthy.
 *
 * That is exactly how the whole /api/* surface went down once. This walks the
 * real import graph from the serverless entry point and refuses to let it
 * happen silently again.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';

const ENTRY_POINTS = ['api/index.ts'];
const IMPORT_RE = /(?:from|import)\s*\(?\s*['"](\.[^'"]*)['"]/g;

const resolve = (spec, fromDir) => {
  const base = normalize(join(fromDir, spec.endsWith('.js') ? spec.slice(0, -3) : spec));
  for (const cand of [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    if (existsSync(cand)) return cand;
  }
  return null;
};

const seen = new Set();
const problems = [];
const queue = [...ENTRY_POINTS];

while (queue.length) {
  const file = queue.pop();
  if (seen.has(file) || !existsSync(file)) continue;
  seen.add(file);

  const source = readFileSync(file, 'utf8');
  for (const [, spec] of source.matchAll(IMPORT_RE)) {
    const target = resolve(spec, dirname(file));
    // A specifier pointing at a directory needs /index.js, not just .js.
    if (!spec.endsWith('.js')) problems.push({ file, spec });
    if (target) queue.push(target);
  }
}

if (problems.length) {
  console.error(
    `\n${problems.length} extensionless relative import(s) reachable from the serverless entry point.` +
      `\nNode ESM cannot resolve these, so the deployed API would 500 on every route:\n`
  );
  for (const { file, spec } of problems) console.error(`  ${file}  →  "${spec}"`);
  console.error('\nAdd the explicit extension (a directory needs "/index.js").\n');
  process.exit(1);
}

console.log(`ESM imports OK — ${seen.size} server-reachable modules checked.`);
