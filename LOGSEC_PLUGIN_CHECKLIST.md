# Logseq Plugin Requirements Checklist

## Required Files

### 1. logseq.json (REQUIRED)
- [x] **Location**: Must be in the root of the plugin directory (the folder you select when loading)
- [x] **id**: Unique identifier (string, required)
- [x] **name**: Plugin name (string, required)
- [x] **version**: Version number (string, required, format: "x.y.z")
- [x] **main**: Entry point file (string, required, relative to plugin root)
- [x] **description**: Brief description (string, optional but recommended)
- [x] **author**: Author name (string, optional)
- [x] **title**: Display title (string, optional)
- [x] **license**: License type (string, optional)

**Example:**
```json
{
  "id": "my-plugin-id",
  "name": "my-plugin",
  "version": "0.1.0",
  "main": "index.js",
  "description": "Plugin description",
  "author": "Author Name",
  "title": "My Plugin",
  "license": "MIT"
}
```

### 2. Main Entry File (REQUIRED)
- [x] File specified in `logseq.json` → `main` field must exist
- [x] Must be valid JavaScript (CommonJS format recommended)
- [x] Must import `@logseq/libs` at the top
- [x] Must call `logseq.ready()` to initialize

**Example:**
```javascript
require("@logseq/libs");

async function main() {
  // Plugin code here
}

logseq.ready(main).catch(console.error);
```

## File Structure Requirements

### Directory Structure
```
plugin-folder/
├── logseq.json          (REQUIRED - in root)
├── index.js             (REQUIRED - or whatever main points to)
├── other-files.js       (optional)
└── subfolder/           (optional)
    └── files.js
```

### Important Notes
- [x] **No package.json required** in the plugin folder (only in source)
- [x] **No node_modules** should be in the plugin folder
- [x] **All dependencies must be bundled** or use only @logseq/libs
- [x] **CommonJS format** (require/module.exports) is recommended
- [x] **ES Modules** may work but CommonJS is more reliable

## Code Requirements

### 1. Import @logseq/libs
- [x] Must import `@logseq/libs` at the top of main file
- [x] Can use `require("@logseq/libs")` or `import "@logseq/libs"`

### 2. Initialize Plugin
- [x] Must call `logseq.ready(mainFunction)` 
- [x] Should handle errors: `.catch(console.error)`

### 3. Module Format
- [x] **CommonJS** (recommended): `require()` and `module.exports`
- [x] **ES Modules** (may work): `import` and `export`
- [x] **No JSON imports**: Cannot use `require("./file.json")` - must inline or use fetch

### 4. Dependencies
- [x] **@logseq/libs**: Only external dependency allowed (bundled by Logseq)
- [x] **No other npm packages**: Must bundle everything or use browser APIs
- [x] **No Node.js APIs**: Cannot use `fs`, `path`, `http`, etc. (browser environment)

## Common Issues

### ❌ "Illegal Logseq plugin package" Error

**Possible Causes:**
1. [ ] Missing `logseq.json` in plugin root
2. [ ] Missing `id` field in logseq.json
3. [ ] Missing `main` field in logseq.json
4. [ ] `main` file doesn't exist
5. [ ] `main` file has syntax errors
6. [ ] Using `require()` for JSON files (not supported)
7. [ ] Using Node.js APIs (fs, path, etc.)
8. [ ] Missing `@logseq/libs` import
9. [ ] Not calling `logseq.ready()`
10. [ ] ES Module format issues
11. [ ] File encoding issues (must be UTF-8)
12. [ ] Invalid JSON in logseq.json (trailing commas, etc.)

### ✅ Solutions

1. **Verify logseq.json**:
   - Must be valid JSON (no trailing commas)
   - Must have `id`, `name`, `version`, `main`
   - `main` must point to existing file

2. **Verify main file**:
   - Must exist at path specified in `main`
   - Must be valid JavaScript
   - Must import `@logseq/libs`
   - Must call `logseq.ready()`

3. **Check for unsupported features**:
   - No `require("./file.json")` - inline JSON or use fetch
   - No Node.js APIs - use browser APIs only
   - No ES Module imports of JSON files

4. **Verify file structure**:
   - logseq.json in root of selected folder
   - All files referenced must exist
   - No broken imports

## Testing Checklist

Before loading plugin:
- [ ] logseq.json exists in plugin root
- [ ] logseq.json is valid JSON (check with JSON validator)
- [ ] logseq.json has all required fields
- [ ] main file exists at path specified in `main`
- [ ] main file imports `@logseq/libs`
- [ ] main file calls `logseq.ready()`
- [ ] No JSON file imports using require()
- [ ] No Node.js APIs used
- [ ] All file paths are relative and correct
- [ ] No syntax errors in JavaScript files

## Minimal Working Example

### logseq.json
```json
{
  "id": "test-plugin",
  "name": "test-plugin",
  "version": "0.1.0",
  "main": "index.js"
}
```

### index.js
```javascript
require("@logseq/libs");

async function main() {
  logseq.UI.showMsg("Plugin loaded!");
}

logseq.ready(main).catch(console.error);
```

This minimal example should load successfully.

