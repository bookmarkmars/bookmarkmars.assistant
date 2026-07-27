/**
 * Expand conf lang maps + rename bookmarkearth branding keys in locales/HTML.
 * Run: node scripts/rebrand-and-extend-langs.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

/** Languages that should use English display names/sorting from conf */
const EN_LIKE = [
  "en", "es", "fr", "pt", "ru", "ja", "de", "ko", "it", "id", "tr", "pl", "uk", "nl", "vi", "th", "ar", "he", "hi", "cl", "mx",
];

function expandLangMap(langObj) {
  if (!langObj || !langObj.en) return langObj;
  const out = { ...langObj };
  for (const code of EN_LIKE) {
    if (!out[code]) {
      // Regional Spanish: prefer es if present, else en
      if ((code === "cl" || code === "mx") && out.es) {
        out[code] = { ...out.es };
      } else {
        out[code] = { ...out.en };
      }
    }
  }
  return out;
}

// --- search_engine.json ---
const searchPath = path.join(root, "src/media/conf/search_engine.json");
const search = JSON.parse(fs.readFileSync(searchPath, "utf8"));
if (search.bookmarkearth && !search.bookmarkmars) {
  search.bookmarkmars = search.bookmarkearth;
  delete search.bookmarkearth;
}
for (const [key, obj] of Object.entries(search)) {
  if (obj && obj.lang) {
    obj.lang = expandLangMap(obj.lang);
  }
}
fs.writeFileSync(searchPath, JSON.stringify(search, null, 4) + "\n");
console.log("Updated search_engine.json");

// --- navigation.json ---
const navPath = path.join(root, "src/media/conf/navigation.json");
const nav = JSON.parse(fs.readFileSync(navPath, "utf8"));
if (Array.isArray(nav.children)) {
  for (const child of nav.children) {
    if (child.lang) {
      child.lang = expandLangMap(child.lang);
    }
  }
}
fs.writeFileSync(navPath, JSON.stringify(nav, null, 4) + "\n");
console.log("Updated navigation.json");

// --- Rename i18n keys about_bookmarkearth_* → about_bookmarkmars_* ---
const localesDir = path.join(root, "src/_locales");
for (const locale of fs.readdirSync(localesDir)) {
  const fp = path.join(localesDir, locale, "messages.json");
  if (!fs.existsSync(fp)) continue;
  let text = fs.readFileSync(fp, "utf8");
  const before = text;
  text = text.replace(/about_bookmarkearth_/g, "about_bookmarkmars_");
  if (text !== before) {
    fs.writeFileSync(fp, text);
    console.log("Renamed i18n keys in", locale);
  }
}

console.log("Done.");
