# Issue Summary: "Add Word to Personal Rules" Command

## Feature Goal
Implement a Logseq plugin command that allows users to add custom autocorrect rules by:
1. Detecting the word at the cursor position
2. Prompting the user for the correction
3. Adding the rule to personal rules settings

## Technical Approach

### Current Implementation
- **Command**: "Autocorrect: Add word to personal rules" (via command palette)
- **Workflow**:
  1. Get block content using `logseq.Editor.getEditingBlockContent()` or `logseq.Editor.getCurrentBlock()`
  2. Get cursor position using `logseq.Editor.getEditingCursorPosition()` or DOM fallback (`selectionStart`)
  3. Extract word at cursor position
  4. If cursor detection fails, prompt user to type the typo word
  5. Get spellcheck suggestions
  6. Prompt user for correction
  7. Add rule to personal rules (JSON format)

### Code Location
- File: `src/index.ts`
- Function: Command palette handler (lines ~840-970)
- Helper functions: `getSpellcheckSuggestions()`, `promptForCorrection()`, `addToPersonalRules()`

## The Problem

### Symptom
`window.prompt()` dialogs are **not appearing** in Logseq's environment. The code executes, reaches the prompt call, but:
- No dialog appears to the user
- The prompt immediately returns `null` or empty string
- User sees toast: "Cancelled - no rule added" or "User cancelled or entered empty input"

### Evidence from Logs
```
[Autocorrect] Add word: Could not extract word from cursor, asking user to type it...
[Autocorrect] Add word: User cancelled or entered empty input
```

The code reaches the prompt call but the user never sees it.

### What We've Tried

1. **Multiple prompt formats**:
   - Simple prompt: `window.prompt("Message", "")`
   - Detailed prompt with instructions
   - Single prompt for both typo and correction (`typo:correction` format)

2. **Toast notifications before prompt**:
   - Show toast: "A prompt will ask you..."
   - Still no prompt appears

3. **Error handling**:
   - Wrapped in try-catch
   - No errors thrown, prompt just returns null

4. **Timing/delays**:
   - Added `setTimeout` delays before prompt
   - No effect

5. **DOM fallback for cursor**:
   - Tried `document.activeElement.selectionStart`
   - Tried querying all textareas
   - Works for getting cursor position, but prompt still doesn't appear

## Root Cause Hypothesis

### Likely Causes
1. **Browser/Electron blocking**: Logseq runs in Electron, which may block `window.prompt()` for security reasons
2. **Iframe/sandbox restrictions**: Plugin code runs in a sandboxed iframe that may restrict native dialogs
3. **Logseq's UI layer**: Logseq's custom UI framework may intercept or block native browser dialogs
4. **Timing issue**: Prompt called when command palette is open, causing focus/visibility issues

### Evidence Supporting This
- `window.prompt()` is a synchronous blocking call
- Modern browsers/Electron often block or deprecate `window.prompt()`
- Logseq plugins run in a controlled environment with security restrictions
- Command palette may be capturing focus, preventing dialog from appearing

## Potential Solutions

### Option 1: Use Logseq's UI API (if available)
- Check if Logseq provides a custom prompt/dialog API
- Use `logseq.UI.showMsg()` for notifications (works)
- Look for `logseq.UI.prompt()` or similar

### Option 2: Custom Modal/Dialog
- Create a custom HTML modal using Logseq's UI components
- Use `logseq.provideUI()` or similar API
- More complex but fully controlled

### Option 3: Settings-Based Workflow
- Instead of interactive prompt, guide user to settings
- Show instructions: "Go to Settings → Personal Rules → Add: `typo:correction`"
- Less elegant but guaranteed to work

### Option 4: Alternative Input Method
- Use a simpler format: ask user to type in the block itself
- Parse block content for special markers (e.g., `[[autocorrect:typo:correction]]`)
- Less user-friendly but avoids dialog issues

### Option 5: Clipboard-Based
- Ask user to copy typo word
- Detect clipboard content
- Still need prompt for correction

## Questions for Review

1. **Does Logseq provide a custom prompt/dialog API?** (Check `logseq.UI` namespace)
2. **Is `window.prompt()` known to be blocked in Logseq plugins?**
3. **What's the recommended way to get user text input in Logseq plugins?**
4. **Should we use a different approach entirely?** (e.g., settings-based, custom UI component)
5. **Are there any working examples of user input in Logseq plugins?**

## Current Workaround

Users can manually add rules by:
1. Going to Plugin Settings
2. Editing "Personal Rules" field
3. Adding JSON format: `{"typo": "correction"}`

But this is not user-friendly for the "right-click on typo" use case.

## Next Steps

1. Research Logseq plugin API for user input methods
2. Check Logseq plugin examples for dialog/prompt usage
3. Consider implementing custom modal if no API exists
4. Fallback to improved settings instructions if custom UI is too complex

