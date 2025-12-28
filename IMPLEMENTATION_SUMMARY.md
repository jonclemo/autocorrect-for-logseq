# Autocorrect for Logseq - Implementation Summary

## Overview
A Logseq plugin that provides conservative UK English autocorrect functionality, using a hybrid approach combining DOM event listeners with adaptive polling fallback for maximum reliability.

## Current Architecture

### Hybrid Event Handling Approach
The plugin uses a **two-tier system** for detecting and correcting typos:

1. **Primary: DOM Event Listeners** (Real-time)
   - Listens directly to `keydown` events on the editor element
   - Captures space and Enter key presses (word boundaries)
   - Provides immediate correction feedback
   - Bound to both specific editor element and document level (fallback)

2. **Secondary: Adaptive Polling** (Fallback)
   - Polls every 500ms when actively editing, 3000ms when idle
   - Catches corrections missed by DOM events
   - Detects editor remounts and rebinds DOM listeners
   - Ensures corrections work even if DOM events fail

### Key Components

#### 1. Time-Based Suppression
- **Previous**: Count-based suppression (`suppressCount += 2`) blocked consecutive corrections
- **Current**: Time-based suppression (150ms window) allows rapid consecutive corrections
- **Implementation**: `lastCorrectionTime` timestamp checked against `SUPPRESSION_MS` constant
- **Result**: Prevents race conditions while allowing multiple corrections in quick succession

#### 2. Shared Autocorrect Logic
- Extracted `processAutocorrect()` function used by both DOM and polling handlers
- Ensures consistent behavior across all correction paths
- Centralized validation and rule lookup

#### 3. Rules Caching
- Dictionary loaded asynchronously to avoid blocking startup
- Rules rebuilt only when:
  - Base dictionary loads
  - Remote rules update
  - Personal rules change
- Cached rules used for all corrections (no rebuild on each check)

#### 4. Performance Optimizations
- **Block UUID caching**: Reduces `getCurrentBlock()` calls
- **Content change detection**: Skips processing if content unchanged
- **API call ordering**: Cheapest checks first (`checkEditing()` → `getEditingBlockContent()` → `getCursorPos()` → `getCurrentBlock()`)
- **Adaptive polling**: Fast when editing, slow when idle

## Recent Changes

### Phase 1: Critical Performance Fixes
1. **Rules Caching**: Implemented `cachedRules` rebuilt only on dictionary/remote/settings changes
2. **API Call Optimization**: Reordered calls to check cheapest operations first
3. **Suppression Counter**: Replaced boolean `suppressNext` with `suppressCount` counter for async safety

### Phase 2: Block UUID Caching
- Cache `lastBlockUuid` to avoid repeated `getCurrentBlock()` calls
- Only fetch block UUID when block changes or first time

### Phase 3: Cursor Position Fix
- Fixed character check to use `content[pos - 1]` instead of `content.slice(-1)`
- Handles mid-text editing correctly

### Phase 4: DOM Event Implementation
1. **DOM Event Listeners**:
   - `bindEditorListeners()`: Finds editor using multiple selectors
   - `handleDOMKeyDown()`: Processes corrections on space/Enter
   - Document-level listener as additional fallback

2. **Hybrid Approach**:
   - DOM events for immediate feedback
   - Polling as slow fallback (500ms active, 3000ms idle)
   - Polling also handles editor remount detection

3. **Time-Based Suppression**:
   - Replaced count-based suppression with 150ms time window
   - Allows consecutive corrections to work properly

## Technical Details

### Dictionary Management
- **Source**: codespell dictionaries (dictionary.txt + uk.txt)
- **Filtering**: Conservative approach excludes:
  - UK English words (e.g., "colour", "realise")
  - Ambiguous corrections (e.g., "from" → "form")
  - Short words (< 4 chars) except safe typos
- **Size**: ~63,768 rules
- **Format**: Inlined as TypeScript module to avoid JSON import issues

### Autocorrect Logic
- **Word Boundary Detection**: Uses regex `BOUNDARY_RE = /[\s.,;:!?()[\]{}"'`]/`
- **Case Preservation**: Maintains original capitalization
- **Safety Checks**: `isSafeToCorrect()` filters out risky corrections
- **Trigger Characters**: Space and Enter (word boundaries)

### Event Flow
```
User types "teh " (space)
  ↓
DOM keydown event fires
  ↓
handleDOMKeyDown() called (deferred with setTimeout)
  ↓
processAutocorrect() checks:
  - Enabled?
  - Suppressed? (time-based check)
  - Trigger char? (space/Enter)
  - Word in dictionary?
  - Safe to correct?
  ↓
If correction found:
  - markCorrection() (sets timestamp)
  - updateBlock() with corrected text
  - restoreEditingCursor()
```

## Known Issues & Limitations

### 1. Dictionary Coverage
- **Issue**: Not all typos are in the dictionary
- **Examples**: "wemty", "abot", "aability", "wepob" (not found in codespell)
- **Impact**: Low - expected behavior for conservative dictionary
- **Solution**: Users can add personal rules in settings

### 2. Suppression Window
- **Current**: 150ms suppression after correction
- **Potential Issue**: Very rapid typing (< 150ms between words) might be suppressed
- **Impact**: Very low - typical typing speed is much slower
- **Mitigation**: Time-based approach is more forgiving than count-based

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

## Testing Results

### Working Corrections
- ✅ "teh" → "the"
- ✅ "wonce" → "once"
- ✅ "wierd" → "weird"
- ✅ "wepon" → "weapon"
- ✅ "wieght" → "weight"
- ✅ "wdith" → "width"
- ✅ Consecutive corrections work correctly

### Not in Dictionary (Expected)
- ❌ "wemty" (not a known typo)
- ❌ "abot" (not a known typo)
- ❌ "aability" (not a known typo)
- ❌ "wepob" (not a known typo)

## Configuration

### Settings
- `enabled`: Enable/disable autocorrect (default: true)
- `mode`: "safe" or "expanded" (default: "safe")
- `remoteEnabled`: Use remote dictionary updates (default: false)
- `remoteUrl`: URL for remote dictionary (default: "")
- `checkIntervalHours`: Remote update interval (default: 24)
- `personalRules`: Custom rules (one per line: typo correction)

### Personal Rules Format
```
teh the
woudl would
helath health
```

## Build System

### Dependencies
- `@logseq/libs`: Logseq plugin API (external, provided by Logseq)
- `typescript`: TypeScript compiler
- `esbuild`: Bundler (IIFE format for browser)
- `ts-node`: Script execution

### Build Process
1. `prebuild`: Inline dictionary (JSON → TypeScript module)
2. `build:esbuild`: Bundle TypeScript → IIFE JavaScript
3. `copy-files`: Copy `logseq.json` to dist

### Output
- `dist/index.js`: Bundled plugin (2.2MB)
- `dist/logseq.json`: Plugin manifest

## Future Improvements (Potential)

1. **Word Context Awareness**: Check surrounding words to avoid false positives
2. **User Learning**: Track user corrections to improve dictionary
3. **Performance**: Further reduce bundle size (dictionary compression?)
4. **UI Feedback**: Visual indicator when correction happens
5. **Undo Support**: Better integration with Logseq's undo system
6. **Multi-language**: Support for other languages beyond UK English

## Code Quality

### Strengths
- ✅ Type-safe (TypeScript)
- ✅ Error handling (try-catch blocks)
- ✅ Fallback mechanisms (polling + DOM)
- ✅ Performance optimized (caching, adaptive polling)
- ✅ Conservative corrections (safety checks)

### Areas for Improvement
- Could reduce logging verbosity further
- Could add unit tests for autocorrect logic
- Could add integration tests for Logseq plugin
- Could document API more thoroughly

## Conclusion

The plugin is **production-ready** and working well. The hybrid DOM + polling approach provides reliable corrections with good performance. The time-based suppression allows consecutive corrections to work properly, and the conservative dictionary approach avoids false positives.

The main limitation is dictionary coverage (some typos aren't in codespell), but this is expected and can be addressed with personal rules.

