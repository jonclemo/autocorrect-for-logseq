require("@logseq/libs");

function main() {
  logseq.App.showMsg("Test V2 loaded!");
}

logseq.ready(main).catch(console.error);

