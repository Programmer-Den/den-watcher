// Lists the files of a build in its service worker (sw.js), which keeps them when it is installed,
// so the installed app opens while the hub cannot be reached. Runs after each build, with the
// build's folder: node scripts/precache.mjs <folder>
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Files the page never asks for. */
const skipped = /^(sw\.js|3rdpartylicenses\.txt)$|\.map$/;
const line = /^const BUILD = .*;$/m;

/** Puts the build's files and a version that changes with any of them into its sw.js. */
export function precache(folder) {
  const names = readdirSync(folder, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(folder, join(entry.parentPath, entry.name)).split(sep).join('/'))
    .filter((name) => !skipped.test(name))
    .sort();
  const hash = createHash('sha256');
  for (const name of names) {
    hash.update(`${name}\0`);
    hash.update(readFileSync(join(folder, name)));
  }
  const build = {
    version: hash.digest('hex').slice(0, 16),
    // The page is kept as the page's own address, which is what the browser opens.
    files: names.map((name) => (name === 'index.html' ? '' : name)),
  };
  const worker = join(folder, 'sw.js');
  const source = readFileSync(worker, 'utf8');
  if (!line.test(source)) {
    throw new Error(`${worker} has no line "const BUILD = ...;" to list the files in`);
  }
  writeFileSync(worker, source.replace(line, () => `const BUILD = ${JSON.stringify(build)};`));
  return build;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const folder = process.argv[2];
  if (!folder) {
    console.error('Usage: node scripts/precache.mjs <folder of the build>');
    process.exit(1);
  }
  const build = precache(folder);
  console.log(`Listed ${build.files.length} files in ${join(folder, 'sw.js')} (${build.version})`);
}
