const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const readmePath = path.join(root, manifest.readme || "README.md");
const readme = fs.readFileSync(readmePath, "utf8");

const requiredSections = [
  ["简体中文说明", "## 简体中文"],
  ["English documentation", "## English"],
  ["Tencent COS image upload feature", "Tencent COS"],
  ["图片操作说明", "图片操作"],
];
const missing = requiredSections.filter(([, marker]) => !readme.includes(marker));
if (missing.length) {
  throw new Error(`Marketplace README is missing: ${missing.map(([label]) => label).join(", ")}`);
}

console.log(`Marketplace documentation verified: ${path.relative(root, readmePath)}`);
