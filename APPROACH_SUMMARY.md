# Autocorrect for Logseq - Technical Approach Summary

## Overview
A Logseq plugin that provides real-time autocorrect functionality using a polling-based approach to detect and correct typos as the user types.

## Architecture

### 1. **Dictionary Management**
- **Source**: Uses `codespell` dictionaries (dictionary.txt + uk.txt) from GitHub
- **Processing**: 
  - Script (`scripts/build-dict.ts`) downloads and filters dictionaries
  - Applies conservative filtering (UK English protection, ambiguous word exclusion, minimum length)
  - Generates `base_safe.json` (~63,769 rules)
- **Loading**: 
  - Dictionary is inlined as TypeScript module (`base_safe.ts`) to avoid JSON import issues
  - Lazy-loaded on first use to avoid blocking startup
  - Loaded asynchronously in background after plugin initialization
  - Cached in memory after first load

### 2. **Event Handling Strategy**

**Attempted Approaches (None Worked)**:
- `logseq.Editor.onInputSelectionEnd` - Registered but never fires
- `logseq.Editor.onInputTextChanged` - Does not exist in Logseq API
- `logseq.App.onKeyDown` - Registered but never fires

**Current Solution: Polling**
- `setInterval` polling every 300ms
- Checks if user is editing
- Compares current content with last known content
- Triggers autocorrect when word boundary detected (space, punctuation)

### 3. **Autocorrect Logic**

**Trigger Detection**:
- Detects word boundaries: space, punctuation (`.`, `,`, `;`, `:`, `!`, `?`, `(`, `)`, `[`, `]`, `{`, `}`, `"`, `'`)
- Only processes when last character is a boundary character

**Word Replacement**:
- Function: `replaceWordBeforeCursor(text, cursorPos, rules)`
- Walks backward from cursor position to find word start
- Extracts word before boundary
- Looks up correction in dictionary (case-insensitive)
- Applies safety checks:
  - UK English words protected (colour, favour, etc.)
  - Ambiguous words excluded (from/form, etc.)
  - Minimum word length (5 chars) unless in safe short typos list
- Preserves original capitalization
- Updates block content and restores cursor position

**Cursor Position Handling**:
- When cursor is after boundary (e.g., after space), uses `pos - 1` to check word before boundary
- This ensures we check the word that just ended, not an empty string

### 4. **State Management**

**Variables**:
- `base`: Base dictionary rules (loaded from codespell)
- `remote`: Remote dictionary rules (optional, cached)
- `lastContent`: Last known block content (for change detection)
- `lastBlockUuid`: Last edited block UUID (for block change detection)
- `suppressNext`: Flag to prevent infinite loops when updating block

**Suppression Mechanism**:
- When block is updated, sets `suppressNext = true`
- Next poll cycle skips processing
- Prevents re-processing the correction we just made

### 5. **Performance Considerations**

**Current Implementation**:
- Polling runs every 300ms regardless of activity
- Checks `checkEditing()` on every poll
- Fetches block content on every poll when editing
- Dictionary loaded once and cached
- Rules built on-demand (merged base + remote + personal)

**Potential Issues**:
1. **Constant Polling**: Runs every 300ms even when not editing
2. **API Calls**: Multiple Logseq API calls per poll (`checkEditing`, `getCurrentBlock`, `getEditingBlockContent`, `getCursorPos`)
3. **Content Comparison**: String comparison on every change detection
4. **No Debouncing**: Processes immediately on boundary detection (could be optimized)

### 6. **Build System**

**Bundling**:
- Uses `esbuild` to bundle TypeScript into single IIFE (Immediately Invoked Function Expression)
- Browser-compatible format
- Externalizes `@logseq/libs` (provided by Logseq environment)
- Dictionary inlined as TypeScript module (2.1MB bundle)

**Build Process**:
1. `prebuild`: Inline dictionary JSON → TypeScript module
2. `build:esbuild`: Bundle all code into `dist/index.js`
3. `copy-files`: Copy `logseq.json` to dist

### 7. **Settings & Configuration**

**User Settings**:
- `enabled`: Enable/disable autocorrect
- `mode`: safe/expanded (currently unused)
- `remoteEnabled`: Enable remote dictionary updates
- `remoteUrl`: URL for remote dictionary
- `checkIntervalHours`: Remote update interval
- `personalRules`: Custom rules (one per line: typo correction)

## Current Limitations

1. **No Event-Based Triggering**: Relies entirely on polling (300ms interval)
2. **Performance**: Constant polling even when idle
3. **Delay**: Up to 300ms delay before correction (polling interval)
4. **API Overhead**: Multiple API calls per poll cycle
5. **No Debouncing**: Could process multiple times for rapid typing

## Potential Improvements

1. **Optimize Polling**:
   - Only poll when actually editing (check once, then poll)
   - Increase interval when idle
   - Stop polling when not editing

2. **Debouncing**:
   - Wait for typing to pause before processing
   - Reduce unnecessary processing

3. **Caching**:
   - Cache `checkEditing()` result
   - Cache block UUID/content to reduce API calls

4. **Event-Based Fallback**:
   - Keep trying to use events if Logseq API adds support
   - Use events as primary, polling as fallback

5. **Performance Monitoring**:
   - Track processing time
   - Log slow operations

6. **Dictionary Optimization**:
   - Consider splitting dictionary into chunks
   - Load only common words initially, lazy-load rest

## Code Structure

```
src/
├── index.ts          # Main plugin entry, polling logic, event handlers
├── autocorrect.ts    # Core autocorrect logic (word replacement, safety checks)
├── remote.ts         # Remote dictionary loading and caching
└── dictionary/
    ├── base_safe.json    # Generated dictionary (63,769 rules)
    └── base_safe.ts      # Inlined TypeScript module version

scripts/
├── build-dict.ts     # Downloads and processes codespell dictionaries
└── inline-dict.ts    # Converts JSON dictionary to TypeScript module
```

## Testing Status

✅ Plugin loads successfully
✅ Dictionary loads (63,769 rules)
✅ Polling detects text changes
✅ Word boundary detection works
✅ Autocorrect replaces words correctly
✅ Cursor position preserved
❌ Event handlers don't fire (onInputSelectionEnd, onKeyDown)
✅ Polling fallback works reliably

