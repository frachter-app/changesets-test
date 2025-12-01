import { $ } from "bun";
import * as fs from "node:fs";

// --- Helper to write to GitHub Actions Output ---
const writeOutput = (key: string, value: string) => {
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  }
  console.log(`SET OUTPUT: ${key}=${value}`);
};

// --- STEP 1: Check if this is a Release Commit ---
let isRelease = false;

try {
  // Strategy A: Check HEAD^2 (The branch that was merged in)
  // This is specific to "Merge as Merge Commit"
  const parent2Msg = await $`git log -1 --format=%s HEAD^2`.text();
  if (parent2Msg.trim().startsWith("chore: release versions")) {
    console.log("✅ Detected release message in Merge Parent (HEAD^2)");
    isRelease = true;
  }
} catch {
  // Strategy B: Fallback to HEAD (Squash Merge or Direct Push)
  // If HEAD^2 doesn't exist (not a merge commit), this block runs
  const headMsg = await $`git log -1 --format=%s HEAD`.text();
  if (headMsg.trim().startsWith("chore: release versions")) {
    console.log("✅ Detected release message in HEAD");
    isRelease = true;
  }
}

// If it's not a release, output empty/false and exit
if (!isRelease) {
  console.log("🚫 Not a release commit. Skipping.");
  writeOutput("is_release", "false");
  writeOutput("released", "[]");
  process.exit(0);
}

writeOutput("is_release", "true");

// --- STEP 2: Detect Changed Apps ---
// We diff against HEAD~1 (the previous state of main)
const diffOutput = await $`git diff --name-only HEAD~1 HEAD`.text();

const changedApps = diffOutput
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line.startsWith("apps/") && line.endsWith("package.json"))
  .map((line) => line.split("/")[1]);

// Deduplicate
const uniqueApps = [...new Set(changedApps)];

console.log(`🚀 Apps to deploy: ${JSON.stringify(uniqueApps)}`);
writeOutput("released", JSON.stringify(uniqueApps));