# Autocorrect for Logseq - Technical Documentation

## Overview

A Logseq plugin that provides conservative UK English autocorrect functionality using a hybrid approach combining DOM event listeners with adaptive polling fallback for maximum reliability. The plugin corrects typos in real-time as users type, with a focus on avoiding false positives.

## Architecture

### Event Handling Strategy

The plugin uses a **hybrid two-tier system** for detecting and correcting typos:

#### 1. Primary: DOM Event Listeners (Real-time)
- Listens directly to `keydown` events on the editor element
- Captures space and Enter key presses (word boundaries)
- Provides immediate correction feedback
- Bound to both specific editor element and document level (fallback)
- Uses multiple selectors to find the editor element
- Handles editor remounts by rebinding listeners

#### 2. Secondary: Adaptive Polling (Fallback)
- Polls every 500ms when actively editing, 3000ms when idle
- Catches corrections missed by DOM events
- Detects editor remounts and rebinds DOM listeners
- Ensures corrections work even if DOM events fail
- Automatically adjusts polling speed based on editing activity

**Why Hybrid Approach?**
- Logseq API events (`onInputSelectionEnd`, `onKeyDown`) were unreliable
- DOM events provide immediate feedback but may not fire in all scenarios
- Polling ensures reliability but has inherent delay
- Combined approach provides both speed and reliability

### Dictionary Management

#### Source
- Uses `codespell` dictionaries (`dictionary.txt` + `uk.txt`) from GitHub
- Script (`scripts/build-dict.ts`) downloads and filters dictionaries
- Applies conservative filtering to avoid false positives

#### Filtering Rules
- **UK English Protection**: Words like "colour", "favour", "organise" are never corrected
- **Ambiguous Words Excluded**: Common valid words like "from", "form", "to", "too", "two" are excluded
- **Minimum Length**: Words shorter than 5 characters are excluded unless in safe short typos list
- **Safe Short Typos**: Common typos like "teh" → "the", "adn" → "and" are allowed

#### Processing
- Generates `base_safe.json` (~63,768 rules)
- Dictionary is inlined as TypeScript module (`base_safe.ts`) to avoid JSON import issues in Logseq's environment
- Lazy-loaded on first use to avoid blocking startup
- Loaded asynchronously in background after plugin initialization
- Cached in memory after first load

#### Remote Dictionary Support
- Optional remote dictionary updates via URL
- Cached with ETag support for efficient updates
- Configurable update interval (default: 24 hours)

### Autocorrect Logic

#### Trigger Detection
- Detects word boundaries: space, punctuation (`.`, `,`, `;`, `:`, `!`, `?`, `(`, `)`, `[`, `]`, `{`, `}`, `"`, `'`)
- Only processes when character at cursor position (or before it) is a boundary character
- Uses regex: `BOUNDARY_RE = /[\s.,;:!?()[\]{}"'`]/`

#### Word Replacement
- Function: `replaceWordBeforeCursor(text, cursorPos, rules)`
- Walks backward from cursor position to find word start
- Extracts word before boundary
- Looks up correction in dictionary (case-insensitive, using `Map<string, string>` for fast lookups)
- Applies safety checks via `isSafeToCorrect()`:
  - UK English words protected
  - Ambiguous words excluded
  - Minimum word length (5 chars) unless in safe short typos list
  - Code blocks skipped (detected by backtick counting)
  - Code-like words skipped (contain digits or underscores)
- Preserves original capitalization via `preserveCase()`
- Updates block content and restores cursor position (only if position changed)

#### Cursor Position Handling
- When cursor is after boundary (e.g., after space), uses `pos - 1` to check word before boundary
- This ensures we check the word that just ended, not an empty string
- Handles mid-text editing correctly

### State Management

#### Variables
- `baseSafe`: Base dictionary rules (loaded from codespell)
- `remote`: Remote dictionary rules (optional, cached)
- `cachedRules`: `Map<string, string>` of all merged rules (base + remote + personal)
- `lastContent`: Last known block content (for change detection)
- `lastBlockUuid`: Last edited block UUID (for block change detection)
- `lastCorrectedBlockUuid`: UUID of last corrected block (for suppression)
- `lastCorrectedContentHash`: Hash of last corrected content (for suppression)

#### Suppression Mechanism
- **Content-Based Suppression**: Tracks last corrected block UUID + content hash
- Prevents re-processing the same correction
- Uses simple hash function: `${content.length}:${content.slice(0, 10)}:${content.slice(-10)}`
- More reliable than time-based suppression for preventing duplicate corrections

#### Rules Caching
- Dictionary loaded asynchronously to avoid blocking startup
- Rules rebuilt only when:
  - Base dictionary loads
  - Remote rules update
  - Personal rules change (via `onSettingsChanged`)
- Cached rules used for all corrections (no rebuild on each check)
- Rules stored as `Map<string, string>` for O(1) lookup performance

### Performance Optimizations

#### API Call Optimization
- Reordered calls to check cheapest operations first:
  1. `checkEditing()` (lightweight check)
  2. `getEditingBlockContent()` (content retrieval)
  3. `getCursorPos()` (cursor position)
  4. `getCurrentBlock()` (block metadata - most expensive)
- Block UUID caching: Only fetch when block changes or first time
- Content change detection: Skips processing if content unchanged

#### Adaptive Polling
- Fast mode: 500ms when actively editing
- Slow mode: 3000ms when idle
- Automatically switches based on editing activity
- Reduces unnecessary API calls when not editing

#### Cursor Restoration Optimization
- Only calls `restoreEditingCursor()` if replacement length differs from original word
- Prevents unnecessary cursor movements

### Build System

#### Bundling
- Uses `esbuild` to bundle TypeScript into single IIFE (Immediately Invoked Function Expression)
- Browser-compatible format
- Externalizes `@logseq/libs` (provided by Logseq environment)
- Dictionary inlined as TypeScript module (~2.2MB bundle)

#### Build Process
1. `prebuild`: Inline dictionary (JSON → TypeScript module via `scripts/inline-dict.ts`)
2. `build:esbuild`: Bundle all code into `dist/index.js`
3. `copy-files`: Copy `logseq.json`, `package.json`, `README.md`, and `assets/` to `dist/`

#### Output
- `dist/index.js`: Bundled plugin (~2.2MB including dictionary)
- `dist/logseq.json`: Plugin manifest
- `dist/package.json`: Package metadata (adjusted for dist folder)
- `dist/README.md`: User documentation
- `dist/assets/`: Icon and GIF files

### Settings & Configuration

#### User Settings
- `enabled`: Enable/disable autocorrect (default: `true`)
- `mode`: "safe" or "expanded" (default: "safe", currently unused)
- `remoteEnabled`: Enable remote dictionary updates (default: `false`)
- `remoteUrl`: URL for remote dictionary (default: `""`)
- `checkIntervalHours`: Remote update interval (default: `24`)
- `personalRules`: Custom rules (supports both JSON and line-based formats)
- `debug`: Enable debug logging (default: `false`)

#### Personal Rules Format

**JSON Format (Preferred)**:
```json
{"typo": "correction", "another": "fix"}
```

**Line-Based Format (Legacy)**:
```
typo correction
another fix
```

Multiple JSON rules must be inside curly braces `{}` and separated by commas.

### Code Structure

```
src/
├── index.ts          # Main plugin entry, DOM listeners, polling logic, event handlers
├── autocorrect.ts    # Core autocorrect logic (word replacement, safety checks, case preservation)
├── remote.ts         # Remote dictionary loading and caching
└── dictionary/
    ├── base_safe.json    # Generated dictionary (63,768 rules)
    └── base_safe.ts      # Inlined TypeScript module version

scripts/
├── build-dict.ts     # Downloads and processes codespell dictionaries
├── inline-dict.ts    # Converts JSON dictionary to TypeScript module
└── copy-files.js     # Copies files to dist folder during build
```

## Event Flow

```
User types "teh " (space)
  ↓
DOM keydown event fires (or polling detects change)
  ↓
handleDOMKeyDown() / slowPollingCheck() called
  ↓
processAutocorrect() checks:
  - Enabled?
  - Suppressed? (content-based check)
  - Trigger char? (space/Enter)
  - Word in dictionary?
  - Safe to correct?
  ↓
If correction found:
  - markCorrection() (sets block UUID + content hash)
  - updateBlock() with corrected text
  - restoreEditingCursor() (only if position changed)
```

## Known Issues & Limitations

### 1. Dictionary Coverage
- **Issue**: Not all typos are in the dictionary
- **Examples**: "wemty", "abot", "aability", "wepob" (not found in codespell)
- **Impact**: Low - expected behavior for conservative dictionary
- **Solution**: Users can add personal rules in settings

### 2. Suppression Window
- **Current**: Content-based suppression (block UUID + content hash)
- **Potential Issue**: Very rapid typing might trigger duplicate checks
- **Impact**: Very low - content-based approach is more reliable than time-based
- **Mitigation**: Hash-based deduplication prevents most duplicate processing

### 3. DOM Event Reliability
- **Issue**: DOM events may not fire in all scenarios (editor remounts, iframe issues)
- **Mitigation**: Polling fallback ensures corrections still work
- **Status**: Working well in testing, polling catches edge cases

### 4. Performance
- **Startup**: Dictionary loading deferred to avoid blocking
- **Runtime**: DOM events are lightweight, polling is adaptive
- **Memory**: ~2.2MB bundle (includes inlined dictionary)
- **Status**: Acceptable performance, no user complaints

### 5. Logseq API Limitations
- **Issue**: `onInputSelectionEnd` and `onKeyDown` were unreliable
- **Solution**: Direct DOM event listeners bypass Logseq API limitations
- **Status**: DOM approach works better than Logseq API events

### 6. Code Block Detection
- **Current**: Simple heuristic (backtick counting)
- **Limitation**: May not detect all code block formats
- **Impact**: Low - most code blocks are detected correctly

## Testing Status

### Working Corrections
- ✅ "teh" → "the"
- ✅ "wonce" → "once"
- ✅ "wierd" → "weird"
- ✅ "wepon" → "weapon"
- ✅ "wieght" → "weight"
- ✅ "wdith" → "width"
- ✅ Consecutive corrections work correctly
- ✅ Case preservation works (Teh → The, TEH → THE)
- ✅ UK English words protected (colour, favour, etc.)
- ✅ Ambiguous words excluded (from, form, to, too, two)

### Not in Dictionary (Expected)
- ❌ "wemty" (not a known typo)
- ❌ "abot" (not a known typo)
- ❌ "aability" (not a known typo)
- ❌ "wepob" (not a known typo)

### Plugin Functionality
- ✅ Plugin loads successfully
- ✅ Dictionary loads (63,768 rules)
- ✅ DOM events detect text changes
- ✅ Polling fallback works
- ✅ Word boundary detection works
- ✅ Autocorrect replaces words correctly
- ✅ Cursor position preserved
- ✅ Settings changes trigger rule rebuild
- ✅ Personal rules work (both formats)
- ✅ Command palette: "Autocorrect: Reload rules"

## Future Improvements (Potential)

1. **Word Context Awareness**: Check surrounding words to avoid false positives
2. **User Learning**: Track user corrections to improve dictionary
3. **Performance**: Further reduce bundle size (dictionary compression?)
4. **UI Feedback**: Visual indicator when correction happens
5. **Undo Support**: Better integration with Logseq's undo system
6. **Multi-language**: Support for other languages beyond UK English
7. **Expanded Mode**: Implement less conservative corrections for users who want more aggressive autocorrect

## Code Quality

### Strengths
- ✅ Type-safe (TypeScript)
- ✅ Error handling (try-catch blocks)
- ✅ Fallback mechanisms (polling + DOM)
- ✅ Performance optimized (caching, adaptive polling)
- ✅ Conservative corrections (safety checks)
- ✅ Debug logging toggle
- ✅ Content-based suppression (reliable deduplication)

### Areas for Improvement
- Could reduce logging verbosity further
- Could add unit tests for autocorrect logic
- Could add integration tests for Logseq plugin
- Could document API more thoroughly
- Could improve code block detection

## Conclusion

The plugin is **production-ready** and working well. The hybrid DOM + polling approach provides reliable corrections with good performance. The content-based suppression allows consecutive corrections to work properly, and the conservative dictionary approach avoids false positives.

The main limitation is dictionary coverage (some typos aren't in codespell), but this is expected and can be addressed with personal rules. The plugin successfully provides real-time autocorrect functionality while maintaining a conservative approach to avoid false positives.

