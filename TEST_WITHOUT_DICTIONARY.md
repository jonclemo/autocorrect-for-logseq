# Test Plugin Without Dictionary

## Purpose

To isolate whether the dictionary file is causing the "Illegal Logseq plugin package" error.

## Test Steps

1. **Temporarily rename files in dist/**:
   ```powershell
   # Backup original
   Rename-Item dist\index.js dist\index-original.js
   Rename-Item dist\logseq.json dist\logseq-original.json
   
   # Use test versions
   Rename-Item dist\index-no-dict.js dist\index.js
   Rename-Item dist\logseq-no-dict.json dist\logseq.json
   ```

2. **Try loading the plugin**:
   - Settings → Plugins → Load unpacked plugin
   - Select `dist` folder
   - Should load without dictionary

3. **If it loads**:
   - ✅ The issue is the dictionary file (1.9MB)
   - → We need to split or optimize the dictionary

4. **If it still fails**:
   - ❌ The issue is something else (other requires, code structure)
   - → Check browser console for specific errors

## Restore Original

After testing:
```powershell
Rename-Item dist\index.js dist\index-no-dict.js
Rename-Item dist\logseq.json dist\logseq-no-dict.json
Rename-Item dist\index-original.js dist\index.js
Rename-Item dist\logseq-original.json dist\logseq.json
```

