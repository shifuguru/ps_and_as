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

function patchExpoReset(html) {
  const reset = `<style id="expo-reset">
      /* Patched for iOS PWA — shell sizing owned by web-shell.css + JS (--app-shell-h) */
      html,
      body {
        margin: 0;
        padding: 0;
        width: 100%;
        overflow: hidden;
        overscroll-behavior: none;
        height: 100%;
      }
      #root {
        display: flex;
        flex-direction: column;
        flex: 1;
        width: 100%;
        height: 100%;
        min-height: 0;
        overflow: hidden;
      }
    </style>`;
  if (/id="expo-reset"/i.test(html)) {
    return html.replace(/<style id="expo-reset">[\s\S]*?<\/style>/i, reset);
  }
  return html.replace("</head>", `  ${reset}\n  </head>`);
}

function patchShellAssets(html, basePath) {
  const cssHref = `${basePath}/web-shell.css`;
  const linkTag = `<link rel="stylesheet" href="${cssHref}" id="ps-web-shell-link" />`;

  html = html.replace(/\s*<style id="ps-web-shell-static">[\s\S]*?<\/style>/i, "");
  html = html.replace(/\s*<link rel="stylesheet" href="[^"]*web-shell\.css"[^>]*>/i, "");

  if (!html.includes('id="ps-web-shell-link"')) {
    html = html.replace("</head>", `  ${linkTag}\n  </head>`);
  }

  return html;
}

function patchViewport(html) {
  const viewport =
    "width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, viewport-fit=cover, user-scalable=no, shrink-to-fit=no";
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

  html = patchExpoReset(html);
  html = patchShellAssets(html, basePath);

  const themeColor = '<meta name="theme-color" content="#0f5132" />';
  if (/name="theme-color"/i.test(html)) {
    html = html.replace(
      /name="theme-color" content="[^"]*"/i,
      'name="theme-color" content="#0f5132"',
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

  const noCache =
    '<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />';
  if (!/http-equiv="Cache-Control"/i.test(html)) {
    html = html.replace("<head>", `<head>\n    ${noCache}`);
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
    background_color: "#0f5132",
    theme_color: "#0f5132",
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

function injectServerUrl(html) {
  const serverUrl = process.env.EXPO_PUBLIC_SERVER_URL?.trim();
  if (!serverUrl) return html;
  const script = `<script>window.__PS_AND_AS_SERVER_URL__=${JSON.stringify(serverUrl)};</script>`;
  if (html.includes("__PS_AND_AS_SERVER_URL__")) return html;
  return html.replace("<head>", `<head>\n    ${script}`);
}

function readPackageVersion() {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "..", "package.json"), "utf8"),
    );
    return typeof pkg.version === "string" ? pkg.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function readCodename(version) {
  try {
    const text = fs.readFileSync(
      path.resolve(__dirname, "..", "src/config/buildCodenames.ts"),
      "utf8",
    );
    const re = new RegExp(
      `"${String(version).replace(/\./g, "\\.")}"\\s*:\\s*"([^"]+)"`,
    );
    const match = text.match(re);
    return match ? match[1] : undefined;
  } catch {
    return undefined;
  }
}

function resolveBuildMeta() {
  const version =
    process.env.EXPO_PUBLIC_APP_VERSION?.trim() || readPackageVersion();
  const buildId =
    process.env.EXPO_PUBLIC_BUILD_ID?.trim() ||
    process.env.GITHUB_SHA?.trim()?.slice(0, 12) ||
    `local-${Date.now()}`;
  const builtAt = new Date().toISOString();
  const codename = readCodename(version);
  const channel =
    process.env.DEPLOY_CHANNEL?.trim() === "development"
      ? "development"
      : "production";
  return { version, buildId, builtAt, codename, channel };
}

function writeVersionJson(meta) {
  const payload = {
    version: meta.version,
    buildId: meta.buildId,
    builtAt: meta.builtAt,
    channel: meta.channel,
    ...(meta.codename ? { codename: meta.codename } : {}),
  };
  fs.writeFileSync(
    path.join(buildDir, "version.json"),
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf8",
  );
  console.log(
    `Wrote version.json (${meta.version}${meta.codename ? ` · ${meta.codename}` : ""}, ${meta.buildId})`,
  );
}

function injectEarlyShellHeight(html) {
  const script = `<script>
(function(){
  function isStandalone(){
    try{
      if(window.navigator&&window.navigator.standalone) return true;
      return !!(window.matchMedia&&window.matchMedia("(display-mode: standalone)").matches);
    }catch(e){ return false; }
  }
  function sync(){
    var r=document.documentElement.style;
    if(isStandalone()){
      r.setProperty("--app-shell-h","100lvh");
      r.setProperty("--app-height","100lvh");
      r.setProperty("--app-shell-top","0px");
      return;
    }
    var vv=window.visualViewport;
    var h=Math.max(window.innerHeight,document.documentElement.clientHeight||0);
    if(vv) h=Math.max(h,Math.round(vv.height+(vv.offsetTop||0)));
    h=h+"px";
    r.setProperty("--app-shell-h",h);
    r.setProperty("--app-height",h);
  }
  sync();
  window.addEventListener("resize",sync);
  window.addEventListener("orientationchange",sync);
  window.visualViewport?.addEventListener("resize",sync);
})();
</script>`;
  if (html.includes('setProperty("--app-height"')) return html;
  return html.replace("<head>", `<head>\n    ${script}`);
}

function injectReadmeFallbackBase(html) {
  const assignment = `window.__PS_AND_AS_BASE__=${JSON.stringify(basePath)};`;
  if (html.includes("__PS_AND_AS_BASE__")) {
    return html.replace(
      /window\.__PS_AND_AS_BASE__=window\.__PS_AND_AS_BASE__\|\|"";/,
      assignment,
    );
  }
  const script = `<script>${assignment}</script>`;
  return html.replace("<head>", `<head>\n    ${script}`);
}

function injectBootGuard(html) {
  // sessionStorage-backed attempts + disarm on boot. In-memory counters reset on
  // every location.reload(), so Instagram/FB WebViews that inject failing scripts
  // (or flaky entry loads) used to infinite-refresh.
  const script = `<script data-ps-boot-guard="1">
(function(){
  var base=${JSON.stringify(basePath)};
  var fallback=base+"/readme-fallback.html";
  var KEY="ps_and_as:boot_reloads";
  var maxReloads=3;
  var armed=true;
  function getAttempts(){
    try{return parseInt(sessionStorage.getItem(KEY)||"0",10)||0;}catch(e){return 0;}
  }
  function setAttempts(n){
    try{sessionStorage.setItem(KEY,String(n));}catch(e){}
  }
  function clearAttempts(){
    try{sessionStorage.removeItem(KEY);}catch(e){}
  }
  function toFallback(){
    clearAttempts();
    location.replace(fallback+"?_="+Date.now());
  }
  function isBootScript(src){
    if(!src) return false;
    try{
      var u=new URL(src,location.href);
      if(u.origin!==location.origin) return false;
      var p=u.pathname||"";
      return p.indexOf(base+"/")===0 || p.indexOf("/_expo/")>=0;
    }catch(e){ return false; }
  }
  function retryBoot(){
    if(!armed) return;
    var n=getAttempts();
    if(n>=maxReloads){toFallback();return;}
    setAttempts(n+1);
    setTimeout(function(){location.reload();},700*(n+1));
  }
  function onError(ev){
    if(!armed) return;
    var el=ev.target;
    if(el&&el.tagName==="SCRIPT"&&isBootScript(el.src)) retryBoot();
  }
  window.addEventListener("error",onError,true);
  var timer=window.setTimeout(function(){
    if(!armed) return;
    var root=document.getElementById("root");
    if(!root||!root.firstElementChild) retryBoot();
  },20000);
  window.__PS_AND_AS_CANCEL_BOOT_GUARD__=function(){
    armed=false;
    window.clearTimeout(timer);
    window.removeEventListener("error",onError,true);
    clearAttempts();
  };
})();
</script>`;
  if (
    html.includes("data-ps-boot-guard") ||
    html.includes("__PS_AND_AS_CANCEL_BOOT_GUARD__")
  ) {
    return html.replace(
      /<script(?:\s[^>]*)?>[\s\S]*?__PS_AND_AS_CANCEL_BOOT_GUARD__[\s\S]*?<\/script>/,
      script,
    );
  }
  return html.replace("<body>", `<body>\n    ${script}`);
}

function writePages404() {
  const src = path.resolve(__dirname, "pages-404.html");
  if (!fs.existsSync(src)) {
    console.warn("pages-404.html not found — falling back to index.html for 404");
    fs.copyFileSync(buildIndex, path.join(buildDir, "404.html"));
    return;
  }
  let html = fs.readFileSync(src, "utf8");
  html = rewriteHtmlPaths(html);
  fs.writeFileSync(path.join(buildDir, "404.html"), html, "utf8");
  console.log("Wrote 404.html (app or readme-fallback router).");
}

function injectBuildMeta(html, meta) {
  const script = `<script>window.__PS_AND_AS_BUILD__=${JSON.stringify(meta)};</script>`;
  if (html.includes("__PS_AND_AS_BUILD__")) {
    return html.replace(
      /<script>window\.__PS_AND_AS_BUILD__=[^<]*<\/script>/,
      script,
    );
  }
  return html.replace("<head>", `<head>\n    ${script}`);
}

let html = fs.readFileSync(buildIndex, "utf8");
const buildMeta = resolveBuildMeta();
html = injectServerUrl(html);
html = injectEarlyShellHeight(html);
html = injectBuildMeta(html, buildMeta);
html = injectBootGuard(html);
html = rewriteHtmlPaths(html);
html = patchViewport(html);
fs.writeFileSync(buildIndex, html, "utf8");

const shellCssSrc = path.resolve(__dirname, "..", "web-shell.css");
const shellCssDst = path.join(buildDir, "web-shell.css");
if (fs.existsSync(shellCssSrc)) {
  fs.copyFileSync(shellCssSrc, shellCssDst);
} else {
  console.warn("web-shell.css not found — skipping copy");
}

writeWebManifest();
writeVersionJson(buildMeta);

// GitHub Pages 404 — route to app when live, readme-fallback while updating.
writePages404();

// README fallback — real repo README.md (not a hand-written copy).
const readmeSrc = path.resolve(__dirname, '..', 'README.md');
const readmeFallbackSrc = path.resolve(__dirname, '..', 'readme-fallback.html');
if (fs.existsSync(readmeSrc)) {
  fs.copyFileSync(readmeSrc, path.join(buildDir, 'README.md'));
  console.log('Copied README.md into web-build.');
}
if (fs.existsSync(readmeFallbackSrc)) {
  let fallbackHtml = fs.readFileSync(readmeFallbackSrc, "utf8");
  fallbackHtml = rewriteHtmlPaths(fallbackHtml);
  fallbackHtml = injectReadmeFallbackBase(fallbackHtml);
  fs.writeFileSync(path.join(buildDir, "readme-fallback.html"), fallbackHtml, "utf8");
  console.log("Wrote readme-fallback.html into web-build.");
}

// Prevent Jekyll from stripping or ignoring Expo output folders.
fs.writeFileSync(path.join(buildDir, '.nojekyll'), '', 'utf8');

console.log(`Prepared web-build for GitHub Pages (base: ${basePath}).`);
