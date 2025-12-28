// @logseq/libs is provided globally by Logseq
// No import needed - logseq is available as a global
import type { BlockEntity } from "@logseq/libs/dist/LSPlugin.user";
import { parsePersonalRules, replaceWordBeforeCursor, shouldTrigger, type Rules } from "./autocorrect";
import { loadCachedRemoteRules, maybeRefreshRemoteRules } from "./remote";

// Lazy load dictionary to avoid blocking startup
let baseSafe: Rules = {};
let dictionaryLoading: Promise<Rules> | null = null;

function loadDictionarySync(): Rules {
  if (Object.keys(baseSafe).length > 0) return baseSafe;
  
  try {
    // Lazy require - only load when first needed
    // This defers the 1.9MB load until actually needed
    const dictModule = require("./dictionary/base_safe");
    baseSafe = dictModule.baseSafe || {};
    console.log(`Dictionary loaded: ${Object.keys(baseSafe).length} rules`);
  } catch (e) {
    console.warn("Could not load dictionary:", e);
    baseSafe = {}; // Fallback to empty
  }
  return baseSafe;
}

async function loadDictionary(): Promise<Rules> {
  if (Object.keys(baseSafe).length > 0) return baseSafe;
  if (dictionaryLoading) return dictionaryLoading;
  
  // Load in next tick to avoid blocking startup
  dictionaryLoading = new Promise<Rules>((resolve) => {
    // Use requestIdleCallback or setTimeout to defer loading
    const idleCallback = (globalThis as any).requestIdleCallback;
    if (typeof idleCallback !== 'undefined') {
      idleCallback(() => {
        resolve(loadDictionarySync());
      }, { timeout: 1000 });
    } else {
      setTimeout(() => {
        resolve(loadDictionarySync());
      }, 100); // Small delay to not block startup
    }
  });
  
  return dictionaryLoading;
}

function buildRules(remote: Rules | null, base: Rules): Rules {
  const personal = parsePersonalRules(String(logseq.settings?.personalRules || ""));
  return { ...base, ...(remote || {}), ...personal };
}

async function getCursorPos(): Promise<number | null> {
  const c = await logseq.Editor.getEditingCursorPosition();
  if (!c) return null;
  // Logseq versions can differ; cover common shapes:
  const pos = (c as any).pos ?? (c as any).end ?? null;
  return typeof pos === "number" ? pos : null;
}

async function main() {
  // Show plugin loaded message immediately
  setTimeout(() => {
    logseq.UI.showMsg("Autocorrect plugin loaded - check settings to enable");
  }, 500);

  // Register commands first (so they're available even if other things fail)
  try {
    logseq.App.registerCommandPalette(
      { key: "autocorrect-test", label: "Autocorrect: Test plugin" },
      async () => {
        try {
          const base = await loadDictionary();
          const remote = await loadCachedRemoteRules();
          const testRules = buildRules(remote, base);
          const ruleCount = Object.keys(testRules).length;
          const hasTeh = "teh" in testRules;
          const enabled = logseq.settings?.enabled !== false;
          logseq.UI.showMsg(`Rules: ${ruleCount}, "teh": ${hasTeh ? "YES" : "NO"}, Enabled: ${enabled}`);
        } catch (e: any) {
          logseq.UI.showMsg(`Test error: ${e?.message || e}`);
        }
      }
    );
    console.log("[Autocorrect] Command registered");
  } catch (e) {
    console.error("[Autocorrect] Failed to register command:", e);
  }

  logseq.useSettingsSchema([
    { key: "enabled", type: "boolean", default: true, title: "Enable autocorrect", description: "Enable or disable autocorrect functionality" },
    { key: "mode", type: "enum", enumChoices: ["safe", "expanded"], default: "safe", title: "Mode", description: "Autocorrect mode: 'safe' for conservative corrections, 'expanded' for more aggressive corrections" },
    { key: "remoteEnabled", type: "boolean", default: false, title: "Use remote dictionary updates", description: "Enable automatic updates from a remote dictionary URL" },
    { key: "remoteUrl", type: "string", default: "", title: "Remote dictionary URL", description: "URL to fetch remote dictionary updates from (JSON format)" },
    { key: "checkIntervalHours", type: "number", default: 24, title: "Remote update interval (hours)", description: "How often to check for remote dictionary updates" },
    { key: "personalRules", type: "string", default: "teh the\nwoudl would\nhelath health", title: "Personal rules", description: "Custom autocorrect rules (one per line: typo correction)" }
  ]);
  
  logseq.UI.showMsg("Autocorrect plugin loaded");

  // Defer all loading to avoid blocking startup
  // Start with empty rules, load dictionary in background
  let base: Rules = {};
  let remote: Rules | null = null;
  let rules: Rules = buildRules(remote, base);
  
  // Load dictionary and remote rules asynchronously (non-blocking)
  // Don't await - let it load in background
  Promise.all([
    loadDictionary(),
    loadCachedRemoteRules()
  ]).then(([loadedBase, loadedRemote]) => {
    base = loadedBase;
    remote = loadedRemote;
    rules = buildRules(remote, base);
    console.log("[Autocorrect] Background loading complete:", Object.keys(rules).length, "rules");
  }).catch(console.error);

  // Update remote in the background (but still in this session)
  // Defer remote refresh to background (non-blocking)
  maybeRefreshRemoteRules({
    enabled: Boolean(logseq.settings?.remoteEnabled),
    url: String(logseq.settings?.remoteUrl || ""),
    intervalHours: Number(logseq.settings?.checkIntervalHours || 24)
  }).then((refreshed) => {
    if (refreshed) {
      remote = refreshed;
      loadDictionary().then((loadedBase) => {
        base = loadedBase;
        rules = buildRules(remote, base);
      });
    }
  }).catch(console.error);

  let suppressNext = false;
  let lastContent = "";
  let lastBlockUuid: string | null = null;

  // Register event handler for autocorrect
  // onInputSelectionEnd exists in Logseq API - fires when input selection ends
  // Reference: https://plugins-doc.logseq.com/logseq/Editor/onInputSelectionEnd
  console.log("[Autocorrect] Registering onInputSelectionEnd...");
  logseq.Editor.onInputSelectionEnd(async (e: any) => {
    try {
      console.log("[Autocorrect] onInputSelectionEnd fired!", e);
      
      if (!logseq.settings?.enabled) {
        return;
      }
      if (suppressNext) { 
        suppressNext = false; 
        return; 
      }

      // Get current block and content
      const block = (await logseq.Editor.getCurrentBlock()) as BlockEntity | null;
      if (!block?.uuid) {
        return;
      }
      
      const editing = await logseq.Editor.checkEditing();
      if (!editing) return;
      
      const content = await logseq.Editor.getEditingBlockContent();
      // Ensure content is a string (Logseq might return null)
      if (!content || typeof content !== 'string') return;
      
      // Check if last character is a word boundary trigger
      const lastChar = content.slice(-1);
      if (!shouldTrigger(lastChar)) {
        return;
      }

      console.log("[Autocorrect] Processing autocorrect, last char:", JSON.stringify(lastChar));

      // Use cached rules if available, otherwise load on demand
      let currentBase = base;
      let currentRemote = remote;
      if (Object.keys(currentBase).length === 0) {
        currentBase = await loadDictionary();
        base = currentBase; // Cache it
      }
      if (currentRemote === null) {
        currentRemote = await loadCachedRemoteRules();
        remote = currentRemote; // Cache it
      }
      const currentRules = buildRules(currentRemote, currentBase);

      const pos = await getCursorPos();
      if (pos === null) {
        return;
      }

      const replaced = replaceWordBeforeCursor(content, pos, currentRules);
      if (!replaced || !replaced.newText || typeof replaced.newText !== 'string') {
        return;
      }

      console.log("[Autocorrect] Replacing:", replaced);
      suppressNext = true;
      await logseq.Editor.updateBlock(block.uuid, replaced.newText);
      await logseq.Editor.restoreEditingCursor();
    } catch (error) {
      console.error("[Autocorrect] Error in onInputSelectionEnd:", error);
    }
  });
  
  // Alternative: Use onKeyDown to detect space/Enter (word boundaries)
  // This might be more reliable than onInputSelectionEnd
  // Note: onKeyDown fires BEFORE the key is inserted, so we use setTimeout to check after insertion
  console.log("[Autocorrect] Registering onKeyDown...");
  try {
    logseq.App.onKeyDown(async (e: any) => {
    try {
      // Only process space and Enter (word boundaries)
      if (!e || (e.key !== " " && e.key !== "Enter")) return;
      
      if (!logseq.settings?.enabled) return;
      if (suppressNext) { 
        suppressNext = false; 
        return; 
      }

      // Wait a tick for the key to be inserted into the editor
      setTimeout(async () => {
        try {
      const editing = await logseq.Editor.checkEditing();
      if (!editing) return;

      const block = (await logseq.Editor.getCurrentBlock()) as BlockEntity | null;
      if (!block?.uuid) return;
      
      const content = await logseq.Editor.getEditingBlockContent();
      // Ensure content is a string (Logseq might return null)
      if (!content || typeof content !== 'string') return;

      // Get rules
      let currentBase = base;
      let currentRemote = remote;
      if (Object.keys(currentBase).length === 0) {
        currentBase = await loadDictionary();
        base = currentBase;
      }
      if (currentRemote === null) {
        currentRemote = await loadCachedRemoteRules();
        remote = currentRemote;
      }
      const currentRules = buildRules(currentRemote, currentBase);

      // Get cursor position (should be after the space/Enter)
      const pos = await getCursorPos();
      if (pos === null || pos === 0) return;
      
      // Check the word before the space/Enter (cursor is after it, so pos-1 is the boundary)
      const replaced = replaceWordBeforeCursor(content, pos - 1, currentRules);
      if (!replaced || !replaced.newText || typeof replaced.newText !== 'string') return;

          console.log("[Autocorrect] Replacing via onKeyDown:", replaced);
          suppressNext = true;
          await logseq.Editor.updateBlock(block.uuid, replaced.newText);
          await logseq.Editor.restoreEditingCursor();
        } catch (error) {
          console.error("[Autocorrect] Error in onKeyDown setTimeout:", error);
        }
      }, 10); // Small delay to ensure key is inserted
    } catch (error) {
      console.error("[Autocorrect] Error in onKeyDown:", error);
    }
  });
  } catch (error) {
    console.warn("[Autocorrect] onKeyDown not available:", error);
  }
  
  // Fallback: Polling approach - check for changes periodically
  // This is a backup if events don't fire
  console.log("[Autocorrect] Setting up polling fallback...");
  let pollingInterval: any = null;
  
  async function checkForAutocorrect() {
    if (!logseq.settings?.enabled) return;
    if (suppressNext) {
      suppressNext = false;
      return;
    }

    try {
      const editing = await logseq.Editor.checkEditing();
      if (!editing) return;

      const block = (await logseq.Editor.getCurrentBlock()) as BlockEntity | null;
      if (!block?.uuid) return;

      const content = await logseq.Editor.getEditingBlockContent();
      if (!content || typeof content !== 'string') return;

      // Skip if same block and no change
      if (block.uuid === lastBlockUuid) {
        if (content === lastContent) {
          // No change, skip
          return;
        }
        // Content changed - update lastContent
        lastContent = content;
      } else {
        // New block
        lastBlockUuid = block.uuid;
        lastContent = content;
        return; // New block, wait for next poll
      }

      // Check if last character is a word boundary trigger
      const lastChar = content.slice(-1);
      if (!shouldTrigger(lastChar)) return;

      // Get rules
      let currentBase = base;
      let currentRemote = remote;
      if (Object.keys(currentBase).length === 0) {
        currentBase = await loadDictionary();
        base = currentBase;
      }
      if (currentRemote === null) {
        currentRemote = await loadCachedRemoteRules();
        remote = currentRemote;
      }
      const currentRules = buildRules(currentRemote, currentBase);

      const pos = await getCursorPos();
      if (pos === null) return;

      // When cursor is after a space/punctuation, we need to check the word BEFORE it
      // So we use pos - 1 to check at the boundary character
      const checkPos = pos > 0 ? pos - 1 : pos;
      const replaced = replaceWordBeforeCursor(content, checkPos, currentRules);
      if (!replaced || !replaced.newText || typeof replaced.newText !== 'string') return;

      console.log("[Autocorrect] Corrected:", replaced);
      suppressNext = true;
      await logseq.Editor.updateBlock(block.uuid, replaced.newText);
      await logseq.Editor.restoreEditingCursor();
      lastContent = replaced.newText;
    } catch (error) {
      console.error("[Autocorrect] Error in polling:", error);
    }
  }

  // Start polling every 300ms when editing
  pollingInterval = setInterval(checkForAutocorrect, 300);
  console.log("[Autocorrect] Polling interval started (300ms)");
  
  console.log("[Autocorrect] Plugin initialized, event handlers registered");

  // Optional: command to re-load rules (useful if user edited settings)
  logseq.App.registerCommandPalette(
    { key: "autocorrect-reload", label: "Autocorrect: Reload rules" },
    async () => {
      baseSafe = {}; // Force reload
      const base = await loadDictionary();
      const cached = await loadCachedRemoteRules();
      rules = buildRules(cached, base);
      logseq.UI.showMsg("Autocorrect rules reloaded");
    }
  );
}

logseq.ready(main).catch(console.error);
