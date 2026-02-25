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
  "{9DC93CDB-B576-4F0C-B55E-FCC9C48DD777}"
);

const configPath = path.join(sourceDir, "config.json");

// Default path - can be overridden via command line argument
const defaultTargetPath = path.join(
  process.env.HOME || "~",
  "Library/Application Support/asc.onlyoffice.ONLYOFFICE/data/sdkjs-plugins"
);

// Get target path from command line argument or use default
const customPath = process.argv[2] || defaultTargetPath;
const targetDir = path.join(
  customPath,
  "{9DC93CDB-B576-4F0C-B55E-FCC9C48DD777}"
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
  // Create destination directory if it doesn't exist
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

console.log("Starting plugin move process...");
console.log(`Source: ${sourceDir}`);
console.log(`Target: ${targetDir}`);

try {
  // Add version to config.json before move
  console.log("\nPreparing config.json...");
  addVersion();

  // Remove existing target directory if it exists
  if (fs.existsSync(targetDir)) {
    console.log("\nRemoving existing plugin directory...");
    removeDirectory(targetDir);
  }

  // Copy plugin directory to target location
  console.log("\nCopying plugin directory...");
  copyDirectory(sourceDir, targetDir);

  // Remove version from config.json after move
  console.log("\nCleaning up config.json...");
  removeVersion();

  console.log("\nPlugin moved successfully!");
  console.log(`Plugin is now available at: ${targetDir}`);
} catch (error) {
  // Ensure version is removed even if error occurs
  try {
    removeVersion();
  } catch {
    // Ignore cleanup errors
  }
  console.error("Error during move process:", error);
  process.exit(1);
}
