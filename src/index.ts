// @logseq/libs is provided globally by Logseq
// No import needed - logseq is available as a global
import type { BlockEntity } from "@logseq/libs/dist/LSPlugin.user";
import { parsePersonalRules, replaceWordBeforeCursor, shouldTrigger, type Rules } from "./autocorrect";
import { loadCachedRemoteRules, maybeRefreshRemoteRules } from "./remote";

// Lazy load dictionary to avoid blocking startup
let baseSafe: Rules = {};
let dictionaryLoading: Promise<Rules> | null = null;
let remote: Rules | null = null; // Module-level for rebuildRules access

function loadDictionarySync(): Rules {
  if (Object.keys(baseSafe).length > 0) return baseSafe;
  
  try {
    // Lazy require - only load when first needed
    // This defers the 1.9MB load until actually needed
    const dictModule = require("./dictionary/base_safe");
    baseSafe = dictModule.baseSafe || {};
    if (typeof logseq !== 'undefined' && logseq.settings?.debug) {
      console.log(`Dictionary loaded: ${Object.keys(baseSafe).length} rules`);
    }
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

// Cached rules - rebuilt only when inputs change
// Use Map for faster lookups at scale
let cachedRules: Map<string, string> = new Map();
let personalRulesText = "";
let baseLoaded = false;

function rebuildRules(base: Rules, remoteRules: Rules | null) {
  const personal = parsePersonalRules(String(logseq.settings?.personalRules || ""));
  personalRulesText = String(logseq.settings?.personalRules || "");
  
  // Convert object rules to Map for faster lookups
  const allRules: Rules = { ...base, ...(remoteRules || {}), ...personal };
  cachedRules = new Map(Object.entries(allRules));
  
  if (typeof logseq !== 'undefined' && logseq.settings?.debug) {
    console.log("[Autocorrect] Rules rebuilt:", cachedRules.size);
  }
}

async function getCursorPos(): Promise<number | null> {
  const c = await logseq.Editor.getEditingCursorPosition();
  if (!c) return null;
  // Logseq versions can differ; cover common shapes:
  const pos = (c as any).pos ?? (c as any).end ?? null;
  return typeof pos === "number" ? pos : null;
}

async function main() {
  // Debug logging helper (define early so it can be used)
  const debug = () => Boolean(logseq.settings?.debug);

  // MODAL DISABLED - Temporarily disabled due to blocking issues
  // TODO: Re-implement with a working modal solution
  /*
  // Set up Main UI for add word modal
  logseq.provideUI({
    key: "add-word-modal",
    path: "body",
    template: `...`
  });
  */

  // Helper function to get spellcheck suggestions
  async function getSpellcheckSuggestions(word: string): Promise<string[]> {
    const suggestions: string[] = [];
    
    // Try to use browser spellcheck API if available
    // Note: Browser spellcheck API is limited, so we'll also check our dictionary
    try {
      // Check if word exists in our dictionary (if it does, it's likely correct)
      const base = await loadDictionary();
      if (base[word]) {
        suggestions.push(base[word]);
      }
    } catch (e) {
      // Ignore
    }

    // Add some common suggestions based on word patterns
    // This is a simple heuristic - could be improved
    if (word.length > 2) {
      // Common typo patterns
      const commonCorrections: Record<string, string[]> = {
        'teh': ['the'],
        'woudl': ['would'],
        'helath': ['health'],
        'adn': ['and'],
        'taht': ['that'],
        'thsi': ['this'],
      };
      
      if (commonCorrections[word]) {
        suggestions.push(...commonCorrections[word]);
      }
    }

    return [...new Set(suggestions)]; // Remove duplicates
  }

  // Note: promptForCorrection removed - now using Main UI modal instead

  // Helper function to add rule to personal rules
  async function addToPersonalRules(typo: string, correction: string): Promise<void> {
    const currentRules = String(logseq.settings?.personalRules || '');
    let rulesObj: Record<string, string> = {};

    // Parse existing rules
    try {
      if (currentRules.trim().startsWith('{')) {
        // JSON format
        rulesObj = JSON.parse(currentRules);
      } else {
        // Line-based format - convert to object
        const parsed = parsePersonalRules(currentRules);
        rulesObj = parsed;
      }
    } catch (e) {
      // If parsing fails, start fresh
      rulesObj = {};
    }

    // Add new rule
    rulesObj[typo] = correction;

    // Convert back to JSON format (matches base_safe.json)
    const updatedRules = JSON.stringify(rulesObj, null, 2);

    // Update settings
    await logseq.updateSettings({ personalRules: updatedRules });

    // Rebuild rules cache
    const base = await loadDictionary();
    const remote = await loadCachedRemoteRules();
  rebuildRules(base, remote);
  }

  // Register commands first (so they're available even if other things fail)
  // Note: On plugin reload, Logseq may log "already exist" warnings - these are harmless
  // and expected when reloading without full unload. Our try-catch handles them gracefully.
  // Commands removed:
  // - "Autocorrect: Test plugin" - removed

  logseq.useSettingsSchema([
    { key: "enabled", type: "boolean", default: true, title: "Enable autocorrect", description: "Enable or disable autocorrect functionality" },
    { key: "mode", type: "enum", enumChoices: ["safe", "expanded"], default: "safe", title: "Mode", description: "Autocorrect mode: 'safe' for conservative corrections, 'expanded' for more aggressive corrections" },
    { key: "remoteEnabled", type: "boolean", default: false, title: "Use remote dictionary updates", description: "Enable automatic updates from a remote dictionary URL" },
    { key: "remoteUrl", type: "string", default: "", title: "Remote dictionary URL", description: "URL to fetch remote dictionary updates from (JSON format)" },
    { key: "checkIntervalHours", type: "number", default: 24, title: "Remote update interval (hours)", description: "How often to check for remote dictionary updates" },
    { key: "personalRules", type: "string", default: '{\n  "teh": "the",\n  "woudl": "would",\n  "helath": "health"\n}', title: "Personal rules", description: "Custom autocorrect rules in JSON format (matches base_safe.json). Multiple rules must be inside curly braces {} and separated by commas: {\"typo1\": \"correction1\", \"typo2\": \"correction2\"}. Also supports line-based format: typo correction (one per line)." },
    { key: "debug", type: "boolean", default: false, title: "Debug logging", description: "Enable debug logging to console (for troubleshooting)" }
  ]);

  // Defer all loading to avoid blocking startup
  // Start with empty rules, load dictionary in background
  let base: Rules = {};
  
  // Load dictionary and remote rules asynchronously (non-blocking)
  // Don't await - let it load in background
  Promise.all([
    loadDictionary(),
    loadCachedRemoteRules()
  ]).then(([loadedBase, loadedRemote]) => {
    baseSafe = loadedBase;
    base = loadedBase;
    remote = loadedRemote;
    baseLoaded = true;
    rebuildRules(base, remote);
    if (debug()) console.log("[Autocorrect] Background loading complete:", cachedRules.size, "rules");
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
      if (baseLoaded) {
        rebuildRules(baseSafe, remote);
      }
    }
  }).catch(console.error);

  // Listen for settings changes to rebuild rules when personal rules change
  if (logseq.onSettingsChanged) {
    logseq.onSettingsChanged((newSettings: any, oldSettings: any) => {
      const newText = String(newSettings?.personalRules || "");
      if (newText !== personalRulesText && baseLoaded) {
        rebuildRules(baseSafe, remote);
      }
    });
  }

  // Content-based suppression - track last corrected block + content to prevent duplicate processing
  let lastCorrectedBlockUuid: string | null = null;
  let lastCorrectedContentHash: string | null = null;
  
  // Simple hash function for content (fast, good enough for deduplication)
  function hashContent(content: string): string {
    // Use a simple hash - just take first/last chars and length for speed
    // This is sufficient to detect if we've already processed this exact content
    if (content.length === 0) return "";
    return `${content.length}:${content.slice(0, 10)}:${content.slice(-10)}`;
  }
  
  function shouldSuppress(blockUuid: string, content: string): boolean {
    // Suppress only if we've already processed this exact block + content state
    if (lastCorrectedBlockUuid === blockUuid && lastCorrectedContentHash === hashContent(content)) {
      return true;
    }
    return false;
  }
  
  function markCorrection(blockUuid: string, content: string): void {
    lastCorrectedBlockUuid = blockUuid;
    lastCorrectedContentHash = hashContent(content);
  }

  let lastContent = "";
  let lastBlockUuid: string | null = null;

  // DOM event listener state
  let domListenersBound = false;
  let editorElement: HTMLElement | null = null;
  let domKeyDownHandler: ((e: KeyboardEvent) => void) | null = null;

  // Extract shared autocorrect processing logic
  async function processAutocorrect(content: string, pos: number, blockUuid: string): Promise<{ newText: string; newCursorPos: number } | null> {
    if (!logseq.settings?.enabled) {
      if (debug()) console.log("[Autocorrect] processAutocorrect: Disabled in settings");
      return null;
    }
    if (shouldSuppress(blockUuid, content)) {
      if (debug()) console.log("[Autocorrect] processAutocorrect: Suppressed");
      return null;
    }

    // Check if rules are loaded
    if (cachedRules.size === 0) {
      if (debug()) console.log("[Autocorrect] processAutocorrect: No rules loaded yet");
      return null;
    }

    // Check character at cursor position (or before it if at boundary)
    const checkChar = pos > 0 ? content[pos - 1] : content[pos];
    if (!shouldTrigger(checkChar)) {
      if (debug()) console.log("[Autocorrect] processAutocorrect: No trigger, char:", checkChar, "pos:", pos);
      return null;
    }

    // Use cached rules (no rebuild needed!)
    const checkPos = pos > 0 ? pos - 1 : pos;
    const replaced = replaceWordBeforeCursor(content, checkPos, cachedRules);
    if (!replaced || !replaced.newText || typeof replaced.newText !== 'string') {
      if (debug()) {
        // Log what word we're checking
        const left = content.slice(0, checkPos);
        let i = left.length - 1;
        while (i >= 0 && !/[\s.,;:!?()[\]{}"']/.test(left[i])) i--;
        const start = i + 1;
        const word = left.slice(start);
        console.log("[Autocorrect] processAutocorrect: No replacement for:", word, "in dict:", cachedRules.has(word.toLowerCase()));
      }
      return null;
    }

    if (debug()) console.log("[Autocorrect] processAutocorrect: Found replacement:", replaced);
    return replaced;
  }

  // DOM event binding function - tries multiple selectors to find editor
  function bindEditorListeners(): boolean {
    try {
      // Try to access parent document (Logseq plugins run in iframe)
      const doc = (window.parent || window).document;
      if (!doc) {
        if (debug()) console.log("[Autocorrect] DOM: No parent document access");
        return false;
      }

      // Remove existing listeners if rebinding
      if (domKeyDownHandler) {
        if (editorElement) {
          editorElement.removeEventListener('keydown', domKeyDownHandler, true);
          editorElement.removeEventListener('keydown', domKeyDownHandler, false);
        }
        // Also remove from document if we added it there
        doc.removeEventListener('keydown', domKeyDownHandler, true);
        doc.removeEventListener('keydown', domKeyDownHandler, false);
      }

      // Create new handler
      domKeyDownHandler = (e: KeyboardEvent) => {
        // Check if event is from an editor element
        const target = e.target as HTMLElement;
        const isEditorElement = target && (
          target.tagName === 'TEXTAREA' ||
          target.getAttribute('contenteditable') === 'true' ||
          target.closest('textarea') !== null ||
          target.closest('[contenteditable="true"]') !== null
        );
        
        if (!isEditorElement) return; // Not from editor, ignore
        
        if (debug()) console.log("[Autocorrect] DOM: Keydown event received:", e.key, "target:", target.tagName);
        
        // Only process space and Enter (word boundaries)
        if (e.key !== " " && e.key !== "Enter") return;
        
        if (debug()) console.log("[Autocorrect] DOM: Keydown event captured (space/Enter):", e.key);
        
        // Defer processing until after key is inserted
        setTimeout(() => {
          handleDOMKeyDown(e);
        }, 0);
      };

      // Try multiple approaches:
      // 1. Find specific editor element
      const selectors = [
        'textarea:focus',
        '[contenteditable="true"]:focus',
        'textarea',
        '[contenteditable="true"]',
        '.editor-input',
        '.ls-block textarea',
        '.editor textarea',
        '[data-contenteditable="true"]'
      ];

      let found = false;
      // First try to find focused element (most likely active editor)
      const focused = doc.activeElement as HTMLElement;
      if (focused && (focused.tagName === 'TEXTAREA' || focused.getAttribute('contenteditable') === 'true')) {
        editorElement = focused;
        found = true;
        if (debug()) console.log("[Autocorrect] DOM: Found focused editor element");
      }
      
      // If no focused element, try selectors
      if (!found) {
        for (const selector of selectors) {
          const elements = doc.querySelectorAll(selector);
          for (let i = 0; i < elements.length; i++) {
            const el = elements[i] as HTMLElement;
            // Check if element is visible and likely the active editor
            if (el.offsetParent !== null || el.style.display !== 'none') {
              editorElement = el;
              found = true;
              if (debug()) console.log("[Autocorrect] DOM: Found editor with selector:", selector);
              break;
            }
          }
          if (found) break;
        }
      }

      // Add listener to specific element if found
      if (found && editorElement) {
        editorElement.addEventListener('keydown', domKeyDownHandler, true);
        editorElement.addEventListener('keydown', domKeyDownHandler, false);
        if (debug()) console.log("[Autocorrect] DOM: Event listeners bound to element");
      }
      
      // ALSO add to document level as fallback (catches events even if element changes)
      doc.addEventListener('keydown', domKeyDownHandler, true);
      if (debug()) console.log("[Autocorrect] DOM: Event listeners also bound to document (fallback)");
      
      domListenersBound = true;
      if (debug()) console.log("[Autocorrect] DOM: Event listeners bound successfully");
      return true;
    } catch (error) {
      console.warn("[Autocorrect] DOM: Failed to bind listeners:", error);
      domListenersBound = false;
      editorElement = null;
      return false;
    }
  }

  // DOM event handler for keydown events
  async function handleDOMKeyDown(e: KeyboardEvent) {
    try {
      if (debug()) console.log("[Autocorrect] DOM: handleDOMKeyDown called");
      
      if (!logseq.settings?.enabled) {
        if (debug()) console.log("[Autocorrect] DOM: Disabled in settings");
        return;
      }

      const editing = await logseq.Editor.checkEditing();
      if (!editing) {
        if (debug()) console.log("[Autocorrect] DOM: Not editing");
        return;
      }

      const content = await logseq.Editor.getEditingBlockContent();
      if (!content || typeof content !== 'string') {
        if (debug()) console.log("[Autocorrect] DOM: No content");
        return;
      }

      const pos = await getCursorPos();
      if (pos === null) {
        if (debug()) console.log("[Autocorrect] DOM: No cursor position");
        return;
      }

      const block = (await logseq.Editor.getCurrentBlock()) as BlockEntity | null;
      if (!block?.uuid) {
        if (debug()) console.log("[Autocorrect] DOM: No block");
        return;
      }

      if (debug()) console.log("[Autocorrect] DOM: Processing autocorrect, content:", content.slice(-20), "pos:", pos, "rules loaded:", cachedRules.size);
      const replaced = await processAutocorrect(content, pos, block.uuid);
      if (!replaced) {
        if (debug()) console.log("[Autocorrect] DOM: No replacement found for word at position", pos);
        // Log what word we're checking
        const checkPos = pos > 0 ? pos - 1 : pos;
        const left = content.slice(0, checkPos);
        let i = left.length - 1;
        while (i >= 0 && !/[\s.,;:!?()[\]{}"']/.test(left[i])) i--;
        const start = i + 1;
        const word = left.slice(start);
        if (debug()) {
          console.log("[Autocorrect] DOM: Checked word:", word, "in dictionary:", cachedRules.has(word.toLowerCase()));
        }
        return;
      }

      if (debug()) console.log("[Autocorrect] DOM: Corrected:", replaced);
      markCorrection(block.uuid, replaced.newText); // Mark corrected content to prevent duplicate processing
      await logseq.Editor.updateBlock(block.uuid, replaced.newText);
      // Only restore cursor if position changed (length difference)
      if (replaced.newCursorPos !== pos) {
        await logseq.Editor.restoreEditingCursor();
      }
      lastContent = replaced.newText;
      if (block.uuid !== lastBlockUuid) {
        lastBlockUuid = block.uuid;
      }
    } catch (error) {
      console.error("[Autocorrect] DOM: Error in handleDOMKeyDown:", error);
    }
  }

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

      // Get content first (cheapest check)
      const editing = await logseq.Editor.checkEditing();
      if (!editing) return;
      
      const content = await logseq.Editor.getEditingBlockContent();
      // Ensure content is a string (Logseq might return null)
      if (!content || typeof content !== 'string') return;
      
      // Get cursor position first to check character at cursor (not just last char)
      const pos = await getCursorPos();
      if (pos === null) {
        return;
      }

      // Check character at cursor position (or before it if at boundary)
      // This fixes mid-text editing edge case
      const checkChar = pos > 0 ? content[pos - 1] : content[pos];
      if (!shouldTrigger(checkChar)) {
        return;
      }

      // Only now get block (expensive call, but we need UUID for updateBlock)
      const block = (await logseq.Editor.getCurrentBlock()) as BlockEntity | null;
      if (!block?.uuid) {
        return;
      }

      // Check suppression after we have block UUID and content
      if (shouldSuppress(block.uuid, content)) {
        return;
      }

      // Use cached rules (no rebuild needed!)
      const replaced = replaceWordBeforeCursor(content, pos, cachedRules);
      if (!replaced || !replaced.newText || typeof replaced.newText !== 'string') {
        return;
      }

      if (debug()) console.log("[Autocorrect] Replacing:", replaced);
      markCorrection(block.uuid, replaced.newText); // Mark corrected content to prevent duplicate processing
      await logseq.Editor.updateBlock(block.uuid, replaced.newText);
      // Only restore cursor if position changed (length difference)
      if (replaced.newCursorPos !== pos) {
        await logseq.Editor.restoreEditingCursor();
      }
    } catch (error) {
      console.error("[Autocorrect] Error in onInputSelectionEnd:", error);
    }
  });
  
  // Alternative: Use onKeyDown to detect space/Enter (word boundaries)
  // This might be more reliable than onInputSelectionEnd
  // Note: onKeyDown fires BEFORE the key is inserted, so we use setTimeout to check after insertion
  if (debug()) console.log("[Autocorrect] Registering onKeyDown...");
  try {
    logseq.App.onKeyDown(async (e: any) => {
    try {
      // Only process space and Enter (word boundaries)
      if (!e || (e.key !== " " && e.key !== "Enter")) return;
      
      if (!logseq.settings?.enabled) return;

      // Wait a tick for the key to be inserted into the editor
      setTimeout(async () => {
        try {
          const editing = await logseq.Editor.checkEditing();
          if (!editing) return;

          const content = await logseq.Editor.getEditingBlockContent();
          // Ensure content is a string (Logseq might return null)
          if (!content || typeof content !== 'string') return;

          // Get cursor position first
          const pos = await getCursorPos();
          if (pos === null || pos === 0) return;

          // Check character at cursor position (or before it if at boundary)
          const checkChar = pos > 0 ? content[pos - 1] : content[pos];
          if (!shouldTrigger(checkChar)) return;

          const block = (await logseq.Editor.getCurrentBlock()) as BlockEntity | null;
          if (!block?.uuid) return;
          
          // Use cached rules (no rebuild needed!)
          const checkPos = pos > 0 ? pos - 1 : pos;
          const replaced = replaceWordBeforeCursor(content, checkPos, cachedRules);
          if (!replaced || !replaced.newText || typeof replaced.newText !== 'string') return;

          if (debug()) console.log("[Autocorrect] Replacing via onKeyDown:", replaced);
          markCorrection(block.uuid, replaced.newText); // Mark corrected content to prevent duplicate processing
          await logseq.Editor.updateBlock(block.uuid, replaced.newText);
          // Only restore cursor if position changed (length difference)
          if (replaced.newCursorPos !== pos) {
            await logseq.Editor.restoreEditingCursor();
          }
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
  
  // Slow polling fallback - checks for editor remounts and processes autocorrect if DOM failed
  // Slow polling fallback setup (no log needed - runs on every load)
  let pollingInterval: any = null;
  
  let pollCount = 0;
  async function slowPollingCheck() {
    pollCount++;
    // Only log occasionally to avoid spam
    if (debug() && pollCount % 20 === 0) {
      console.log("[Autocorrect] Polling: Active, count:", pollCount, "DOM bound:", domListenersBound, "interval:", pollIntervalMs, "ms");
    }
    
    try {
      // Check if editor remounted (try to rebind DOM listeners)
      if (!domListenersBound || !editorElement) {
        const bound = bindEditorListeners();
        if (bound && debug()) {
          console.log("[Autocorrect] Polling: DOM listeners rebound");
        }
      } else {
        // Verify editor element still exists
        try {
          const doc = (window.parent || window).document;
          if (doc && !doc.contains(editorElement)) {
            // Editor remounted, rebind
            if (debug()) console.log("[Autocorrect] Polling: Editor remounted, rebinding listeners");
            domListenersBound = false;
            editorElement = null;
            bindEditorListeners();
          }
        } catch (e) {
          // DOM access failed, continue with polling fallback
        }
      }

      // Process autocorrect as fallback (even if DOM is bound, polling acts as backup)
      // This ensures we catch cases where DOM events don't fire
      const editing = await logseq.Editor.checkEditing();
      if (!editing) return;

      const content = await logseq.Editor.getEditingBlockContent();
      if (!content || typeof content !== 'string') return;

      // Skip if same block and no change (early exit before expensive calls)
      if (lastBlockUuid) {
        if (content === lastContent) {
          // No change, skip
          return;
        }
        // Content changed - update lastContent
        lastContent = content;
      } else {
        // First time or new block - get block UUID (cache it)
        const block = (await logseq.Editor.getCurrentBlock()) as BlockEntity | null;
        if (!block?.uuid) return;
        lastBlockUuid = block.uuid;
        lastContent = content;
        return; // New block, wait for next poll
      }

      // Get cursor position to check character at cursor (not just last char)
      const pos = await getCursorPos();
      if (pos === null) return;

      // Check character at cursor position (or before it if at boundary)
      const checkChar = pos > 0 ? content[pos - 1] : content[pos];
      if (!shouldTrigger(checkChar)) return;

      // Get block UUID only when we need it (for updateBlock)
      let block: BlockEntity | null = null;
      if (lastBlockUuid) {
        block = (await logseq.Editor.getCurrentBlock()) as BlockEntity | null;
        if (!block || block.uuid !== lastBlockUuid) {
          if (block?.uuid) {
            lastBlockUuid = block.uuid;
          } else {
            return;
          }
        }
      } else {
        block = (await logseq.Editor.getCurrentBlock()) as BlockEntity | null;
        if (!block?.uuid) return;
        lastBlockUuid = block.uuid;
      }

      // Use shared autocorrect logic
      const replaced = await processAutocorrect(content, pos, block.uuid);
      if (!replaced) return;

      if (debug()) console.log("[Autocorrect] Polling fallback: Corrected:", replaced.newText.slice(0, 20) + "...");
      markCorrection(block.uuid, replaced.newText); // Mark corrected content to prevent duplicate processing
      await logseq.Editor.updateBlock(block.uuid, replaced.newText);
      // Only restore cursor if position changed (length difference)
      if (replaced.newCursorPos !== pos) {
        await logseq.Editor.restoreEditingCursor();
      }
      lastContent = replaced.newText;
    } catch (error) {
      console.error("[Autocorrect] Error in slow polling:", error);
    }
  }

  // Adaptive polling - faster when editing, slower when idle
  let pollIntervalMs = 3000; // Start with 3 seconds (idle)
  let lastPollHadActivity = false;
  let consecutiveIdlePolls = 0;
  
  async function adaptivePollLoop() {
    try {
      await slowPollingCheck();
      
      // Check if we're actively editing
      const editing = await logseq.Editor.checkEditing().catch(() => false);
      
      if (editing) {
        // Actively editing - poll faster
        if (pollIntervalMs > 500) {
          pollIntervalMs = 500; // 500ms when editing
          console.log("[Autocorrect] Polling: Switched to fast mode (500ms)");
        }
        lastPollHadActivity = true;
        consecutiveIdlePolls = 0;
      } else {
        consecutiveIdlePolls++;
        // If idle for a while, slow down
        if (consecutiveIdlePolls > 3 && pollIntervalMs < 3000) {
          pollIntervalMs = 3000; // Back to 3s when idle
          console.log("[Autocorrect] Polling: Switched to slow mode (3000ms)");
        }
      }
    } catch (error) {
      console.error("[Autocorrect] Error in adaptive polling:", error);
    } finally {
      pollingInterval = setTimeout(adaptivePollLoop, pollIntervalMs);
    }
  }
  
  // Start adaptive polling
  pollingInterval = setTimeout(adaptivePollLoop, pollIntervalMs);
  if (debug()) console.log(`[Autocorrect] Adaptive polling started (initial: ${pollIntervalMs}ms)`);
  
  // Try to bind DOM listeners immediately
  setTimeout(() => {
    const bound = bindEditorListeners();
    if (bound && debug()) {
      console.log("[Autocorrect] DOM listeners bound on startup");
    } else if (debug()) {
      console.log("[Autocorrect] DOM listeners not available, using polling fallback");
    }
  }, 1000); // Wait 1s for editor to be ready
  
  if (debug()) console.log("[Autocorrect] Plugin initialized, event handlers registered");

  // Optional: command to re-load rules (useful if user edited settings)
  // Note: On plugin reload, Logseq may log "already exist" warnings - these are harmless
  try {
    logseq.App.registerCommandPalette(
      { key: "autocorrect-reload", label: "Autocorrect: Reload rules" },
      async () => {
        baseSafe = {}; // Force reload
        const loadedBase = await loadDictionary();
        const cached = await loadCachedRemoteRules();
        baseSafe = loadedBase;
        base = loadedBase;
        remote = cached;
        baseLoaded = true;
        rebuildRules(baseSafe, remote);
        logseq.UI.showMsg("Autocorrect rules reloaded");
      }
    );
  } catch (e: any) {
    // Ignore "already exists" errors on plugin reload (Logseq logs these internally, but they're harmless)
    if (e?.message && !e.message.includes("already exist")) {
      console.error("[Autocorrect] Failed to register reload command:", e);
    }
  }

  // Commands removed:
  // - "Autocorrect: Test plugin" - removed
  // - "Autocorrect: Add word to personal rules" - removed (modal issues)
  // Users can manually add rules via Settings → Personal Rules
}

logseq.ready(main).catch(console.error);
