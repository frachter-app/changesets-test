import { $ } from "bun";
import * as fs from "node:fs";
import { readdir } from "node:fs/promises";

// 1. Get the list of ALL apps by scanning the 'apps/' directory
// This replaces the hardcoded list ["cloudprint", "frachter"]
const allAppsEntries = await readdir("apps", { withFileTypes: true });
const allApps = allAppsEntries
  .filter((dirent) => dirent.isDirectory())
  .map((dirent) => dirent.name)
  .sort(); // Alphabetical order for the table

// 2. Get the list of CHANGED apps in this PR
// We check the diff against origin/main
const diffOutput = await $`git diff --name-only origin/main...HEAD`.text();

const changedApps = diffOutput
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line.startsWith("apps/") && line.endsWith("package.json"))
  .map((line) => line.split("/")[1]);

const changedAppsSet = new Set(changedApps);

// 3. Generate Markdown Report
let markdown = "### 🚀 Release Preview\n\n";

if (changedAppsSet.size === 0) {
  markdown += "No app version bumps detected. Nothing will deploy.";
} else {
  markdown += "| App | Status | Waits For |\n";
  markdown += "| :--- | :--- | :--- |\n";

  for (const app of allApps) {
    // Dynamic Logic:
    // 1. Is it the backend?
    const isBackend = app === "backend";
    
    // 2. What does it wait for? (Your rule: Apps wait for backend)
    // If it's backend, it waits for nothing. If it's an app, it waits for backend.
    const dependencies = isBackend ? "-" : "backend";

    // 3. Status Check
    const isChanged = changedAppsSet.has(app);
    const status = isChanged ? "🟢 **Will Deploy**" : "⚪ Skipped";
    
    // Bold the app name if it's changing
    const appName = isChanged ? `**${app}**` : app;

    markdown += `| ${appName} | ${status} | ${dependencies} |\n`;
  }
}

// 4. Output to GitHub Actions
if (process.env.GITHUB_OUTPUT) {
    const delimiter = `EOF-${Date.now()}`;
    const output = `comment<<${delimiter}\n${markdown}\n${delimiter}\n`;
    fs.appendFileSync(process.env.GITHUB_OUTPUT, output);
} else {
    // Local testing
    console.log(markdown);
}