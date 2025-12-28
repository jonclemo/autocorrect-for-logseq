# Testing Guide for Autocorrect for Logseq

Step-by-step instructions to test the plugin in Logseq.

## Prerequisites

- Logseq installed and running
- Node.js and npm installed
- This project built and ready

## Step 1: Build the Plugin

1. Open a terminal/command prompt in the project directory:
   ```bash
   cd /path/to/autocorrect-for-logseq
   ```
   (Replace `/path/to/autocorrect-for-logseq` with your actual project path)

2. Install dependencies (if not already done):
   ```bash
   npm install
   ```

3. Build the plugin:
   ```bash
   npm run build
   ```

4. Verify the build succeeded - you should see a `dist/` folder with:
   - `index.js`
   - `logseq.json`
   - `package.json`
   - `README.md`
   - `assets/` folder (containing icon and GIF)

## Step 2: Enable Developer Mode in Logseq

1. Open Logseq
2. Click the **Settings** icon (gear icon) in the top-right corner
3. Scroll down to find **Developer Mode**
4. Toggle **Developer Mode** to **ON**
5. You should see **Plugins** have a **Load unpacked plugin** button

## Step 3: Load the Plugin

1. In Logseq Settings, click on **Plugins** in the sidebar
2. Scroll down to find **Load unpacked plugin** button
3. Click **Load unpacked plugin**
4. A file browser will open
5. Navigate to your project's `dist` folder:
   ```
   /path/to/autocorrect-for-logseq/dist
   ```
   (Replace `/path/to/autocorrect-for-logseq` with your actual project path)
6. Select the `dist` folder (or click "Select Folder")
7. The plugin should now appear in your plugins list

## Step 4: Verify Plugin is Loaded

1. In Logseq Settings → Plugins, you should see:
   - **Autocorrect for Logseq** listed
   - Status should show as enabled/active
2. You should see plugin settings available (scroll down in the plugin card)

## Step 5: Configure Settings (Optional)

1. In the plugin settings, verify:
   - ✅ **Enable autocorrect**: Should be ON (default)
   - **Mode**: Should be "safe" (default)
   - **Personal rules**: You can add custom rules here

2. Settings are saved automatically

## Step 6: Test Basic Autocorrect

1. Create a new page or open an existing one in Logseq
2. Start typing in a block
3. Test these common typos (type them and press Space):

   **Test Cases:**
   - Type: `teh ` → Should auto-correct to: `the `
   - Type: `woudl ` → Should auto-correct to: `would `
   - Type: `helath ` → Should auto-correct to: `health `
   - Type: `commnity ` → Should auto-correct to: `community `
   - Type: `socila ` → Should auto-correct to: `social `

4. The correction should happen **immediately** when you press Space

## Step 7: Test UK English Protection

1. Type UK English words (these should **NOT** be corrected):
   - `colour ` → Should stay as `colour `
   - `favour ` → Should stay as `favour `
   - `organise ` → Should stay as `organise `
   - `centre ` → Should stay as `centre `
   - `theatre ` → Should stay as `theatre `

2. Verify these words are not changed

## Step 8: Test Ambiguous Word Protection

1. Type ambiguous words (these should **NOT** be corrected):
   - `from ` → Should stay as `from `
   - `form ` → Should stay as `form `
   - `to ` → Should stay as `to `
   - `too ` → Should stay as `too `
   - `two ` → Should stay as `two `

2. Verify these are not changed (to avoid false positives)

## Step 9: Test Word Boundary Detection

1. Test that corrections only happen on word boundaries:
   - Type: `teh.` → Should correct to: `the.`
   - Type: `teh,` → Should correct to: `the,`
   - Type: `teh!` → Should correct to: `the!`
   - Type: `teh?` → Should correct to: `the?`
   - Type: `teh` (without space) → Should NOT correct until you add a boundary

2. Press Enter after a typo → Should also trigger correction

## Step 10: Test Case Preservation

1. Test that capitalization is preserved:
   - Type: `Teh ` → Should correct to: `The `
   - Type: `TEH ` → Should correct to: `THE `
   - Type: `teh ` → Should correct to: `the `

2. Verify case is maintained correctly

## Step 11: Test Personal Rules

1. Go to Settings → Plugins → Autocorrect for Logseq
2. In **Personal rules**, add:
   ```
   testt test
   mytypo mycorrection
   ```
3. Save (settings auto-save)
4. Go back to a page and test:
   - Type: `testt ` → Should correct to: `test `
   - Type: `mytypo ` → Should correct to: `mycorrection `

## Step 12: Test Disabling

1. Go to Settings → Plugins → Autocorrect for Logseq
2. Toggle **Enable autocorrect** to OFF
3. Try typing `teh ` → Should NOT correct
4. Toggle back ON → Should work again

## Step 13: Test Command Palette

1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac) to open Command Palette
2. Type: `autocorrect`
3. You should see: **Autocorrect: Reload rules**
4. Click it → Should show a message "Autocorrect rules reloaded"

**Note**: The "Add word to personal rules" command has been removed. Personal rules must be added manually via Settings.

## Troubleshooting

### Plugin doesn't appear
- ✅ Check that `dist/` folder exists and contains files
- ✅ Verify you selected the `dist` folder (not the parent folder)
- ✅ Check Logseq console for errors (Help → Show Developer Tools → Console)

### Autocorrect doesn't work
- ✅ Check that plugin is enabled in settings
- ✅ Verify "Enable autocorrect" setting is ON
- ✅ Try reloading the plugin (disable and re-enable)
- ✅ Check browser console for JavaScript errors

### Cursor position issues
- ✅ If cursor jumps, this is a known issue to refine
- ✅ Try typing slowly to see if it's a timing issue
- ✅ Report the issue with steps to reproduce

### Dictionary not loading
- ✅ Check that the plugin built successfully
- ✅ Verify `dist/index.js` exists and is not empty
- ✅ Check console for loading errors
- ✅ The dictionary is bundled into `index.js`, so no separate dictionary file is needed

## Expected Behavior Summary

✅ **Should correct:**
- Common typos like `teh`, `woudl`, `helath`
- Only on word boundaries (space, punctuation, Enter)
- Preserves capitalization

❌ **Should NOT correct:**
- UK English words (colour, favour, etc.)
- Ambiguous words (from, form, to, too, two)
- Short words (< 5 chars) unless in safe list
- Words without boundaries

## Next Steps After Testing

If everything works:
1. ✅ Document any issues found
2. ✅ Test with different Logseq versions if possible
3. ✅ Refine dictionary if needed
4. ✅ Prepare for release

If issues found:
1. Check browser console for errors
2. Verify build output
3. Test with minimal dictionary
4. Report specific issues with reproduction steps

