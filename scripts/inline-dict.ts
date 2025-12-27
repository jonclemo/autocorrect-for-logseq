/**
 * Script to inline dictionary as TypeScript module
 * This avoids JSON import issues in Logseq
 */

import * as fs from 'fs';
import * as path from 'path';

const dictPath = path.join(__dirname, '..', 'src', 'dictionary', 'base_safe.json');
const outputPath = path.join(__dirname, '..', 'src', 'dictionary', 'base_safe.ts');

const dict = JSON.parse(fs.readFileSync(dictPath, 'utf-8'));

const content = `// Auto-generated file - do not edit manually
// Generated from base_safe.json

import type { Rules } from '../autocorrect';

export const baseSafe: Rules = ${JSON.stringify(dict, null, 2)} as Rules;
`;

fs.writeFileSync(outputPath, content, 'utf-8');
console.log('✓ Inlined dictionary as TypeScript module');

