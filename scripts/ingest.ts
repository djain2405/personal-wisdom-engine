/**
 * Local knowledge scan helper.
 *
 * Drop .md / .txt / .pdf anywhere under knowledge/ (subfolders optional),
 * then Sync in the UI.
 */

import fs from "fs";
import path from "path";

const root = path.join(process.cwd(), "knowledge");
const SUPPORTED = new Set([".md", ".txt", ".pdf", ".markdown"]);

function walk(dir: string, acc: string[] = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (SUPPORTED.has(path.extname(entry.name).toLowerCase())) {
      acc.push(full);
    }
  }
  return acc;
}

const files = walk(root);
console.log("Personal Wisdom Engine — knowledge scan");
console.log(`Root: ${root}`);
console.log(`Supported: ${[...SUPPORTED].join(", ")}`);
console.log(`Files found: ${files.length}`);
for (const f of files) {
  console.log(` - ${path.relative(root, f)}`);
}
console.log(
  "\nTo process: open /knowledge → Sync knowledge",
);
