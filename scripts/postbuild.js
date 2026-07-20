#!/usr/bin/env node
/**
 * Post-build: ensure dist/cli.js has the shebang and is chmod +x on Unix.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const cliPath = path.join(__dirname, '..', 'dist', 'cli.js');
if (!fs.existsSync(cliPath)) {
  console.error('postbuild: dist/cli.js not found');
  process.exit(1);
}

let content = fs.readFileSync(cliPath, 'utf8');
if (!content.startsWith('#!/usr/bin/env node')) {
  content = '#!/usr/bin/env node\n' + content;
  fs.writeFileSync(cliPath, content, 'utf8');
}

// chmod +x on non-Windows
if (process.platform !== 'win32') {
  fs.chmodSync(cliPath, 0o755);
}

console.log('postbuild: dist/cli.js ready');
