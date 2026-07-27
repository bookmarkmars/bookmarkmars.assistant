/**
 * Generate Chrome Web Store promotional images for all locales.
 *
 * Outputs (per language under store-assets/<lang>/):
 *   screenshot-1-newtab.png   1280x800
 *   screenshot-2-splash.png   1280x800
 *   screenshot-3-manage.png   1280x800
 *   small-promo.png           440x280
 *   marquee-promo.png         1400x560
 *
 * Usage (Node 14+):
 *   node scripts/generate-store-assets.mjs
 *   node scripts/generate-store-assets.mjs en zh_CN
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const localesDir = path.join(root, "src", "_locales");
const outRoot = path.join(root, "store-assets");
const htmlDir = path.join(outRoot, "_html");
const logoPath = path.join(root, "src", "media", "img", "logo", "logo-128.png");

const EDGE_CANDIDATES = [
  "C:\\\\Program Files (x86)\\\\Microsoft\\\\Edge\\\\Application\\\\msedge.exe",
  "C:\\\\Program Files\\\\Microsoft\\\\Edge\\\\Application\\\\msedge.exe",
  "C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe",
  "C:\\\\Program Files (x86)\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe",
];

const RTL = new Set(["ar", "he"]);

const GO_LABEL = {
  en: "go",
  es: "ir",
  fr: "go",
  pt: "ir",
  ru: "го",
  ja: "開始",
  de: "go",
  ko: "시작",
  it: "vai",
  id: "go",
  tr: "git",
  pl: "ok",
  uk: "го",
  nl: "go",
  vi: "đi",
  th: "ไป",
  ar: "انطلق",
  cl: "ir",
  he: "קדימה",
  hi: "जाएँ",
  mx: "ir",
  zh_CN: "开始",
  zh_TW: "開始",
};

const SEARCH_ENGINE = {
  zh_CN: "百度",
  zh_TW: "Google",
  ja: "Google",
  ko: "Google",
  ru: "Google",
  ar: "Google",
  he: "Google",
  hi: "Google",
  th: "Google",
  default: "GOOGLE",
};

const MANAGEMENT = {
  en: "Management",
  es: "Gestión",
  fr: "Gestion",
  pt: "Gestão",
  ru: "Управление",
  ja: "管理",
  de: "Verwaltung",
  ko: "관리",
  it: "Gestione",
  id: "Manajemen",
  tr: "Yönetim",
  pl: "Zarządzanie",
  uk: "Керування",
  nl: "Beheer",
  vi: "Quản lý",
  th: "การจัดการ",
  ar: "الإدارة",
  cl: "Gestión",
  he: "ניהול",
  hi: "प्रबंधन",
  mx: "Gestión",
  zh_CN: "管理",
  zh_TW: "管理",
};

function findBrowser() {
  for (const p of EDGE_CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function loadLocale(lang) {
  const file = path.join(localesDir, lang, "messages.json");
  const messages = JSON.parse(fs.readFileSync(file, "utf8"));
  const g = (key, fallback = "") => (messages[key] && messages[key].message) || fallback;
  return {
    lang,
    rtl: RTL.has(lang),
    name: g("extension_name", "BookmarkMars Assistant"),
    shortName: g("extension_short_name", "BM Assistant"),
    bookmarks: g("header_bookmarks", "Bookmarks"),
    filter: g("sidebar_filter", "Filter"),
    setting: g("manage_menu_setting", "Settings"),
    management: MANAGEMENT[lang] || MANAGEMENT.en,
    go: GO_LABEL[lang] || GO_LABEL.en,
    searchEngine: SEARCH_ENGINE[lang] || SEARCH_ENGINE.default,
    logoDataUri: "file:///" + logoPath.replace(/\\/g, "/"),
  };
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function baseStyles(w, h, rtl) {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: ${w}px; height: ${h}px; overflow: hidden;
      background: #4a4a4a;
      font-family: "Segoe UI", "Noto Sans", "Microsoft YaHei", "PingFang SC",
        "Hiragino Sans", "Apple Color Emoji", "Noto Color Emoji", sans-serif;
      direction: ${rtl ? "rtl" : "ltr"};
    }
    .outline {
      color: #f2f2f2;
      -webkit-text-stroke: 1.5px #1a1a1a;
      text-shadow: 2px 2px 0 rgba(0,0,0,.35);
      font-weight: 800;
      letter-spacing: 0.02em;
    }
    .bubble {
      color: #2b2b2b;
      -webkit-text-stroke: 2px #1a1a1a;
      font-weight: 900;
      font-family: "Segoe UI Black", "Arial Black", "Segoe UI", sans-serif;
    }
  `;
}

function layoutNewtab(t, w, h) {
  const scale = Math.min(w / 1280, h / 800);
  const searchW = Math.round(720 * scale);
  const searchH = Math.round(88 * scale);
  const tile = Math.round(150 * scale);
  const gap = Math.round(28 * scale);
  const fontSearch = Math.round(42 * scale);
  const fontTile = Math.round(64 * scale);
  const tiles = ["G", "B", "M", "a", "···", "···"];
  return `<!DOCTYPE html><html lang="${t.lang}"><head><meta charset="utf-8">
  <style>${baseStyles(w, h, t.rtl)}
    body { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:${Math.round(56 * scale)}px; }
    .search {
      width:${searchW}px; height:${searchH}px; background:#d8d8d8; border-radius:${Math.round(18 * scale)}px;
      display:flex; align-items:center; justify-content:space-between; padding:0 ${Math.round(28 * scale)}px;
    }
    .search .label { font-size:${fontSearch}px; }
    .search .icon { width:${Math.round(36 * scale)}px; height:${Math.round(36 * scale)}px; border:3px solid #333; border-radius:50%; position:relative; }
    .search .icon:after {
      content:""; position:absolute; width:${Math.round(14 * scale)}px; height:3px; background:#333;
      right:-${Math.round(8 * scale)}px; bottom:-${Math.round(2 * scale)}px; transform:rotate(45deg);
    }
    .grid { display:grid; grid-template-columns:repeat(3, ${tile}px); gap:${gap}px; }
    .tile {
      width:${tile}px; height:${tile}px; background:#d8d8d8; border-radius:${Math.round(16 * scale)}px;
      display:flex; align-items:center; justify-content:center; font-size:${fontTile}px;
    }
  </style></head><body>
    <div class="search"><span class="bubble label">${esc(t.searchEngine)}</span><span class="icon"></span></div>
    <div class="grid">${tiles.map((x) => `<div class="tile bubble">${esc(x)}</div>`).join("")}</div>
  </body></html>`;
}

function layoutSplash(t, w, h) {
  const scale = Math.min(w / 1280, h / 800);
  const titleSize = Math.round((t.name.length > 22 ? 56 : 72) * scale);
  const btn = Math.round(78 * scale);
  const goSize = Math.round((t.go.length > 3 ? 22 : 28) * scale);
  return `<!DOCTYPE html><html lang="${t.lang}"><head><meta charset="utf-8">
  <style>${baseStyles(w, h, t.rtl)}
    body { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:${Math.round(40 * scale)}px; padding:40px; }
    .title {
      font-size:${titleSize}px; text-align:center; max-width:90%; line-height:1.25;
      color: transparent; -webkit-text-stroke: ${Math.max(1, Math.round(2 * scale))}px #ffffff;
      text-shadow: none; font-weight: 700;
    }
    .go {
      width:${btn}px; height:${btn}px; border-radius:50%; background:#2ec4c6;
      box-shadow: 0 0 ${Math.round(24 * scale)}px rgba(255,255,255,.55), 0 0 ${Math.round(8 * scale)}px rgba(46,196,198,.8);
      display:flex; align-items:center; justify-content:center;
      color:#fff; font-size:${goSize}px; font-weight:700; letter-spacing:0.02em;
    }
  </style></head><body>
    <div class="title">${esc(t.name)}</div>
    <div class="go">${esc(t.go)}</div>
  </body></html>`;
}

function layoutManage(t, w, h) {
  const scale = Math.min(w / 1280, h / 800);
  const side = Math.round(360 * scale);
  const titleSize = Math.round((t.name.length > 20 ? 42 : 52) * scale);
  const sideTitle = Math.round(36 * scale);
  const logo = Math.round(96 * scale);
  return `<!DOCTYPE html><html lang="${t.lang}"><head><meta charset="utf-8">
  <style>${baseStyles(w, h, t.rtl)}
    body { display:flex; }
    .side {
      width:${side}px; height:100%; background:#3f3f3f; display:flex; flex-direction:column;
      ${t.rtl ? "border-left" : "border-right"}: 1px solid #2f2f2f;
    }
    .search {
      margin:${Math.round(18 * scale)}px; height:${Math.round(36 * scale)}px; background:#2f2f2f; border-radius:8px;
      display:flex; align-items:center; justify-content:flex-end; padding:0 12px;
    }
    .search .icon { width:14px; height:14px; border:2px solid #bbb; border-radius:50%; position:relative; }
    .search .icon:after { content:""; position:absolute; width:8px; height:2px; background:#bbb; right:-6px; bottom:-2px; transform:rotate(45deg); }
    .nav { padding: 0 ${Math.round(22 * scale)}px ${Math.round(12 * scale)}px; }
    .nav .item { font-size:${Math.round(28 * scale)}px; margin-bottom:${Math.round(8 * scale)}px; }
    .panel {
      flex:1; margin:${Math.round(10 * scale)}px; background:#ececec; border-radius:4px;
      display:flex; align-items:center; justify-content:center;
    }
    .panel .label { font-size:${sideTitle}px; color:#222; -webkit-text-stroke:1px #111; font-weight:800; text-align:center; padding:12px; }
    .main {
      flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:${Math.round(28 * scale)}px; padding:24px;
    }
    .main .brand {
      font-size:${titleSize}px; text-align:center; max-width:92%; line-height:1.2;
    }
    .main img { width:${logo}px; height:${logo}px; border-radius:50%; background:#222; object-fit:contain; }
  </style></head><body>
    <aside class="side">
      <div class="search"><span class="icon"></span></div>
      <div class="nav">
        <div class="item outline">${esc(t.management)}</div>
        <div class="item outline">${esc(t.filter)}</div>
      </div>
      <div class="panel"><div class="label outline">${esc(t.bookmarks)}</div></div>
    </aside>
    <section class="main">
      <div class="brand outline">${esc(t.name)}</div>
      <img src="${t.logoDataUri}" alt="logo" />
    </section>
  </body></html>`;
}

function layoutSmall(t, w, h) {
  const scale = Math.min(w / 440, h / 280);
  const titleSize = Math.round((t.name.length > 18 ? 28 : 34) * scale);
  const logo = Math.round(56 * scale);
  return `<!DOCTYPE html><html lang="${t.lang}"><head><meta charset="utf-8">
  <style>${baseStyles(w, h, t.rtl)}
    body { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:${Math.round(16 * scale)}px; padding:16px; }
    img { width:${logo}px; height:${logo}px; border-radius:50%; background:#222; object-fit:contain; }
    .title {
      font-size:${titleSize}px; text-align:center; line-height:1.2; max-width:92%;
      color: transparent; -webkit-text-stroke: 1.2px #fff; font-weight:700;
    }
    .sub { color:#cfcfcf; font-size:${Math.round(14 * scale)}px; }
  </style></head><body>
    <img src="${t.logoDataUri}" alt="logo" />
    <div class="title">${esc(t.name)}</div>
    <div class="sub">bookmarkmars.com</div>
  </body></html>`;
}

function layoutMarquee(t, w, h) {
  const scale = Math.min(w / 1400, h / 560);
  const titleSize = Math.round((t.name.length > 22 ? 48 : 60) * scale);
  const logo = Math.round(140 * scale);
  const btn = Math.round(72 * scale);
  return `<!DOCTYPE html><html lang="${t.lang}"><head><meta charset="utf-8">
  <style>${baseStyles(w, h, t.rtl)}
    body {
      display:flex; align-items:center; justify-content:center; gap:${Math.round(48 * scale)}px;
      padding: 0 ${Math.round(64 * scale)}px;
    }
    .left { display:flex; flex-direction:column; gap:${Math.round(22 * scale)}px; max-width:65%; }
    .title {
      font-size:${titleSize}px; line-height:1.2;
      color: transparent; -webkit-text-stroke: ${Math.max(1, Math.round(2 * scale))}px #fff; font-weight:700;
    }
    .row { display:flex; align-items:center; gap:${Math.round(18 * scale)}px; }
    .go {
      width:${btn}px; height:${btn}px; border-radius:50%; background:#2ec4c6;
      box-shadow: 0 0 18px rgba(255,255,255,.5); color:#fff; font-weight:700;
      display:flex; align-items:center; justify-content:center; font-size:${Math.round(22 * scale)}px;
    }
    .hint { color:#ddd; font-size:${Math.round(22 * scale)}px; }
    img { width:${logo}px; height:${logo}px; border-radius:50%; background:#222; object-fit:contain; }
  </style></head><body>
    <div class="left">
      <div class="title">${esc(t.name)}</div>
      <div class="row"><div class="go">${esc(t.go)}</div><div class="hint">bookmarkmars.com</div></div>
    </div>
    <img src="${t.logoDataUri}" alt="logo" />
  </body></html>`;
}

const ASSETS = [
  { id: "screenshot-1-newtab", w: 1280, h: 800, render: layoutNewtab },
  { id: "screenshot-2-splash", w: 1280, h: 800, render: layoutSplash },
  { id: "screenshot-3-manage", w: 1280, h: 800, render: layoutManage },
  { id: "small-promo", w: 440, h: 280, render: layoutSmall },
  { id: "marquee-promo", w: 1400, h: 560, render: layoutMarquee },
];

function screenshot(browser, htmlFile, pngFile, w, h) {
  const fileUrl = "file:///" + htmlFile.replace(/\\/g, "/");
  // Edge/Chrome headless screenshot captures the viewport
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    `--window-size=${w},${h}`,
    `--screenshot=${pngFile}`,
    `--default-background-color=00000000`,
    fileUrl,
  ];
  const result = spawnSync(browser, args, { encoding: "utf8", timeout: 60000 });
  if (result.error) {
    throw result.error;
  }
  if (!fs.existsSync(pngFile)) {
    // fallback older headless flag
    const args2 = [
      "--headless",
      "--disable-gpu",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      `--window-size=${w},${h}`,
      `--screenshot=${pngFile}`,
      fileUrl,
    ];
    const r2 = spawnSync(browser, args2, { encoding: "utf8", timeout: 60000 });
    if (!fs.existsSync(pngFile)) {
      throw new Error(`Screenshot failed for ${pngFile}\n${result.stderr || ""}\n${r2.stderr || ""}`);
    }
  }
}

function main() {
  const browser = findBrowser();
  if (!browser) {
    console.error("No Chrome/Edge found for headless screenshots.");
    process.exit(1);
  }
  console.log("Browser:", browser);

  const allLangs = fs.readdirSync(localesDir).filter((d) =>
    fs.existsSync(path.join(localesDir, d, "messages.json"))
  );
  const only = process.argv.slice(2);
  const langs = only.length ? allLangs.filter((l) => only.includes(l)) : allLangs;

  fs.mkdirSync(htmlDir, { recursive: true });
  fs.mkdirSync(outRoot, { recursive: true });

  let ok = 0;
  for (const lang of langs.sort()) {
    const t = loadLocale(lang);
    const langOut = path.join(outRoot, lang);
    fs.mkdirSync(langOut, { recursive: true });
    console.log(`\n[${lang}] ${t.name}`);

    for (const asset of ASSETS) {
      const html = asset.render(t, asset.w, asset.h);
      const htmlFile = path.join(htmlDir, `${lang}-${asset.id}.html`);
      const pngFile = path.join(langOut, `${asset.id}.png`);
      fs.writeFileSync(htmlFile, html, "utf8");
      screenshot(browser, htmlFile, pngFile, asset.w, asset.h);
      const size = fs.statSync(pngFile).size;
      console.log(`  ✓ ${asset.id}.png (${asset.w}x${asset.h}, ${Math.round(size / 1024)}KB)`);
      ok++;
    }
  }

  // index readme
  const readme = `# BookmarkMars Assistant — Chrome Web Store assets

Generated: ${new Date().toISOString()}
Languages: ${langs.join(", ")}

Per language folder:
- screenshot-1-newtab.png   (1280×800) — New Tab search + shortcuts
- screenshot-2-splash.png   (1280×800) — Brand splash + CTA
- screenshot-3-manage.png   (1280×800) — Management UI
- small-promo.png           (440×280)  — Small promotional tile
- marquee-promo.png         (1400×560) — Marquee promotional tile

Regenerate:
\`\`\`
node scripts/generate-store-assets.mjs
node scripts/generate-store-assets.mjs en zh_CN
\`\`\`
`;
  fs.writeFileSync(path.join(outRoot, "README.md"), readme, "utf8");
  console.log(`\nDone. ${ok} images → ${outRoot}`);
}

main();
