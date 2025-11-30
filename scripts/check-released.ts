import { $ } from "bun";

// 1. Run git diff using Bun Shell
// .text() automatically awaits the stream and returns a string
const diffOutput = await $`git diff --name-only HEAD~1 HEAD`.text();

// 2. Filter lines to find modified package.json files in /apps/
const releasedApps = diffOutput
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line.startsWith("apps/") && line.endsWith("package.json"))
  .map((line) => line.split("/")[1]); // Extract 'cloudprint' from 'apps/cloudprint/package.json'

// Remove duplicates using a Set
const uniqueApps = [...new Set(releasedApps)];

console.log(`🚀 Detected release bumps for: ${JSON.stringify(uniqueApps)}`);

// 3. Write to GitHub Actions Output
// We check if running in GH Actions environment to avoid errors locally
if (process.env.GITHUB_OUTPUT) {
  const outputString = `released=${JSON.stringify(uniqueApps)}\n`;
  
  // You can use Bun's file writer, or even the Shell to append!
  // This is the clean Bun way:
  await Bun.write(process.env.GITHUB_OUTPUT, outputString);
} 