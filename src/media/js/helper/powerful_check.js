($ => {
    "use strict";

    /**
     * On official web pages, lightly probe bookmark outbound URLs and mark broken ones.
     *
     * CPU rules of thumb (learned the hard way on Crypto folders):
     * - at most CONCURRENCY light HEADs in flight (no GET/HTTPS cascade)
     * - never start work on a hidden tab
     * - abort when the user leaves / hides the page
     * - skip famous / darknet / already-checked hosts
     *
     * @param {object} ext
     * @constructor
     */
    $.powerfulCheckHelper = function (ext) {

        const MAX_ALLOW = 20;
        const CONCURRENCY = 3;
        const CHECK_TIMEOUT_MS = 2500;
        const PAUSE_MS = 150;
        const SESSION_TTL_MS = 30 * 60 * 1000;
        const SESSION_KEY = "be_powerful_check_cache_v1";

        let aborted = false;
        let running = false;

        /**
         * @returns {Promise}
         */
        this.init = () => {
            removeInstallExtNotice();
            bindLifecycle();
            scheduleStart();
        };

        const removeInstallExtNotice = () => {
            if (ext.helper.official.isOfficialWeb()) {
                $("body").find("[data-be-notice='ext']").forEach((elm) => {
                    $(elm).remove();
                });
            }
        };

        const bindLifecycle = () => {
            const abort = () => {
                aborted = true;
            };
            window.addEventListener("pagehide", abort, {once: true});
            window.addEventListener("beforeunload", abort, {once: true});
            document.addEventListener("visibilitychange", () => {
                if (document.hidden) {
                    aborted = true;
                }
            });
        };

        const scheduleStart = () => {
            const start = () => {
                if (document.hidden) {
                    // Wait until the tab is visible again (cheap listener).
                    const onVis = () => {
                        if (!document.hidden) {
                            document.removeEventListener("visibilitychange", onVis);
                            void check();
                        }
                    };
                    document.addEventListener("visibilitychange", onVis);
                    return;
                }
                void check();
            };

            if (typeof window.requestIdleCallback === "function") {
                window.requestIdleCallback(start, {timeout: 4000});
            } else {
                setTimeout(start, 1200);
            }
        };

        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

        const readSessionCache = () => {
            try {
                const raw = sessionStorage.getItem(SESSION_KEY);
                if (!raw) {
                    return {};
                }
                const parsed = JSON.parse(raw);
                if (!parsed || typeof parsed !== "object") {
                    return {};
                }
                const now = Date.now();
                const out = {};
                Object.keys(parsed).forEach((k) => {
                    const row = parsed[k];
                    if (row && (now - (row.t || 0)) < SESSION_TTL_MS) {
                        out[k] = row;
                    }
                });
                return out;
            } catch (e) {
                return {};
            }
        };

        const writeSessionCache = (cache) => {
            try {
                sessionStorage.setItem(SESSION_KEY, JSON.stringify(cache));
            } catch (e) {
                // quota / private mode — ignore
            }
        };

        const cacheKey = (url) => {
            try {
                const u = new URL(url);
                return (u.protocol + "//" + u.hostname.toLowerCase() + (u.pathname || "/")).replace(/\/+$/, "");
            } catch (e) {
                return String(url || "").trim().toLowerCase();
            }
        };

        /**
         * Cheap connectivity probe — one HEAD via light mode, not 3 full checks.
         */
        const netWorkIsOk = async () => {
            try {
                const response = await ext.helper.dao.call("checkUrl", {
                    url: "https://www.baidu.com",
                    all: false,
                    light: true,
                    timeout: 2000
                });
                return !!(response && response.httpInfo && response.httpInfo.ok);
            } catch (e) {
                return false;
            }
        };

        const ignoreExt = [
            "mng", "pct", "bmp", "gif", "jpg", "jpeg", "png", "pst", "psp", "tif",
            "tiff", "ai", "drw", "dxf", "eps", "ps", "svg",
            "mp3", "wma", "ogg", "wav", "ra", "aac", "mid", "au", "aiff",
            "3gp", "asf", "asx", "avi", "mov", "mp4", "mpg", "qt", "rm", "swf", "wmv", "m4a",
            "css", "pdf", "doc", "exe", "bin", "rss", "zip", "rar"
        ];

        const validURL = (str) => {
            if (!str || typeof str !== "string") {
                return false;
            }
            try {
                const u = new URL(str.trim());
                if (u.protocol !== "http:" && u.protocol !== "https:") {
                    return false;
                }
                const host = (u.hostname || "").toLowerCase();
                if (!host || host.endsWith(".onion") || host.endsWith(".i2p")) {
                    return false;
                }
                return true;
            } catch (e) {
                return false;
            }
        };

        const pathLooksLikeFile = (url) => {
            try {
                const path = new URL(url).pathname || "";
                const dot = path.lastIndexOf(".");
                if (dot < 0) {
                    return false;
                }
                const extName = path.slice(dot + 1).toLowerCase();
                return ignoreExt.indexOf(extName) !== -1;
            } catch (e) {
                return false;
            }
        };

        /**
         * Prefer real bookmark anchors; fall back to any data-ext/data-url.
         * Dedupes by normalized URL so one host is not probed many times.
         */
        const analysisAtag = () => {
            const all = [];
            const seen = {};
            const selectors = [
                "a.bookmark-link[data-ext], a.bookmark-link[data-url], a.tooltip-self[data-ext], a.tooltip-self[data-url]",
                "a[data-ext], a[data-url]"
            ];

            let nodes = [];
            for (const sel of selectors) {
                nodes = Array.from(document.querySelectorAll(sel));
                if (nodes.length) {
                    break;
                }
            }

            for (const elm of nodes) {
                if (all.length >= MAX_ALLOW) {
                    break;
                }
                let url = elm.getAttribute("data-url") || elm.getAttribute("data-ext");
                if (!url) {
                    continue;
                }
                url = url.trim();
                if (!validURL(url) || pathLooksLikeFile(url) || ext.helper.util.isUrlOnBlacklist(url)) {
                    continue;
                }
                const famous = ext.helper.util.isFamousWebsite(url);
                if (famous && famous.yes) {
                    continue;
                }
                const key = cacheKey(url);
                if (!key || seen[key]) {
                    continue;
                }
                seen[key] = true;
                elm.classList.remove($.cl.brokenUrl);
                all.push({url: url, elm: elm, key: key});
            }
            return all;
        };

        const mark = (dom, response) => {
            $(dom).addClass($.cl.brokenUrl);
            ext.helper.dao.call("statistics", {
                name: "check",
                value: {
                    name: "broken",
                    value: {
                        url: response.httpInfo.url,
                        status: response.httpInfo.status,
                        foundTime: new Date()
                    }
                }
            });
        };

        const applyCached = (item, cache) => {
            const row = cache[item.key];
            if (!row) {
                return false;
            }
            if (row.ok === false && row.status != null) {
                $(item.elm).addClass($.cl.brokenUrl);
            }
            return true;
        };

        const checkOne = async (item, cache) => {
            if (aborted || document.hidden) {
                return;
            }
            try {
                const response = await ext.helper.dao.call("checkUrl", {
                    url: item.url,
                    all: false,
                    light: true,
                    timeout: CHECK_TIMEOUT_MS
                }, false);

                if (aborted) {
                    return;
                }

                const httpInfo = response && response.httpInfo;
                if (!httpInfo) {
                    return;
                }

                cache[item.key] = {
                    t: Date.now(),
                    ok: httpInfo.ok !== false,
                    status: httpInfo.status
                };

                if (httpInfo.ok === false && httpInfo.status != null) {
                    ext.log(httpInfo);
                    mark(item.elm, response);
                }
            } catch (e) {
                // ignore single failures
            }
        };

        const check = async () => {
            if (running) {
                return;
            }
            running = true;
            aborted = false;

            try {
                const powerfulCheck = ext.helper.dao.getData("b/powerfulCheck");
                if (!powerfulCheck || !ext.helper.official.isOfficialWeb()) {
                    return;
                }
                if (document.hidden) {
                    return;
                }

                let online = false;
                try {
                    online = await netWorkIsOk();
                } catch (e) {
                    online = false;
                }
                if (!online || aborted) {
                    return;
                }

                const serverOk = await ext.helper.dao.call("serverState");
                if (!serverOk || aborted || document.hidden) {
                    return;
                }

                const cache = readSessionCache();
                const all = analysisAtag();
                const pending = [];

                for (const item of all) {
                    if (!applyCached(item, cache)) {
                        pending.push(item);
                    }
                }

                // Pool of CONCURRENCY light checks — faster than serial, still bounded.
                let next = 0;
                const worker = async () => {
                    while (next < pending.length && !aborted && !document.hidden) {
                        const item = pending[next++];
                        await checkOne(item, cache);
                        if (next < pending.length && !aborted) {
                            await sleep(PAUSE_MS);
                        }
                    }
                };
                const workers = [];
                const n = Math.min(CONCURRENCY, pending.length);
                for (let w = 0; w < n; w++) {
                    workers.push(worker());
                }
                await Promise.all(workers);

                writeSessionCache(cache);
            } finally {
                running = false;
            }
        };
    };

})(jsu);
