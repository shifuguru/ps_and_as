const fs = require('fs');
const path = require('path');

const buildDir = path.resolve(__dirname, '..', 'web-build');
const buildIndex = path.join(buildDir, 'index.html');
const basePath = (process.env.GITHUB_PAGES_BASE || '/ps_and_as').replace(/\/$/, '');

if (!fs.existsSync(buildIndex)) {
  console.error('web-build/index.html not found; make sure the web build completed successfully.');
  process.exit(1);
}

function rewriteHtmlPaths(html) {
  const basePrefix = `${basePath}/`;
  const doubledPrefix = `${basePath}${basePath}/`;

  // Repair any previously doubled prefixes from older deploys/builds.
  while (html.includes(doubledPrefix)) {
    html = html.split(doubledPrefix).join(basePrefix);
  }

  // Prefix root-absolute asset URLs, but never double-prefix.
  html = html.replace(/(href|src)=(['"])(\/[^'"]*)/g, (match, attr, quote, urlPath) => {
    if (urlPath.startsWith('//')) return match;
    if (urlPath === basePath || urlPath.startsWith(basePrefix)) return match;
    return `${attr}=${quote}${basePath}${urlPath}`;
  });

  return html;
}

function patchViewport(html) {
  const viewport =
    "width=device-width, initial-scale=1, viewport-fit=cover, shrink-to-fit=no";
  if (/name="viewport"/i.test(html)) {
    return html.replace(
      /name="viewport" content="[^"]*"/i,
      `name="viewport" content="${viewport}"`,
    );
  }
  return html.replace(
    "<head>",
    `<head>\n    <meta name="viewport" content="${viewport}" />`,
  );
}

let html = fs.readFileSync(buildIndex, "utf8");
html = rewriteHtmlPaths(html);
html = patchViewport(html);
fs.writeFileSync(buildIndex, html, 'utf8');

// GitHub Pages serves 404.html for unknown routes — copy for SPA deep links.
fs.copyFileSync(buildIndex, path.join(buildDir, '404.html'));

// Prevent Jekyll from stripping or ignoring Expo output folders.
fs.writeFileSync(path.join(buildDir, '.nojekyll'), '', 'utf8');

console.log(`Prepared web-build for GitHub Pages (base: ${basePath}).`);
