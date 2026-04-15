import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.join(__dirname, "..", "dist-docs");
const targetDir = path.join(
  __dirname,
  "..",
  "deploy",
  "{8D67F3C0-7654-4BBC-98A2-71342BD73A4E}"
);

// Ensure target directory exists
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

function cleanTargetDir(dirPath) {
  const preserveFiles = ["index.html", "chat.html", "config.json"];

  if (!fs.existsSync(dirPath)) return;

  const items = fs.readdirSync(dirPath);

  items.forEach((item) => {
    if (preserveFiles.includes(item)) {
      console.log(`Preserving: ${item}`);
      return;
    }

    const itemPath = path.join(dirPath, item);
    const stat = fs.statSync(itemPath);

    if (stat.isDirectory()) {
      fs.rmSync(itemPath, { recursive: true, force: true });
      console.log(`Removed directory: ${item}`);
    } else {
      fs.unlinkSync(itemPath);
      console.log(`Removed file: ${item}`);
    }
  });
}

function copyFiles(srcDir, destDir) {
  const items = fs.readdirSync(srcDir);

  items.forEach((item) => {
    const srcPath = path.join(srcDir, item);
    const destPath = path.join(destDir, item);

    // Skip Vite-generated HTML stubs — real HTML files live permanently in deploy
    if (item === "docs-plugin.html") {
      console.log(`Skipping: ${item}`);
      return;
    }

    const stat = fs.statSync(srcPath);

    if (stat.isDirectory()) {
      if (!fs.existsSync(destPath)) {
        fs.mkdirSync(destPath, { recursive: true });
      }
      copyFiles(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  });
}

if (!fs.existsSync(distDir)) {
  console.error("Error: dist-docs directory not found. Please run build first.");
  process.exit(1);
}

try {
  console.log("\n🧹 Cleaning target directory...");
  cleanTargetDir(targetDir);

  console.log("\n📁 Copying files...");
  copyFiles(distDir, targetDir);

  console.log("\n✅ Build script completed successfully!");
} catch (error) {
  console.error("❌ Error during build process:", error);
  process.exit(1);
}
