# Minimal Logseq Plugin Test

This is a minimal test plugin to verify that Logseq can load plugins from your setup.

## How to Test

1. **Open Logseq**
2. **Enable Developer Mode**:
   - Go to Settings (gear icon)
   - Scroll down to "Developer Mode"
   - Toggle it ON
3. **Load the Plugin**:
   - Go to Settings → Plugins
   - Click "Load unpacked plugin"
   - Navigate to this folder: `test-minimal`
   - Select the `test-minimal` folder
4. **Expected Result**:
   - Plugin should load successfully
   - You should see a message: "Minimal test plugin loaded successfully!"
   - Plugin should appear in your plugins list

## What This Tests

✅ Logseq plugin loading mechanism works  
✅ Your file structure is correct  
✅ logseq.json format is valid  
✅ JavaScript execution works  
✅ @logseq/libs is available  

## If This Works

If the minimal plugin loads successfully, it means:
- Your Logseq setup is correct
- Plugin loading mechanism works
- The issue with the full plugin is specific to that plugin (likely the large dictionary file)

## If This Fails

If the minimal plugin fails to load:
- Check Developer Mode is enabled
- Check Logseq version (should be recent)
- Check browser console for errors (Help → Show Developer Tools → Console)
- Verify the folder structure matches what's expected

## Files

- `logseq.json` - Plugin manifest (minimal required fields)
- `index.js` - Plugin code (just shows a message)

