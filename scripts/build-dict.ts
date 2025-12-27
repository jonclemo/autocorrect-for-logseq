/**
 * Dictionary Builder Script
 * 
 * This script builds the autocorrect dictionary from codespell sources.
 * 
 * Dictionary License: CC BY-SA 3.0 (see DICTIONARY_LICENSE.md)
 * Code License: MIT (see LICENSE)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

type Rules = Record<string, string>;

// UK English words that should NEVER be corrected (they are correct)
const UK_ENGLISH_WORDS = new Set([
  'colour', 'colours', 'coloured', 'colouring',
  'favour', 'favours', 'favoured', 'favouring', 'favourite', 'favourites',
  'behaviour', 'behaviours', 'behavioural',
  'honour', 'honours', 'honoured', 'honouring', 'honourable',
  'labour', 'labours', 'laboured', 'labouring', 'labourer', 'labourers',
  'organise', 'organises', 'organised', 'organising', 'organisation', 'organisations',
  'realise', 'realises', 'realised', 'realising', 'realisation', 'realisations',
  'recognise', 'recognises', 'recognised', 'recognising', 'recognition',
  'analyse', 'analyses', 'analysed', 'analysing', 'analysis',
  'centre', 'centres', 'centred', 'centring',
  'metre', 'metres',
  'theatre', 'theatres', 'theatrical',
  'defence', 'defences',
  'licence', 'licences', 'licenced', 'licencing',
  'practice', 'practise', 'practised', 'practising',
  'programme', 'programmes',
  'travelled', 'travelling', 'traveller', 'travellers',
  'cancelled', 'cancelling', 'cancellation',
]);

// Words that are too ambiguous to auto-correct (common valid words)
const AMBIGUOUS_WORDS = new Set([
  'from', 'form', 'for', 'far', 'fora',
  'to', 'too', 'two',
  'there', 'their', "they're",
  'its', "it's",
  'your', "you're",
  'were', "we're",
  'than', 'then',
  'affect', 'effect',
  'accept', 'except',
  'advice', 'advise',
  'loose', 'lose',
  'passed', 'past',
  'principal', 'principle',
  'stationary', 'stationery',
  'weather', 'whether',
  'who', 'whom',
  'which', 'witch',
]);

// Very common short typos that are safe to correct
const SAFE_SHORT_TYPOS: Record<string, string> = {
  'teh': 'the',
  'adn': 'and',
  'taht': 'that',
  'thsi': 'this',
  'woudl': 'would',
  'wolud': 'would',
  'coudl': 'could',
  'shoudl': 'should',
  'waht': 'what',
  'hwat': 'what',
};

const MIN_SAFE_LENGTH = 5; // Don't auto-correct words shorter than this unless in SAFE_SHORT_TYPOS

/**
 * Download a file from a URL
 */
function downloadFile(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        // Handle redirect
        return downloadFile(res.headers.location!).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download: ${res.statusCode}`));
        return;
      }
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

/**
 * Parse codespell dictionary format
 * Format: typo->correction or typo->correction1,correction2
 * Lines starting with # are comments
 */
function parseCodespellDictionary(content: string): Rules {
  const rules: Rules = {};
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Parse format: typo->correction or typo->correction1,correction2
    const match = trimmed.match(/^(.+?)->(.+)$/);
    if (!match) continue;

    const typo = match[1].trim().toLowerCase();
    const corrections = match[2].split(',').map(c => c.trim());

    // Skip if typo is a UK English word (never correct these)
    if (UK_ENGLISH_WORDS.has(typo)) continue;

    // For multiple corrections, prefer UK English if available
    let correction: string | null = null;
    for (const corr of corrections) {
      const corrLower = corr.toLowerCase();
      // Prefer UK English spellings
      if (UK_ENGLISH_WORDS.has(corrLower)) {
        correction = corrLower;
        break;
      }
      // If no UK preference, use first correction
      if (!correction) {
        correction = corrLower;
      }
    }

    if (!correction || correction === typo) continue;

    // Never convert UK -> US
    if (UK_ENGLISH_WORDS.has(typo) && !UK_ENGLISH_WORDS.has(correction)) {
      continue;
    }

    // Apply conservative filtering
    if (isSafeToInclude(typo, correction)) {
      rules[typo] = correction;
    }
  }

  return rules;
}

/**
 * Determine if a correction is safe to include in the dictionary
 */
function isSafeToInclude(typo: string, correction: string): boolean {
  // Never correct UK English words
  if (UK_ENGLISH_WORDS.has(typo)) return false;

  // Never correct ambiguous words
  if (AMBIGUOUS_WORDS.has(typo)) return false;
  if (AMBIGUOUS_WORDS.has(correction)) return false;

  // Allow safe short typos
  if (SAFE_SHORT_TYPOS[typo] === correction) return true;

  // For short words, be extra conservative
  if (typo.length < MIN_SAFE_LENGTH) {
    return false;
  }

  // Don't include if both are very common words (too ambiguous)
  if (typo.length < 6 && correction.length < 6) {
    // Additional check: if both are common dictionary words, skip
    // This is a heuristic - you might want to refine this
    return true; // For now, allow if typo is longer than MIN_SAFE_LENGTH
  }

  return true;
}

/**
 * Merge multiple dictionaries, with later ones overriding earlier ones
 */
function mergeDictionaries(dicts: Rules[]): Rules {
  const merged: Rules = {};
  for (const dict of dicts) {
    Object.assign(merged, dict);
  }
  return merged;
}

/**
 * Main function to build the dictionary
 */
async function main() {
  console.log('Building UK English autocorrect dictionary...\n');

  const dictionaries: Rules[] = [];

  // Option 1: Try to download codespell dictionaries
  const codespellUrls = [
    'https://raw.githubusercontent.com/codespell-project/codespell/master/codespell_lib/data/dictionary.txt',
    'https://raw.githubusercontent.com/codespell-project/codespell/master/codespell_lib/data/uk.txt',
  ];

  for (const url of codespellUrls) {
    try {
      console.log(`Downloading ${url}...`);
      const content = await downloadFile(url);
      const rules = parseCodespellDictionary(content);
      console.log(`  Parsed ${Object.keys(rules).length} rules`);
      dictionaries.push(rules);
    } catch (error) {
      console.log(`  Failed to download ${url}: ${error}`);
    }
  }

  // Option 2: Check for local dictionary files
  const localDictPaths = [
    path.join(process.cwd(), 'dictionaries', 'codespell.txt'),
    path.join(process.cwd(), 'dictionaries', 'codespell-uk.txt'),
  ];

  for (const dictPath of localDictPaths) {
    if (fs.existsSync(dictPath)) {
      try {
        console.log(`Reading local dictionary: ${dictPath}...`);
        const content = fs.readFileSync(dictPath, 'utf-8');
        const rules = parseCodespellDictionary(content);
        console.log(`  Parsed ${Object.keys(rules).length} rules`);
        dictionaries.push(rules);
      } catch (error) {
        console.log(`  Failed to read ${dictPath}: ${error}`);
      }
    }
  }

  // Add safe short typos
  console.log('Adding safe short typos...');
  dictionaries.push(SAFE_SHORT_TYPOS);
  console.log(`  Added ${Object.keys(SAFE_SHORT_TYPOS).length} safe short typos`);

  // Merge all dictionaries
  const merged = mergeDictionaries(dictionaries);

  // Sort by typo for easier reading
  const sorted: Rules = {};
  const sortedKeys = Object.keys(merged).sort();
  for (const key of sortedKeys) {
    sorted[key] = merged[key];
  }

  // Write to output file
  const outputPath = path.join(process.cwd(), 'src', 'dictionary', 'base_safe.json');
  fs.writeFileSync(outputPath, JSON.stringify(sorted, null, 2), 'utf-8');

  console.log(`\n✓ Dictionary built successfully!`);
  console.log(`  Total rules: ${Object.keys(sorted).length}`);
  console.log(`  Output: ${outputPath}`);
}

// Run if called directly
main().catch((error) => {
  console.error('Error building dictionary:', error);
  process.exit(1);
});

