# BookmarkMars Assistant — New Tab Redesign Design Document

**Status:** Implementation in progress  
**Date:** 2026-11-02 (updated same day)  
**Scope:** New Tab Page (NTP) + remote navigation config  
**Repos:** `bookmarkmars.assistant` (client) · `bookmarkchina` (server)  
**Default UI language:** English (`default_locale: en`; catalog base titles in English)

---

## 1. Goal

Redesign the new tab so it feels modern and useful worldwide, while:

1. **Keeping** existing BookmarkMars value (bookmarks side panel / magical ball / sync / manage) — NTP is a better surface, not a new product.
2. **Adding** richer NTP features (categories, better layout, selected WeTab/iTab-like modules that work globally).
3. **Keeping operator control** of default shortcuts so affiliate / partner links can be injected and updated from the server.
4. **Staying policy-safe** on Chrome Web Store / Edge Add-ons (single purpose + Search API).
5. **Simplifying config:** kill custom search engines; fix navigation config strategy (remote + cache, clear schema versioning).

Visual style and pixel comps will be ground together later; this doc locks product/architecture decisions first.

---

## 2. Current state (from code)

### 2.1 NTP surface today

| Area | Implementation | Notes |
|------|----------------|-------|
| Hero | Clock + date + greeting | `new_tab.html` / `new_tab.js` |
| Search | Form + engine picker path | Chrome/Edge already use `chrome.search.query` when `"search"` permission exists |
| Shortcuts | Flat grid `#grid` | From `n/links` (sync storage) |
| Top bar | Bookmarks + Ucenter avatar | `top_urls.js` |
| Wallpaper | Server `bebeauty` + local fallbacks | `operate.js` |
| Edit | Overlay: drag / toggle / custom add | `popup.js` |

### 2.2 Navigation data flow today

```
Server: settings/plugin/navigation.conf
        ↓  POST /plugin/api/remote/cache  {name:"navigation"}
Background: cache into storage key "navigation"
        ↓
NTP grid.js: getValue("navigation")
        → if miss: n/topLinks cache
        → if miss: bundled media/conf/navigation.json
        → merge into n/links (user selection + cloud sync)
```

Flat item shape (v1):

```json
{
  "title": "谷歌",
  "url": "https://www.google.com/",
  "icon": "https://www.google.com/favicon.ico",
  "selected": true,
  "fixed": true,
  "remove": false,
  "origin": 1,
  "weight": 0,
  "lang": { "en": { "title": "Google" }, "...": {} }
}
```

`origin: 1` = server catalog · `origin: 0` = user-added  
`fixed` = cannot uncheck / lock  
Cloud backup: `user/shortcuts/save|load` into `n/links`

### 2.3 Search engine config today

- Bundled `search_engine.json` + remote `search_engine` cache
- Engine picker UI still exists for non-ChromeSearch builds
- **Policy:** Chrome/Edge store builds must not offer custom search engines

### 2.4 Pain points

- Flat shortcut list does not scale (no categories).
- Three-layer fallback (remote → topLinks → bundled file) is hard to reason about and drifts from server.
- Search-engine stack is mostly dead weight for CWS/Edge after Option A.
- Layout feels thin vs WeTab/iTab (users expect modules, not only icons).

---

## 3. Product principles

1. **Single purpose for store listing:** Bookmark assistant. NTP = bookmark dashboard + optional convenience modules that still serve “find / open / organize links,” not a second product (search hijack, unrelated games wall, etc.).
2. **Operator owns the default catalog.** Users personalize (hide, reorder, add custom); they do not own partner URLs.
3. **Worldwide first.** Features copied from iTab/WeTab must have a global data source or client-only logic. No China-only APIs unless gated by region and optional.
4. **Offline-tolerant.** First paint from last good cache; network refresh in background.
5. **Schema-versioned remote config.** Never silently break old clients; never keep forever-dual configs without an end date.

---

## 4. Proposed NTP information architecture

Wireframe (conceptual — not final art):

```
┌─────────────────────────────────────────────────────────────┐
│  [Bookmarks]                                   [Avatar]     │  top chrome
├─────────────────────────────────────────────────────────────┤
│                                                             │
│              14:32                                          │  hero
│              Monday, Nov 2 · Good afternoon                 │
│                                                             │
│         ┌───────────────────────────────┐                   │
│         │  Search (browser default)  🔍 │                   │  chrome.search only
│         └───────────────────────────────┘                   │
│                                                             │
│   ○ Google  ○ YouTube  ○ ChatGPT  ▢ Shop  ○ …             │  icons + folder tiles
│                                                             │
│   [ Calendar ] [ Memo ]                                     │  optional Phase B strip
│                                                             │
│                              ⚙ wallpaper · edit             │  floating tools
└─────────────────────────────────────────────────────────────┘
```

### 4.1 Keep (must not regress)

- Clock / date / greeting  
- Browser-default search via Search API (Chrome/Edge)  
- Shortcut open / favicon / drag reorder / custom add  
- Server-controlled fixed / selected defaults  
- Cloud shortcut backup when logged in  
- Wallpaper cycle + upload  
- Entry to bookmark manager + ucenter  
- Side panel / magical ball / manage pages (outside NTP redesign, unchanged)

### 4.2 Remove / retire

| Item | Why |
|------|-----|
| Custom search engine picker (all platforms) | Policy + one codebase (locked) |
| `search_engine` remote cache + `search_engine.json` | Dead after Search API |
| Bundled `navigation.json` as long-term source of truth | Drift vs server; see §6 |
| Empty-submit jump to search-engine homepage | Search API path |

### 4.3 Add (phased)

**Phase A — layout + categories (this redesign core)**  
- Category tabs or category rows for shortcuts  
- Cleaner hero / search / grid spacing  
- Better empty / loading / offline states  
- Edit UI that edits **per category**  
- Affiliate-safe catalog fields (see §5)

**Phase B — modules from iTab (locked)**

| # | Circled in iTab | Copy as | Global plan | Status |
|---|-----------------|---------|-------------|--------|
| ~~1~~ | ~~Weather~~ | — | — | **Removed** (2026-11-02) |
| 2 | Desk calendar | **Calendar widget** | Client-local date math; no Chinese lunar in global default | In |
| 3 | 备忘录 | **Notes / memo** | Local storage (optional cloud when logged in) | In |
| 4 | Media toolbox | **Tool link group** | Links only — not a real converter; server-controlled URLs | In |
| 5 | App folder | **Shortcut folder** | Folder tiles in the shortcut grid | In |

**Phase B = 4 modules:** Calendar, Memo, Tool link group, Shortcut folder.

**Explicitly out:** Weather, Baidu search picker, hot trends, countdown, left sidebar, China app dock.

**Placement (chosen):** compact optional strip **under** the shortcut grid (default). Users can hide modules; they do **not** pin widgets into the icon grid (keeps the grid simple).

---

## 5. Shortcut / affiliate control model

### 5.1 Two layers (keep the mental model)

| Layer | Who owns URL | Storage | Sync |
|-------|--------------|---------|------|
| **Catalog** | You (server) | Remote navigation config → merged into `n/links` rows with `origin: 1` | Push updates on weight/title/icon/**url** |
| **Personal** | User | `origin: 0` rows + selection/order | Cloud `shortcuts/save|load` |

### 5.2 Affiliate rules

- Partner / affiliate links live **only** in catalog (`origin: 1`), never as “user” rows.
- Server may change `url` for a catalog id without waiting for user action.
- User may **hide** (`selected: false`) a catalog item unless `fixed: true`.
- User may **not** edit catalog URL (only custom rows).
- **Disclosure:** keep the current footnote only (“Some links may earn us a commission”) — **no** per-tile affiliate badges.
- Optional new fields for ops:

```json
{
  "id": "shop_amazon",
  "url": "https://…affiliate…",
  "affiliate": true,
  "campaign": "2026Q4-amazon",
  "markets": ["global", "us", "uk"]
}
```

`markets` lets one config serve global defaults with regional overrides later without forking the whole product.

### 5.3 Categories UX (chosen)

**Folder tiles only** — closest to today’s simple icon grid.

- No thin tab strip under search by default.  
- A category from `navigation_v2` can appear as a **folder tile** (2×2 preview) in the same grid as normal shortcuts.  
- Click folder → overlay to open sites; **Organize** to rename, reorder, eject (× → home grid), add from home / custom URL.  
- **Drag a home-grid shortcut onto a folder tile** to nest it; in Shortcut edit, drag a row onto a folder row.  
- **Add folder** from Shortcut edit (⚙ → Edit shortcut).  
- Nested `type:"folder"` + `children[]` persist in `n/links` and cloud `user/shortcuts/save|load`.  
- Schema still has `categories[]` for server ops; UI does not expose a left rail or tab bar.

### 5.4 Catalog schema v2 (server)

Proposed catalog schema v2 (server):  
**Base titles in English**; `lang` overrides for other locales (including `zh_CN`).

```json
{
  "schemaVersion": 2,
  "updatedAt": "2026-11-02T00:00:00Z",
  "categories": [
    {
      "id": "default",
      "title": "Pinned",
      "weight": 0,
      "lang": { "zh_CN": { "title": "常用" } },
      "children": [
        {
          "id": "google",
          "title": "Google",
          "url": "https://www.google.com/",
          "icon": "https://www.google.com/favicon.ico",
          "selected": true,
          "fixed": true,
          "remove": false,
          "origin": 1,
          "weight": 0,
          "affiliate": false,
          "lang": { "zh_CN": { "title": "谷歌" } }
        }
      ]
    },
    {
      "id": "shop",
      "title": "Shop",
      "weight": 20,
      "lang": { "zh_CN": { "title": "购物" } },
      "children": [ /* affiliate-capable items */ ]
    }
  ]
}
```

Client merge rules (same spirit as today):

1. Match catalog items by stable `id` (prefer) or normalized URL (fallback for migration).  
2. Apply server title / icon / url / fixed / lang onto existing `origin: 1` rows.  
3. Do not re-inject catalog URLs the user removed after cloud sync (`shortcutsSyncTime` set) — keep current protection.  
4. User custom items stay in a synthetic category `custom` or “My links”.

---

## 6. Config strategy (locked)

### 6.1 Dual configures then delete the old one — **Accepted**

| Approach | Verdict |
|----------|---------|
| Dual publish, then delete v1 | **Accepted** |
| Two permanent files forever | Reject |
| Break old clients immediately | Reject |

**Rollout (locked):**

1. Server publishes:
   - `navigation` → **v1 flat** for old clients  
   - `navigation_v2` → categorized schema for new client  
2. New client only requests `navigation_v2`.  
3. **Sunset: 30 days** after new version ships, then delete `navigation` + stop caching it.  
4. Optionally regenerate v1 from v2 (flatten) during the window so you edit once.

### 6.2 Remove local configure; cache remote — **Accepted**

```
Remote (source of truth)
   ↓ refresh in background
chrome.storage cache (last good payload)  ← first paint
   ↓ only if never fetched
Bundled seed: 5–8 hard-coded global icons (no affiliates)
```

| Layer | Keep? | Role |
|-------|-------|------|
| Server `navigation_v2` | Yes | Source of truth |
| Extension storage cache | Yes | Offline / fast start |
| Bundled full `navigation.json` | **No (remove)** | Causes drift |
| Tiny emergency seed (5–8 globals, **no affiliates**) | **Yes (chosen)** | First install / total offline only |

`search_engine.json` / remote `search_engine`: **delete** for **all** builds (Chrome, Edge, 360, compatible) — one codebase, Search API / browser default only.

### 6.3 Cache key cleanup

| Key | Purpose |
|-----|---------|
| `navigation_v2` | Last remote catalog JSON |
| `n/links` | Merged user+catalog rows (or evolve to `n/shortcutState`) |
| `n/topLinks` | **Deprecate** |
| `search_engine` | **Remove** |
| `u/shortcutsSyncTime` | Keep |
| `imageCache` (local) | Favicon data URLs — see §6.4 |

### 6.4 Favicon / icon cache (offline-first) — **new requirement**

**Problem:** Catalog and shortcuts often store `icon: "https://…/favicon.ico"`. Offline (or blocked CDN), `<img src="https://…">` breaks even if we already fetched that icon before.

**Policy (locked):**

1. **Display path:** always prefer **cached data URL (base64 / PNG data URL)** from `imageCache` (existing `bg/image.js` local storage) before any remote `http(s)` icon URL.  
2. **On successful fetch:** write/update `imageCache` keyed by page URL (and optionally by icon URL).  
3. **Online miss:** race remote providers as today, then cache.  
4. **Offline miss:** letter / title fallback (already in `getFavicon`) — never leave a broken image.  
5. **`n/links` in sync storage:** still **do not** persist large base64 into sync (8KB limit). Keep remote URL in `n/links.icon` for identity; **render** from `imageCache` / `getFavicon`.  
6. **NTP grid / folders / tool groups:** all icon rendering goes through the same helper so offline behavior is consistent.

---

## 7. Chrome / Edge policy guardrails

Already aligned / reinforce in redesign:

1. NTP search → `chrome.search.query` + `"search"` permission only.  
2. No search-engine chooser, no custom query URL UI on store builds.  
3. Listing / description stay **bookmark-focused**; NTP described as bookmark dashboard.  
4. Optional modules (weather, notes) must not turn the product into “unrelated feature pile.” Prefer modules that help open or organize links.  
5. If a module is risky for single-purpose, ship it as **optional** and hide by default — or put it in a separate extension later.

---

## 8. Client / server work split

### 8.1 `bookmarkchina` (server)

- Add `navigation_v2.conf` (+ admin edit path if you edit conf files today).  
- Keep serving `navigation` (v1) until sunset date.  
- Stop requiring `search_engine` for global plugin (can leave file unused).  
- Optional: `markets` / `campaign` fields for affiliate ops.  
- `/plugin/api/remote/cache` accepts `navigation_v2`.

### 8.2 `bookmarkmars.assistant` (client)

- NTP layout redesign (HTML/SCSS/JS).  
- Category-aware grid + edit overlay.  
- Fetch/cache `navigation_v2` only.  
- Remove search-engine conf + dead UI paths on chrome/edge builds.  
- Migration: on first run of new version, map flat `n/links` → categorized state; assign `categoryId` from v2 match by URL/`id`.  
- Preserve cloud shortcut sync semantics.

---

## 9. Migration plan for existing users

1. User upgrades extension.  
2. Client reads old `n/links` (flat).  
3. Client loads `navigation_v2`.  
4. Matching catalog URLs get `id` + `categoryId`; customs go to `custom`.  
5. Order within category preserved as much as possible.  
6. Cloud backup continues to store the merged personalization payload (extend JSON carefully; old server endpoints may need a version field or accept unknown fields).

**Risk:** `chrome.storage.sync` 8KB/item limit — already noted in code (no base64 icons). Categories add a bit of metadata; keep payload lean (ids + selected + order, not full lang maps).

---

## 10. Visual direction — **keep the current simple style**

### 10.1 North star (your current NTP screenshot)

The existing BookmarkMars NTP is the style target, not iTab’s dense widget wall:

```
[ Bookmarks ]                          [ Avatar ]

                 15:45
           MONDAY, NOVEMBER 2
        ● Good afternoon — stay curious

            [  Type something…  🔍 ]

         ○ ○ ○ ○ ○
         ○ ○ ○ ○

                                    ⚙
```

**What to preserve from today’s look**

| Keep | Why |
|------|-----|
| Full-bleed wallpaper as the stage | Atmosphere first |
| Centered clock → date → short greeting | One calm hero |
| One pill search bar (no engine logo) | Policy + simplicity |
| Icon grid with short labels | Fast scan |
| Sparse top-right chrome (Bookmarks + avatar) | Quiet |
| Small bottom-right tools | Doesn’t fight the hero |
| Warm orange accent only (greeting dot / focus) | Brand without clutter |

**What iTab must NOT become for us**

| Avoid | Why |
|-------|-----|
| Left category icon rail | Feels like a second app shell |
| Wall of colored widget cards in the first viewport | Breaks “simple” |
| Multi-search engine chip | Policy + visual noise |
| Hot trends / China dock as default | Not global; crowded |

### 10.2 How new functions fit without killing simplicity

Principle: **add capability, not chrome.**

1. **First viewport stays almost as today** — wallpaper, clock, search, shortcuts.  
2. **Categories** as a thin tab row or folder tiles *inside* the shortcut area — not a left sidebar.  
3. **Phase B widgets** (weather / calendar / memo / tool group / folder) are:
   - **optional** (user can hide),
   - **secondary** (below shortcuts or in a single compact row),
   - **same glass language** as search (frosted, low contrast), not loud iTab card skins (red calendar / yellow memo / blue weather blocks).  
4. Max **one** accent color. Widget headers stay neutral.  
5. If a module needs more UI, open a light overlay — don’t grow the home canvas.

Proposed calm layout (still simple):

```
[ Bookmarks ]                          [ Avatar ]

                 15:45
           MONDAY, NOVEMBER 2
        ● Good afternoon — stay curious

            [  Type something…  🔍 ]

         ○ ○ ○ ○ ▢folder                 ← shortcuts + folder tiles (categories)
         ○ ○ ○ ○

   [ calendar ] [ memo ]                 ← optional Phase B strip (no weather)
                                    ⚙
```

### 10.3 Style tokens (draft)

- Background: user wallpaper, full bleed  
- Surfaces: dark glass ~same as current search pill  
- Text: white / soft white labels  
- Accent: Mars orange (~`#e07a3d`) for focus + greeting only  
- Radius: large pill for search; rounded squares for icons  
- Motion: 2–3 subtle only (hover, category fade, clock)

Deliverables for next design grind:

1. Desktop mock that still reads as “today’s NTP + light additions”  
2. Same mock with Phase B strip shown / hidden  
3. Edit-shortcuts modal (categories + folders)  
4. Confirm widget visual language = glass, not iTab colored cards  

---

## 11. Decision log (locked 2026-11-02)

| Topic | Decision |
|-------|----------|
| Weather widget | **Removed** from Phase B |
| Default language | **English** (UI + catalog base titles) |
| Favicon offline | **Prefer cached data URL** over remote `http(s)` icon |
| Dual navigation configs | **Accept** — v1 + v2, then delete v1 |
| Categories UX | **Folder tiles only** (chosen — closest to current simplicity) |
| Affiliate disclosure | **Keep original** footnote only |
| Emergency seed | **5–8 hard-coded globals, no affiliates** (chosen) |
| `navigation` v1 sunset | **30 days** |
| Phase B placement | **Compact strip under shortcuts** (chosen); no pin-into-grid |
| Phase B modules | Calendar, Memo, Tool link group, Shortcut folder (**4**) |
| #4 toolbox | **Link group only** |
| 360 / compatible search | **Drop** custom search — one codebase |
| Visual style | Keep current simple NTP |

---

## 12. Recommended decisions (summary)

| Topic | Decision |
|-------|----------|
| Visual style | Keep current simple NTP; iTab = feature reference only |
| Language | English default |
| Local `navigation.json` as truth | Remove; remote + storage cache + tiny seed |
| Dual server configs | `navigation` + `navigation_v2`, delete v1 after **30 days** |
| `search_engine` | Remove for **all** platforms |
| Categories UI | Folder tiles only |
| Icons offline | `imageCache` data URL first |
| Phase B | Calendar, Memo, Tool links, Folders — strip under grid |
| Code now? | **No** — next = visual mocks, then implement |

---

## 13. Next steps

1. Visual mocks that still look like your current NTP (simple) + folder tiles + Phase B strip.  
2. Freeze `navigation_v2` schema + English base catalog sample.  
3. Implement in small PRs: favicon offline path → config/v2 → NTP shell/folders → drop search_engine → Phase B modules.
