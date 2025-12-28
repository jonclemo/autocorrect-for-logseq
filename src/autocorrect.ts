export type Rules = Record<string, string>;

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

const BOUNDARY_RE = /[\s.,;:!?()[\]{}"']/;
const MIN_SAFE_LENGTH = 5; // Don't auto-correct words shorter than this unless very clear

/**
 * Check if cursor is inside a code block (backticks)
 * Simple heuristic: count backticks before cursor (odd = inside code)
 */
function isInCodeBlock(text: string, cursorPos: number): boolean {
  const before = text.slice(0, cursorPos);
  const backtickCount = (before.match(/`/g) || []).length;
  return backtickCount % 2 === 1; // Odd number of backticks = inside code
}

/**
 * Check if word contains code-like characters (digits, underscores)
 * These are likely identifiers or code, not typos
 */
function isLikelyCode(word: string): boolean {
  return /\d/.test(word) || /_/.test(word);
}

export function shouldTrigger(lastInput: string): boolean {
  if (!lastInput) return false;
  return BOUNDARY_RE.test(lastInput.slice(-1));
}

/**
 * Check if a correction is safe to apply
 */
function isSafeToCorrect(word: string, correction: string): boolean {
  const wordLower = word.toLowerCase();
  const correctionLower = correction.toLowerCase();

  // Never correct UK English words
  if (UK_ENGLISH_WORDS.has(wordLower)) return false;

  // Never correct ambiguous words
  if (AMBIGUOUS_WORDS.has(wordLower)) return false;
  if (AMBIGUOUS_WORDS.has(correctionLower)) return false;

  // Allow safe short typos
  if (SAFE_SHORT_TYPOS[wordLower] === correctionLower) {
    return true;
  }

  // For short words, be extra conservative
  if (wordLower.length < MIN_SAFE_LENGTH) {
    return false;
  }

  return true;
}

/**
 * Preserve the original case of the word when applying correction
 */
function preserveCase(original: string, replacement: string): string {
  if (original === original.toUpperCase()) {
    return replacement.toUpperCase();
  }
  if (original[0] === original[0].toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

export function replaceWordBeforeCursor(
  text: string,
  cursorPos: number,
  rules: Rules | Map<string, string>
): { newText: string; newCursorPos: number } | null {
  // Skip corrections in code blocks
  if (isInCodeBlock(text, cursorPos)) {
    return null;
  }

  const left = text.slice(0, cursorPos);
  const right = text.slice(cursorPos);

  // Walk backward to boundary to find word start
  let i = left.length - 1;
  while (i >= 0 && !BOUNDARY_RE.test(left[i])) i--;
  const start = i + 1;
  const word = left.slice(start);
  if (!word) return null;

  // Skip words that look like code (contain digits or underscores)
  if (isLikelyCode(word)) {
    return null;
  }

  // Look up correction (case-insensitive)
  // Support both Map and object for backward compatibility
  const wordLower = word.toLowerCase();
  const replacement = rules instanceof Map ? rules.get(wordLower) : rules[wordLower];
  if (!replacement || replacement === wordLower) return null;

  // Apply safety checks
  if (!isSafeToCorrect(word, replacement)) return null;

  // Preserve original case
  const corrected = preserveCase(word, replacement);

  const newLeft = left.slice(0, start) + corrected;
  const newText = newLeft + right;
  const newCursorPos = cursorPos + (corrected.length - word.length);

  return { newText, newCursorPos };
}

export function parsePersonalRules(input: string): Rules {
  const rules: Rules = {};
  const trimmed = (input || "").trim();
  if (!trimmed) return rules;

  // Try to parse as JSON first (matches base_safe.json format)
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === "object" && parsed !== null) {
        // Convert all keys and values to lowercase for consistency
        for (const [key, value] of Object.entries(parsed)) {
          if (typeof key === "string" && typeof value === "string") {
            rules[key.toLowerCase()] = value.toLowerCase();
          }
        }
        return rules;
      }
    } catch (e) {
      // If JSON parsing fails, fall through to line-based format
    }
  }

  // Fall back to line-based format (space-separated: typo correction)
  for (const line of trimmed.split(/\r?\n/)) {
    const lineTrimmed = line.trim();
    if (!lineTrimmed || lineTrimmed.startsWith("#")) continue;
    const parts = lineTrimmed.split(/\s+/);
    if (parts.length < 2) continue;
    const typo = parts[0].toLowerCase();
    const correction = parts.slice(1).join(" ").toLowerCase();
    rules[typo] = correction;
  }
  return rules;
}
