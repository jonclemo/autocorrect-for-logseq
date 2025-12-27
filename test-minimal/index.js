require("@logseq/libs");

function main() {
  logseq.App.showMsg("Minimal test plugin loaded successfully!");
  console.log("Minimal test plugin initialized");
}

logseq.ready(main).catch(console.error);

