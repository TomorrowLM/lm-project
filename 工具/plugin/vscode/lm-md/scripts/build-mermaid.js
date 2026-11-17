const { build } = require("esbuild");

build({
  entryPoints: ["scripts/mermaid-entry.js"],
  bundle: true,
  minify: true,
  format: "iife",
  platform: "browser",
  target: ["chrome121"],
  legalComments: "eof",
  outfile: "media/mermaid.bundle.js",
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
