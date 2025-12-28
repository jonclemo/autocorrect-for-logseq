const fs = require('fs');
const path = require('path');

// Copy logseq.json to dist folder
const logseqSource = path.join(__dirname, '..', 'logseq.json');
const logseqDest = path.join(__dirname, '..', 'dist', 'logseq.json');

if (fs.existsSync(logseqSource)) {
  fs.copyFileSync(logseqSource, logseqDest);
  console.log('✓ Copied logseq.json to dist/');
} else {
  console.error('✗ logseq.json not found in root directory');
  process.exit(1);
}

// Copy package.json to dist folder (for icon and metadata)
// But adjust the main field since we're in dist folder
const packageSource = path.join(__dirname, '..', 'package.json');
const packageDest = path.join(__dirname, '..', 'dist', 'package.json');

if (fs.existsSync(packageSource)) {
  const packageContent = JSON.parse(fs.readFileSync(packageSource, 'utf8'));
  // Adjust main field for dist folder (should be relative to dist)
  if (packageContent.main && packageContent.main.startsWith('dist/')) {
    packageContent.main = packageContent.main.replace('dist/', '');
  }
  // Ensure icon path is correct for dist folder
  if (packageContent.icon) {
    packageContent.icon = packageContent.icon.replace(/^\.\//, '');
  }
  if (packageContent.logseq && packageContent.logseq.icon) {
    packageContent.logseq.icon = packageContent.logseq.icon.replace(/^\.\//, '');
  }
  // Add readme field pointing to README.md (relative to dist folder)
  packageContent.readme = 'README.md';
  fs.writeFileSync(packageDest, JSON.stringify(packageContent, null, 2));
  console.log('✓ Copied package.json to dist/ (adjusted for dist folder)');
} else {
  console.warn('⚠ package.json not found in root directory (optional)');
}

// Copy assets folder to dist
const assetsSource = path.join(__dirname, '..', 'assets');
const assetsDest = path.join(__dirname, '..', 'dist', 'assets');

if (fs.existsSync(assetsSource)) {
  // Create dist/assets directory if it doesn't exist
  if (!fs.existsSync(assetsDest)) {
    fs.mkdirSync(assetsDest, { recursive: true });
  }
  
  // Copy all files from assets to dist/assets
  const files = fs.readdirSync(assetsSource);
  files.forEach(file => {
    const sourceFile = path.join(assetsSource, file);
    const destFile = path.join(assetsDest, file);
    if (fs.statSync(sourceFile).isFile()) {
      fs.copyFileSync(sourceFile, destFile);
    }
  });
  console.log('✓ Copied assets to dist/');
}

// Copy README.md to dist folder
const readmeSource = path.join(__dirname, '..', 'README.md');
const readmeDest = path.join(__dirname, '..', 'dist', 'README.md');

if (fs.existsSync(readmeSource)) {
  fs.copyFileSync(readmeSource, readmeDest);
  console.log('✓ Copied README.md to dist/');
} else {
  console.warn('⚠ README.md not found in root directory (optional)');
}

