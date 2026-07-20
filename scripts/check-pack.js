#!/usr/bin/env node
/**
 * Validates that `npm pack --dry-run` output contains the expected files.
 * Run via: npm run pack:check
 */
'use strict';

const { execSync } = require('child_process');
const path = require('path');

const REQUIRED = [
  'package.json',
  'README.md',
  'LICENSE',
  'CHANGELOG.md',
  'dist/cli.js',
  'dist/cli.d.ts',
];

console.log('\n🔍 Checking tarball contents…\n');

let output;
try {
  output = execSync('npm pack --dry-run --json 2>&1', {
    encoding: 'utf8',
    cwd: path.join(__dirname, '..'),
  });
} catch (err) {
  // npm pack --dry-run --json writes to stdout; ignore non-zero exit
  output = /** @type {Error & {stdout?: string}} */ (err).stdout ?? String(err);
}

let packData;
try {
  // npm pack --dry-run --json outputs a JSON array
  const jsonStart = output.indexOf('[');
  packData = JSON.parse(jsonStart >= 0 ? output.slice(jsonStart) : output);
} catch {
  // Fallback: parse plain text output
  packData = null;
}

const listedFiles = packData
  ? packData.flatMap((p) => (p.files ?? []).map((f) => f.path))
  : output.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('npm notice'));

let allOk = true;
for (const required of REQUIRED) {
  const found = packData
    ? listedFiles.some((f) => f === required || f.endsWith(required))
    : output.includes(required);

  if (found) {
    console.log(`  ✔  ${required}`);
  } else {
    console.error(`  ✖  MISSING: ${required}`);
    allOk = false;
  }
}

// Check no dev files are included
const FORBIDDEN = ['node_modules', 'tests/', 'src/', '.eslintrc', 'tsconfig', 'vitest.config'];
for (const forbidden of FORBIDDEN) {
  const found = output.includes(forbidden);
  if (found) {
    console.warn(`  ⚠  Unexpected: ${forbidden}`);
  }
}

console.log('');
if (allOk) {
  console.log('✅ Pack check passed!\n');
} else {
  console.error('❌ Pack check FAILED — some required files are missing.\n');
  process.exit(1);
}
