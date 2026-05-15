import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Source: existing old plugin directory
const sourceDir = "E:/Work/onlyoffice.github.io/sdkjs-plugins/content/ai";
const configPath = path.join(sourceDir, "config.json");

// GUID is derived from <old>/config.json — kept here as a literal for clarity
const PLUGIN_GUID = "{9DC93CDB-B576-4F0C-B55E-FCC9C48DD007}";

const defaultTargetPath =
  process.platform === "win32"
    ? path.join(
        process.env.USERPROFILE || "",
        "AppData/Local/ONLYOFFICE/DesktopEditors/data/sdkjs-plugins"
      )
    : path.join(
        process.env.HOME || "~",
        "Library/Application Support/asc.onlyoffice.ONLYOFFICE/data/sdkjs-plugins"
      );

const customPath = process.argv[2] || defaultTargetPath;
const targetDir = path.join(customPath, PLUGIN_GUID);

let originalConfigText = null;

function bumpVersion() {
  originalConfigText = fs.readFileSync(configPath, "utf-8");
  const config = JSON.parse(originalConfigText);
  config.version = "99.999.999";
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
  console.log("Temporarily set config.json version to 99.999.999");
}

function restoreVersion() {
  if (originalConfigText !== null) {
    fs.writeFileSync(configPath, originalConfigText);
    console.log("Restored original config.json");
    originalConfigText = null;
  }
}

function copyDirectory(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  for (const item of fs.readdirSync(src)) {
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function removeDirectory(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
    console.log(`Removed existing directory: ${dirPath}`);
  }
}

if (!fs.existsSync(sourceDir)) {
  console.error(`Error: Source plugin directory not found: ${sourceDir}`);
  process.exit(1);
}

const targetParent = path.dirname(targetDir);
if (!fs.existsSync(targetParent)) {
  fs.mkdirSync(targetParent, { recursive: true });
}

console.log("Starting docs plugin deploy...");
console.log(`Platform: ${process.platform}`);
console.log(`Source:   ${sourceDir}`);
console.log(`Target:   ${targetDir}`);

try {
  bumpVersion();

  if (fs.existsSync(targetDir)) {
    removeDirectory(targetDir);
  }

  console.log("\nCopying plugin to user-data dir...");
  copyDirectory(sourceDir, targetDir);

  restoreVersion();

  console.log("\nDeploy completed.");
  console.log(`Plugin available at: ${targetDir}`);
  console.log(
    "Restart DesktopEditor; user-data copy with version 99.999.999 overrides bundled."
  );
} catch (error) {
  try {
    restoreVersion();
  } catch {
    // ignore cleanup error
  }
  console.error("Error during deploy:", error);
  process.exit(1);
}
