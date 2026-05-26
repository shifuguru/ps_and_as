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
    html = html.replace(
      /name="viewport" content="[^"]*"/i,
      `name="viewport" content="${viewport}"`,
    );
  } else {
    html = html.replace(
      "<head>",
      `<head>\n    <meta name="viewport" content="${viewport}" />`,
    );
  }

  const themeColor = '<meta name="theme-color" content="#0f5d2f" />';
  if (/name="theme-color"/i.test(html)) {
    html = html.replace(
      /name="theme-color" content="[^"]*"/i,
      'name="theme-color" content="#0f5d2f"',
    );
  } else {
    html = html.replace("<head>", `<head>\n    ${themeColor}`);
  }

  const appleBar =
    '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />';
  if (/apple-mobile-web-app-status-bar-style/i.test(html)) {
    html = html.replace(
      /name="apple-mobile-web-app-status-bar-style" content="[^"]*"/i,
      'name="apple-mobile-web-app-status-bar-style" content="black-translucent"',
    );
  } else {
    html = html.replace("<head>", `<head>\n    ${appleBar}`);
  }

  const appleCapable =
    '<meta name="apple-mobile-web-app-capable" content="yes" />';
  if (!/apple-mobile-web-app-capable/i.test(html)) {
    html = html.replace("<head>", `<head>\n    ${appleCapable}`);
  }

  const appleTitle =
    '<meta name="apple-mobile-web-app-title" content="P\'s &amp; A\'s" />';
  if (!/apple-mobile-web-app-title/i.test(html)) {
    html = html.replace("<head>", `<head>\n    ${appleTitle}`);
  }

  const manifestHref = `${basePath}/manifest.webmanifest`;
  const manifestLink = `<link rel="manifest" href="${manifestHref}" />`;
  if (!/rel="manifest"/i.test(html)) {
    html = html.replace("<head>", `<head>\n    ${manifestLink}`);
  }

  const touchIcon = `<link rel="apple-touch-icon" href="${basePath}/favicon.ico" />`;
  if (!/rel="apple-touch-icon"/i.test(html)) {
    html = html.replace("<head>", `<head>\n    ${touchIcon}`);
  }

  return html;
}

function writeWebManifest() {
  const manifest = {
    name: "P's & A's",
    short_name: "Ps & As",
    description: "Presidents & Assholes",
    start_url: `${basePath}/`,
    scope: `${basePath}/`,
    display: "standalone",
    background_color: "#0f5d2f",
    theme_color: "#0f5d2f",
    orientation: "portrait",
    icons: [
      {
        src: `${basePath}/favicon.ico`,
        sizes: "48x48",
        type: "image/x-icon",
      },
    ],
  };
  fs.writeFileSync(
    path.join(buildDir, "manifest.webmanifest"),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );
}

let html = fs.readFileSync(buildIndex, "utf8");
html = rewriteHtmlPaths(html);
html = patchViewport(html);
fs.writeFileSync(buildIndex, html, "utf8");
writeWebManifest();

// GitHub Pages serves 404.html for unknown routes — copy for SPA deep links.
fs.copyFileSync(buildIndex, path.join(buildDir, '404.html'));

// Prevent Jekyll from stripping or ignoring Expo output folders.
fs.writeFileSync(path.join(buildDir, '.nojekyll'), '', 'utf8');

console.log(`Prepared web-build for GitHub Pages (base: ${basePath}).`);
