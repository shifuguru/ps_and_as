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

// Ensure asset URLs work on GitHub Pages project sites (https://user.github.io/repo-name/)
html = html.replace(/(href|src)=(['"])\/(?!\/)/g, `$1=$2${basePath}/`);
html = html.replace(
  new RegExp(`(href|src)=(['"])${basePath}//`, 'g'),
  `$1=$2${basePath}/`,
);

fs.writeFileSync(buildIndex, html, 'utf8');

// GitHub Pages serves 404.html for unknown routes — copy for SPA deep links
fs.copyFileSync(buildIndex, path.join(buildDir, '404.html'));

console.log(`Prepared web-build for GitHub Pages (base: ${basePath}).`);
