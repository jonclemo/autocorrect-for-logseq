# Plugin Verification Guide

## Step 1: Test Minimal Plugin First

Before testing the full plugin, verify Logseq can load a minimal plugin:

1. **Load the minimal test plugin:**
   - In Logseq: Settings → Plugins → Load unpacked plugin
   - Select: `test-minimal` folder
   - Should see: "Minimal test plugin loaded successfully!" message

2. **If minimal plugin works:**
   - ✅ Logseq plugin loading works
   - ✅ Your setup is correct
   - → Proceed to test full plugin

3. **If minimal plugin fails:**
   - ❌ Check Logseq Developer Mode is enabled
   - ❌ Check Logseq version compatibility
   - ❌ Check console for errors (Help → Show Developer Tools)

## Step 2: Verify Full Plugin Structure

### Check dist/ folder structure:
```
dist/
├── logseq.json          ✅ Must exist
├── index.js             ✅ Must exist (main entry)
├── autocorrect.js       ✅ Must exist
├── remote.js            ✅ Must exist
└── dictionary/
    ├── base_safe.js     ✅ Must exist (inlined dictionary)
    └── base_safe.json   ⚠️  Not needed but OK if present
```

### Verify logseq.json:
```bash
# Check file exists
Test-Path dist\logseq.json

# Check JSON is valid (no syntax errors)
# Open in text editor and verify:
# - No trailing commas
# - All strings quoted
# - Valid JSON structure
```

### Verify main file (index.js):
```bash
# Check file exists
Test-Path dist\index.js

# Check it imports @logseq/libs
# Should contain: require("@logseq/libs")

# Check it calls logseq.ready()
# Should contain: logseq.ready(main)
```

## Step 3: Check for Common Issues

### Issue 1: Missing Files
- [ ] Verify all require() paths exist
- [ ] Check dictionary/base_safe.js exists
- [ ] Check autocorrect.js exists
- [ ] Check remote.js exists

### Issue 2: JSON Syntax Errors
- [ ] Validate logseq.json with JSON validator
- [ ] Check for trailing commas
- [ ] Check for unquoted keys

### Issue 3: Module Import Issues
- [ ] Verify all require() statements use correct paths
- [ ] Check relative paths are correct
- [ ] Verify no absolute paths

### Issue 4: File Encoding
- [ ] All files should be UTF-8
- [ ] No BOM (Byte Order Mark)
- [ ] Line endings: LF or CRLF (both should work)

## Step 4: Manual Verification Checklist

### Before Loading Plugin:
- [ ] `dist/logseq.json` exists
- [ ] `dist/logseq.json` has `id` field
- [ ] `dist/logseq.json` has `main` field
- [ ] `dist/index.js` exists (matches `main` field)
- [ ] `dist/index.js` imports `@logseq/libs`
- [ ] `dist/index.js` calls `logseq.ready()`
- [ ] All files referenced in require() exist
- [ ] No syntax errors in JavaScript files

### Test Loading:
1. [ ] Load minimal test plugin → Should work
2. [ ] Load full plugin → Check result
3. [ ] Check browser console for errors
4. [ ] Check Logseq console for errors

## Step 5: Debugging Steps

### If plugin still fails:

1. **Check Browser Console:**
   - Help → Show Developer Tools → Console
   - Look for JavaScript errors
   - Look for module loading errors

2. **Check File Paths:**
   ```javascript
   // In dist/index.js, verify all require paths:
   require("./dictionary/base_safe")  // Should exist
   require("./autocorrect")            // Should exist
   require("./remote")                  // Should exist
   ```

3. **Test Dictionary Module:**
   - Check `dist/dictionary/base_safe.js` exists
   - Check it exports `baseSafe`
   - Check file is not empty
   - Check file size (should be large, ~63k rules)

4. **Simplify to Debug:**
   - Temporarily comment out dictionary import
   - Test if plugin loads without dictionary
   - Gradually add back features

## Step 6: Create Diagnostic Script

Run this to check your plugin structure:

```powershell
# Check required files exist
Write-Host "Checking plugin structure..."
$required = @("logseq.json", "index.js")
foreach ($file in $required) {
    $path = "dist\$file"
    if (Test-Path $path) {
        Write-Host "✓ $file exists"
    } else {
        Write-Host "✗ $file MISSING"
    }
}

# Check logseq.json structure
$logseq = Get-Content "dist\logseq.json" | ConvertFrom-Json
Write-Host "`nlogseq.json fields:"
Write-Host "  id: $($logseq.id)"
Write-Host "  name: $($logseq.name)"
Write-Host "  version: $($logseq.version)"
Write-Host "  main: $($logseq.main)"

# Check main file exists
if (Test-Path "dist\$($logseq.main)") {
    Write-Host "✓ Main file exists"
} else {
    Write-Host "✗ Main file MISSING: dist\$($logseq.main)"
}

# Check for @logseq/libs import
$index = Get-Content "dist\index.js" -Raw
if ($index -match '@logseq/libs') {
    Write-Host "✓ @logseq/libs imported"
} else {
    Write-Host "✗ @logseq/libs NOT imported"
}

# Check for logseq.ready
if ($index -match 'logseq\.ready') {
    Write-Host "✓ logseq.ready() called"
} else {
    Write-Host "✗ logseq.ready() NOT called"
}
```

