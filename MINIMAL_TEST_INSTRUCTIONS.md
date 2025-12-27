# Minimal Plugin Test Instructions

## Issue: "Illegal Logseq plugin package" for minimal test

This suggests a fundamental issue with how Logseq is reading the plugin. Let's try multiple approaches:

## Test 1: Current Minimal Plugin (with package.json)

**Location**: `test-minimal/` folder

**Files**:
- `package.json` (with logseq.id field)
- `logseq.json`
- `index.js`

**Try loading**: `test-minimal` folder

## Test 2: Ultra Minimal (logseq.json only)

**Location**: `test-minimal-v2/` folder

**Files**:
- `logseq.json` (minimal fields only)
- `index.js`

**Try loading**: `test-minimal-v2` folder

## Test 3: Check Logseq Version

The error might be due to Logseq version requirements:

1. Check your Logseq version
2. Check if you're using:
   - Desktop app (Electron)
   - Web version
   - Different platform

## Test 4: Verify Folder Selection

**Critical**: When loading the plugin:
- ✅ Select the FOLDER (e.g., `test-minimal`)
- ❌ Do NOT select a file inside the folder
- ❌ Do NOT select the parent folder

## Test 5: Check File Encoding

All files must be:
- UTF-8 encoding
- No BOM (Byte Order Mark)
- Unix (LF) or Windows (CRLF) line endings should both work

## Test 6: Try Different logseq.json Format

Some Logseq versions might need different fields. Try this format:

```json
{
  "id": "test-minimal",
  "name": "test-minimal",
  "version": "0.1.0",
  "main": "index.js",
  "title": "Test",
  "description": "Test plugin"
}
```

## Debugging Steps

1. **Check Logseq Console**:
   - Help → Show Developer Tools → Console
   - Look for specific error messages
   - Look for file loading errors

2. **Check File Permissions**:
   - Ensure files are readable
   - No permission issues

3. **Try Absolute Path**:
   - Some Logseq versions might have path issues
   - Try copying plugin to a simpler path (e.g., `C:\test-plugin`)

4. **Check Logseq Logs**:
   - Look for Logseq's log files
   - May contain more detailed error information

## Alternative: Check Official Examples

Download an official Logseq plugin example:
- https://github.com/logseq/logseq-plugin-samples
- Compare structure with your minimal plugin
- See what's different

## Most Likely Causes

1. **Logseq version incompatibility** - Your Logseq version might need different format
2. **File encoding issues** - Files not in UTF-8
3. **Path issues** - Logseq can't read the files
4. **Missing required field** - Some hidden requirement we're missing

## Next Steps

1. Try both test folders (`test-minimal` and `test-minimal-v2`)
2. Check browser console for detailed errors
3. Verify Logseq version
4. Try copying to a simpler path
5. Check if official examples work in your Logseq

