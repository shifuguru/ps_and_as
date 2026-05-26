const fs = require('fs');
const path = require('path');

const buildDir = path.resolve(__dirname, '..', 'web-build');
const buildIndex = path.join(buildDir, 'index.html');
const basePath = (process.env.GITHUB_PAGES_BASE || '/ps_and_as').replace(/\/$/, '');

if (!fs.existsSync(buildIndex)) {
  console.error('web-build/index.html not found; make sure the web build completed successfully.');
  process.exit(1);
}

let html = fs.readFileSync(buildIndex, 'utf8');
const basePrefix = `${basePath}/`;

// Expo may already emit /repo-name/... when app.json experiments.baseUrl is set.
// Only rewrite root-absolute paths that are not already under basePath.
const alreadyPrefixed =
  html.includes(`${basePrefix}_expo/`) ||
  html.includes(`href="${basePrefix}`) ||
  html.includes(`src="${basePrefix}`);

if (!alreadyPrefixed) {
  html = html.replace(/(href|src)=(['"])\/(?!\/)/g, `$1=$2${basePrefix}`);
}

fs.writeFileSync(buildIndex, html, 'utf8');

// GitHub Pages serves 404.html for unknown routes — copy for SPA deep links
fs.copyFileSync(buildIndex, path.join(buildDir, '404.html'));

console.log(
  alreadyPrefixed
    ? `web-build already uses base path ${basePath}; copied 404.html only.`
    : `Prepared web-build for GitHub Pages (base: ${basePath}).`,
);
