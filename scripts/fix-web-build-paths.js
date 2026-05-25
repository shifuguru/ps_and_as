const fs = require('fs');
const path = require('path');
const buildIndex = path.resolve(__dirname, '..', 'web-build', 'index.html');

if (!fs.existsSync(buildIndex)) {
  console.error('web-build/index.html not found; make sure the web build completed successfully.');
  process.exit(1);
}

let html = fs.readFileSync(buildIndex, 'utf8');
html = html.replace(/(href|src)=(['"])\//g, '$1=$2./');
fs.writeFileSync(buildIndex, html, 'utf8');
console.log('Fixed web-build/index.html asset paths for relative GitHub Pages hosting.');
