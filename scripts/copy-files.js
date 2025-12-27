const fs = require('fs');
const path = require('path');

// Copy logseq.json to dist folder
const source = path.join(__dirname, '..', 'logseq.json');
const dest = path.join(__dirname, '..', 'dist', 'logseq.json');

if (fs.existsSync(source)) {
  fs.copyFileSync(source, dest);
  console.log('✓ Copied logseq.json to dist/');
} else {
  console.error('✗ logseq.json not found in root directory');
  process.exit(1);
}

