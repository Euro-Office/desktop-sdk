import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.join(__dirname, "..", "dist-docs");
const targetDir = path.join(
  "E:/Work/onlyoffice.github.io/sdkjs-plugins/content/ai",
  "scripts",
  "agent"
);

function rmrf(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  for (const item of fs.readdirSync(src)) {
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

if (!fs.existsSync(distDir)) {
  console.error(
    "Error: dist-docs directory not found. Run `npm run build:docs` first."
  );
  process.exit(1);
}

try {
  console.log(`\nCleaning target: ${targetDir}`);
  rmrf(targetDir);

  console.log("Copying dist-docs → target...");
  copyRecursive(distDir, targetDir);

  console.log("\nInject completed successfully.");
} catch (error) {
  console.error("Error during inject:", error);
  process.exit(1);
}
