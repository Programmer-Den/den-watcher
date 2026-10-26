import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';

import { precache } from './precache.mjs';

let folder;

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), 'precache-'));
  mkdirSync(join(folder, 'flags'));
  const files = {
    'index.html': '<app-root></app-root>',
    'main-AB12CD34.js': 'main',
    'main-AB12CD34.js.map': '{}',
    'flags/de.svg': '<svg></svg>',
    '3rdpartylicenses.txt': 'MIT',
    'sw.js': "'use strict';\nconst BUILD = { version: '', files: [''] };\nconst scope = 1;\n",
  };
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(folder, name), content);
  }
});

afterEach(() => rmSync(folder, { recursive: true, force: true }));

test('lists the files the page asks for in the service worker', () => {
  const build = precache(folder);

  assert.deepEqual(build.files, ['flags/de.svg', '', 'main-AB12CD34.js']);
  assert.match(build.version, /^[0-9a-f]{16}$/);
  const worker = readFileSync(join(folder, 'sw.js'), 'utf8');
  assert.ok(worker.includes(`const BUILD = ${JSON.stringify(build)};\nconst scope = 1;`));
});

test('gives a new version when any file changes', () => {
  const first = precache(folder).version;
  writeFileSync(join(folder, 'sw.js'), "const BUILD = { version: '', files: [''] };\n");
  assert.equal(precache(folder).version, first);

  writeFileSync(join(folder, 'flags/de.svg'), '<svg><path /></svg>');
  assert.notEqual(precache(folder).version, first);
});

test('fails on a service worker without the line to list the files in', () => {
  writeFileSync(join(folder, 'sw.js'), "'use strict';\n");

  assert.throws(() => precache(folder), /no line "const BUILD = \.\.\.;"/);
});
