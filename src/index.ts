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

  // Register event handler for autocorrect
  // Try onInputSelectionEnd - fires when selection changes (e.g., after typing space)
  logseq.Editor.onInputSelectionEnd(async (e: any) => {
    console.log("[Autocorrect] Event fired!", JSON.stringify(e));
    
    if (!logseq.settings?.enabled) {
      console.log("[Autocorrect] Disabled");
      return;
    }
    if (suppressNext) { 
      suppressNext = false; 
      console.log("[Autocorrect] Suppressed");
      return; 
    }

    // Get current block content to check what was typed
    const block = (await logseq.Editor.getCurrentBlock()) as BlockEntity | null;
    if (!block?.uuid) {
      console.log("[Autocorrect] No block");
      return;
    }
    
    const content = await logseq.Editor.getEditingBlockContent();
    console.log("[Autocorrect] Content:", content, "Length:", content.length);
    
    // Check if last character is a word boundary trigger
    const lastChar = content.slice(-1);
    console.log("[Autocorrect] Last char:", JSON.stringify(lastChar), "Should trigger:", shouldTrigger(lastChar));
    
    if (!shouldTrigger(lastChar)) {
      return;
    }

    // Use cached rules if available, otherwise load on demand
    let currentBase = base;
    let currentRemote = remote;
    if (Object.keys(currentBase).length === 0) {
      console.log("[Autocorrect] Loading dictionary...");
      currentBase = await loadDictionary();
      base = currentBase; // Cache it
      console.log("[Autocorrect] Dictionary loaded:", Object.keys(currentBase).length, "rules");
    }
    if (currentRemote === null) {
      currentRemote = await loadCachedRemoteRules();
      remote = currentRemote; // Cache it
    }
    const currentRules = buildRules(currentRemote, currentBase);
    console.log("[Autocorrect] Total rules:", Object.keys(currentRules).length);

    const editing = await logseq.Editor.checkEditing();
    if (!editing) return;
    const pos = await getCursorPos();
    if (pos === null) {
      console.log("[Autocorrect] No cursor position");
      return;
    }

    console.log("[Autocorrect] Checking:", content.substring(Math.max(0, pos - 10), pos));
    const replaced = replaceWordBeforeCursor(content, pos, currentRules);
    if (!replaced) {
      console.log("[Autocorrect] No replacement found");
      return;
    }

    console.log("[Autocorrect] Replacing:", replaced);
    suppressNext = true;
    await logseq.Editor.updateBlock(block.uuid, replaced.newText);
    await logseq.Editor.restoreEditingCursor();
  });
  
  console.log("[Autocorrect] Plugin initialized, event handler registered");
  
  // Also try onInputTextChanged - fires on every text change (more reliable)
  logseq.Editor.onInputTextChanged(async ({ content, uuid }) => {
    if (!logseq.settings?.enabled) return;
    if (suppressNext) { suppressNext = false; return; }
    if (!content) return;
    
    // Only process if content ends with a word boundary
    const lastChar = content.slice(-1);
    if (!shouldTrigger(lastChar)) return;
    
    console.log("[Autocorrect] Text changed - last char:", lastChar);
    
    // Get cursor position
    const pos = await getCursorPos();
    if (pos === null) return;
    
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
    
    const replaced = replaceWordBeforeCursor(content, pos, currentRules);
    if (!replaced) return;
    
    console.log("[Autocorrect] Replacing via text changed event");
    suppressNext = true;
    await logseq.Editor.updateBlock(uuid, replaced.newText);
    await logseq.Editor.restoreEditingCursor();
  });

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
