/**
 * One-shot script: rename branding + generate locale message files.
 * Run: node scripts/generate-locales.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { translations } from "./locale-translations.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, "..", "src", "_locales");

const LANG_LABELS = {
  en: "English",
  es: "Español",
  fr: "Français",
  pt: "Português",
  ru: "Русский",
  ja: "日本語",
  de: "Deutsch",
  ko: "한국어",
  it: "Italiano",
  id: "Bahasa Indonesia",
  tr: "Türkçe",
  pl: "Polski",
  uk: "Українська",
  nl: "Nederlands",
  vi: "Tiếng Việt",
  th: "ไทย",
  ar: "العربية",
  cl: "Español (Chile)",
  he: "עברית",
  hi: "हिन्दी",
  mx: "Español (México)",
  zh_CN: "中文(简体)",
  zh_TW: "中文(繁體)",
};

/** Native language names shown in each locale's language picker */
const LANGUAGE_KEYS = {
  language_en: LANG_LABELS.en,
  language_es: LANG_LABELS.es,
  language_fr: LANG_LABELS.fr,
  language_pt: LANG_LABELS.pt,
  language_ru: LANG_LABELS.ru,
  language_ja: LANG_LABELS.ja,
  language_de: LANG_LABELS.de,
  language_ko: LANG_LABELS.ko,
  language_it: LANG_LABELS.it,
  language_id: LANG_LABELS.id,
  language_tr: LANG_LABELS.tr,
  language_pl: LANG_LABELS.pl,
  language_uk: LANG_LABELS.uk,
  language_nl: LANG_LABELS.nl,
  language_vi: LANG_LABELS.vi,
  language_th: LANG_LABELS.th,
  language_ar: LANG_LABELS.ar,
  language_cl: LANG_LABELS.cl,
  language_he: LANG_LABELS.he,
  language_hi: LANG_LABELS.hi,
  language_mx: LANG_LABELS.mx,
  language_zh_cn: LANG_LABELS.zh_CN,
  language_zh_tw: LANG_LABELS.zh_TW,
};

const brandName = "BookmarkMars Assistant";
const brandShort = "BM Assistant";
const brandWeb = "BookmarkMars";

function toMessages(flat) {
  const out = {};
  for (const [k, v] of Object.entries(flat)) {
    out[k] = { message: v };
  }
  return out;
}

/** Brand only message values — never rename JSON keys */
function brandMessageValue(text) {
  if (typeof text !== "string") return text;
  return text
    .replace(/Bookmarkearth helper/gi, brandName)
    .replace(/bookmarkearth heper/gi, brandName)
    .replace(/Bookmarkearth/gi, brandWeb)
    .replace(/mine_bookmarkearth_helper_/g, "mine_bookmarkmars_assistant_")
    .replace(/^BE helper$/g, brandShort);
}

function brandMessages(messages) {
  const out = {};
  for (const [key, val] of Object.entries(messages)) {
    out[key] = {
      ...val,
      message: brandMessageValue(val.message),
    };
  }
  return out;
}

function brandChineseMessages(messages, pairs) {
  const out = {};
  for (const [key, val] of Object.entries(messages)) {
    let msg = val.message;
    for (const [from, to] of pairs) {
      msg = msg.split(from).join(to);
    }
    out[key] = { ...val, message: msg };
  }
  return out;
}

function writeLocale(code, messages) {
  const dir = path.join(localesDir, code);
  fs.mkdirSync(dir, { recursive: true });
  const ordered = { ...messages };
  for (const [k, v] of Object.entries(toMessages(LANGUAGE_KEYS))) {
    ordered[k] = v;
  }
  fs.writeFileSync(path.join(dir, "messages.json"), JSON.stringify(ordered, null, 4) + "\n", "utf8");
  console.log("Wrote", code, Object.keys(ordered).length, "keys");
}

function toFlat(messages) {
  const flat = {};
  for (const [k, v] of Object.entries(messages)) {
    flat[k] = v.message;
  }
  return flat;
}

// English: restore branding on values only
const enRaw = JSON.parse(fs.readFileSync(path.join(localesDir, "en", "messages.json"), "utf8"));
const enBranded = brandMessages(enRaw);
enBranded.extension_name = { message: brandName };
enBranded.extension_short_name = { message: brandShort };
enBranded.extension_official_web = { message: brandWeb };
writeLocale("en", enBranded);

const enFlat = toFlat(enBranded);

// Chinese locales
const zhCN = brandChineseMessages(
  JSON.parse(fs.readFileSync(path.join(localesDir, "zh_CN", "messages.json"), "utf8")),
  [
    ["书签地球助手", "书签火星助手"],
    ["书签地球", "书签火星"],
  ]
);
zhCN.extension_name = { message: "书签火星助手" };
zhCN.extension_short_name = { message: "书签助手" };
zhCN.extension_official_web = { message: "书签火星" };
writeLocale("zh_CN", zhCN);

const zhTW = brandChineseMessages(
  JSON.parse(fs.readFileSync(path.join(localesDir, "zh_TW", "messages.json"), "utf8")),
  [
    ["書籤地球助手", "書籤火星助手"],
    ["書籤地球", "書籤火星"],
  ]
);
zhTW.extension_name = { message: "書籤火星助手" };
zhTW.extension_short_name = { message: "書籤助手" };
zhTW.extension_official_web = { message: "書籤火星" };
writeLocale("zh_TW", zhTW);

// Other locales from translation packs (keys stay identical to English)
const newLocales = ["es", "fr", "pt", "ru", "ja", "de", "ko", "it", "id", "tr", "pl", "uk", "nl", "vi", "th", "ar", "cl", "he", "hi", "mx"];

for (const code of newLocales) {
  const pack = translations[code] || {};
  const flat = { ...enFlat };
  for (const [k, v] of Object.entries(pack)) {
    // Never allow pack to invent renamed keys; only overlay known keys
    if (Object.prototype.hasOwnProperty.call(flat, k) || k.startsWith("language_")) {
      flat[k] = v;
    }
  }
  // Ensure pack-provided keys that exist in English about_* etc. are applied even if we filtered wrong
  for (const [k, v] of Object.entries(pack)) {
    if (enRaw[k] || enBranded[k]) {
      flat[k] = v;
    }
  }
  writeLocale(code, toMessages(flat));
}

console.log("Done.");
