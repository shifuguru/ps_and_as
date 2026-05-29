const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

for (const file of ["readme-fallback.html", "README.md"]) {
  const src = path.join(root, file);
  if (!fs.existsSync(src)) {
    console.warn(`sync-readme-public: skipping missing ${file}`);
    continue;
  }
  fs.copyFileSync(src, path.join(publicDir, file));
  console.log(`sync-readme-public: copied ${file} → public/`);
}
