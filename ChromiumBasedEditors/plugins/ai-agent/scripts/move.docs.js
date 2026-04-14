import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const sourceDir = path.join(
  __dirname,
  "..",
  "deploy",
  "{8D67F3C0-7654-4BBC-98A2-71342BD73A4E}"
);

const configPath = path.join(sourceDir, "config.json");

// Default path - can be overridden via command line argument
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

// Get target path from command line argument or use default
const customPath = process.argv[2] || defaultTargetPath;
const targetDir = path.join(
  customPath,
  "{8D67F3C0-7654-4BBC-98A2-71342BD73A4E}"
);

// Function to add version to config.json
function addVersion() {
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  config.version = "99.999.999";
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
  console.log("Added version 99.999.999 to config.json");
}

// Function to remove version from config.json
function removeVersion() {
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  delete config.version;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
  console.log("Removed version from config.json");
}

// Function to recursively copy directory
function copyDirectory(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const items = fs.readdirSync(src);

  items.forEach((item) => {
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
    const stat = fs.statSync(srcPath);

    if (stat.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  });
}

// Function to remove directory recursively
function removeDirectory(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
    console.log(`Removed existing directory: ${dirPath}`);
  }
}

// Check if source directory exists
if (!fs.existsSync(sourceDir)) {
  console.error(
    "Error: Source plugin directory not found. Please run build first."
  );
  console.error(`Expected: ${sourceDir}`);
  process.exit(1);
}

// Ensure target parent directory exists
const targetParent = path.dirname(targetDir);
if (!fs.existsSync(targetParent)) {
  console.log(`Creating target directory: ${targetParent}`);
  fs.mkdirSync(targetParent, { recursive: true });
}

console.log("Starting docs plugin move process...");
console.log(`Platform: ${process.platform}`);
console.log(`Source: ${sourceDir}`);
console.log(`Target: ${targetDir}`);

try {
  console.log("\nPreparing config.json...");
  addVersion();

  if (fs.existsSync(targetDir)) {
    console.log("\nRemoving existing plugin directory...");
    removeDirectory(targetDir);
  }

  console.log("\nCopying plugin directory...");
  copyDirectory(sourceDir, targetDir);

  console.log("\nCleaning up config.json...");
  removeVersion();

  console.log("\nDocs plugin moved successfully!");
  console.log(`Plugin is now available at: ${targetDir}`);
} catch (error) {
  try {
    removeVersion();
  } catch {
    // Ignore cleanup errors
  }
  console.error("Error during move process:", error);
  process.exit(1);
}
