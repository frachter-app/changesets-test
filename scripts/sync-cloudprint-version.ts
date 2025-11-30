import { file, write, $ } from "bun";
import * as path from "node:path";

const ROOT = path.resolve(__dirname, "..");

// --- CONFIGURATION ---
const APP_NAME = "cloudprint"; // Directory name under apps/
const APP_ROOT = path.resolve(ROOT, `apps/${APP_NAME}`);

const PATHS = {
  packageJson: `${APP_ROOT}/package.json`,
  // Tauri specific paths
  cargoToml: `${APP_ROOT}/src-tauri/Cargo.toml`,
  tauriConf: `${APP_ROOT}/src-tauri/tauri.conf.json`,
  // Directory where Cargo commands must run
  rustRoot: `${APP_ROOT}/src-tauri` 
};

console.log(`🔄 Syncing version for ${APP_NAME}...`);

// 1. Get the Source of Truth (package.json)
const pkgFile = file(PATHS.packageJson);
const pkg = await pkgFile.json();
const newVersion = pkg.version;

if (!newVersion) {
  console.error(`❌ No version found in ${PATHS.packageJson}`);
  process.exit(1);
}
console.log(`📍 New Version: ${newVersion}`);

// 2. Sync Cargo.toml
const cargoFile = file(PATHS.cargoToml);
let cargoContent = await cargoFile.text();

// Regex: Look for 'version = "..."' specifically inside the [package] block.
// Note: This simple regex assumes 'version' is near the top or standard format.
const cargoRegex = /(^version\s*=\s*")([^"]+)(")/m;

if (cargoContent.match(cargoRegex)) {
  cargoContent = cargoContent.replace(cargoRegex, `$1${newVersion}$3`);
  await write(PATHS.cargoToml, cargoContent);
  console.log(`✅ Updated Cargo.toml`);
} else {
  console.warn(`⚠️ Could not find version key in Cargo.toml`);
}

// 3. Sync tauri.conf.json
// Tauri v1 puts version in "package.version", Tauri v2 puts it in "version"
const tauriFile = file(PATHS.tauriConf);
if (await tauriFile.exists()) {
  const tauriConf = await tauriFile.json();

  let updated = false;

  // Handle Tauri v1 structure
  if (tauriConf.package && tauriConf.package.version) {
    tauriConf.package.version = newVersion;
    updated = true;
  } 
  // Handle Tauri v2 structure (top-level version)
  else if (tauriConf.version) {
    tauriConf.version = newVersion;
    updated = true;
  }

  if (updated) {
    await write(PATHS.tauriConf, JSON.stringify(tauriConf, null, 2));
    console.log(`✅ Updated tauri.conf.json`);
  } else {
    console.warn(`⚠️ Could not find version field in tauri.conf.json`);
  }
}

// 4. Update Cargo.lock
// We must run 'cargo check' INSIDE the src-tauri directory so it finds the correct manifest
console.log("🦀 Refreshing Cargo.lock...");

try {
  // cwd: changes the directory to src-tauri just for this command
  await $`cargo check`.cwd(PATHS.rustRoot); 
  console.log(`✅ Cargo.lock updated in ${PATHS.rustRoot}`);
} catch (error) {
  console.error("❌ Failed to update Cargo.lock. Check if Rust is installed.", error);
  process.exit(1);
}

console.log("✨ Sync complete.");