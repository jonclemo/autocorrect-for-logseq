// Shim to make @logseq/libs available as a global import
// Logseq provides logseq globally, so we just need to make it available
// This file is injected by esbuild to replace @logseq/libs imports

export const logseq = globalThis.logseq;

