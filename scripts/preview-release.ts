import { $, file } from "bun";
import * as fs from "node:fs";
import { readdir } from "node:fs/promises";

// 1. Get the list of ALL apps
const allAppsEntries = await readdir("apps", { withFileTypes: true });
const allApps = allAppsEntries
  .filter((dirent) => dirent.isDirectory())
  .map((dirent) => dirent.name)
  .sort();

// 2. Get the list of CHANGED apps in this PR
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
  markdown += "| App | Status | Version | Waits For |\n";
  markdown += "| :--- | :--- | :--- | :--- |\n";

  for (const app of allApps) {
    const isBackend = app === "backend";
    const dependencies = isBackend ? "-" : "backend";
    const isChanged = changedAppsSet.has(app);
    
    let status = "⚪ Skipped";
    let versionDisplay = "-";
    let appName = app;

    if (isChanged) {
      status = "🟢 **Will Deploy**";
      appName = `**${app}**`;

      // READ THE NEW VERSION
      try {
        const pkgPath = `apps/${app}/package.json`;
        const pkg = await file(pkgPath).json();
        versionDisplay = `**v${pkg.version}**`;
      } catch (e) {
        versionDisplay = "⚠️ Err";
      }
    }

    markdown += `| ${appName} | ${status} | ${versionDisplay} | ${dependencies} |\n`;
  }
}

// 4. Output to GitHub Actions
if (process.env.GITHUB_OUTPUT) {
    const delimiter = `EOF-${Date.now()}`;
    const output = `comment<<${delimiter}\n${markdown}\n${delimiter}\n`;
    fs.appendFileSync(process.env.GITHUB_OUTPUT, output);
} else {
    console.log(markdown);
}