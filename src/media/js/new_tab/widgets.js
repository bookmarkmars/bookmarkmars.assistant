($ => {
    "use strict";

    /**
     * Phase B strip: Calendar + Memo + Tool link group (optional, under shortcuts).
     */
    $.WidgetsHelper = function (n) {

        const MEMO_KEY = "nt_memos";
        const VIS_KEY = "n/widgetsVisible";

        /**
         * @returns {Promise}
         */
        this.init = async () => {
            if (!n.elm.widgets || !n.elm.widgets.wrapper) {
                return;
            }

            const visible = n.helper.dao.getData(VIS_KEY);
            if (visible === false || visible === "hide") {
                n.elm.widgets.wrapper.addClass($.cl.hidden);
                return;
            }

            renderCalendar();
            await renderMemo();
            await renderTools();
            initEvents();
        };

        const renderCalendar = () => {
            const box = n.elm.widgets.calendar;
            if (!box || (typeof box.length === "function" ? box.length() < 1 : !box[0])) {
                return;
            }
            box.html("");

            const now = new Date();
            const lang = (n.helper.i18n.getLanguage() || "en").replace(/_/g, "-");

            let monthLabel = "";
            let weekday = "";
            try {
                monthLabel = now.toLocaleDateString(lang, { month: "short", year: "numeric" });
                weekday = now.toLocaleDateString(lang, { weekday: "short" });
            } catch (e) {
                monthLabel = now.toDateString();
                weekday = "";
            }

            const start = new Date(now.getFullYear(), 0, 0);
            const dayOfYear = Math.floor((now - start) / 86400000);
            const week = getWeekNumber(now);

            $("<div></div>").addClass("nt-cal-month").text(monthLabel).appendTo(box);
            $("<div></div>").addClass("nt-cal-day").text(String(now.getDate())).appendTo(box);
            $("<div></div>").addClass("nt-cal-meta")
                .text((weekday ? weekday + " · " : "") + "D" + dayOfYear + " · W" + week)
                .appendTo(box);
        };

        const getWeekNumber = (d) => {
            const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
            const dayNum = date.getUTCDay() || 7;
            date.setUTCDate(date.getUTCDate() + 4 - dayNum);
            const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
            return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
        };

        const isBlankMemo = (val) => {
            const t = (val || "").trim();
            return !t || /^untitled$/i.test(t);
        };

        const loadMemos = () => {
            return new Promise((resolve) => {
                $.api.storage.local.get([MEMO_KEY], (obj) => {
                    const list = obj[MEMO_KEY];
                    if (!Array.isArray(list)) {
                        resolve(["", "", ""]);
                        return;
                    }
                    // Drop legacy "Untitled" defaults so friendly placeholders can show
                    const cleaned = list.map((v) => (isBlankMemo(v) ? "" : v));
                    const changed = cleaned.some((v, i) => v !== (list[i] || ""));
                    if (changed) {
                        saveMemos([cleaned[0] || "", cleaned[1] || "", cleaned[2] || ""]);
                    }
                    resolve(cleaned);
                });
            });
        };

        const saveMemos = (list) => {
            return new Promise((resolve) => {
                $.api.storage.local.set({ [MEMO_KEY]: list }, () => resolve());
            });
        };

        const renderMemo = async () => {
            const box = n.elm.widgets.memo;
            if (!box || (typeof box.length === "function" ? box.length() < 1 : !box[0])) {
                return;
            }
            box.html("");

            const title = n.helper.i18n.get("new_tab_memo_title") || "Memos";
            const hint = n.helper.i18n.get("new_tab_memo_hint") || "Click a line to edit · saved automatically";
            $("<div></div>").addClass("nt-memo-head").text(title).appendTo(box);
            $("<div></div>").addClass("nt-memo-hint").text(hint).appendTo(box);

            const list = await loadMemos();
            const wrap = $("<div></div>").addClass("nt-memo-list").appendTo(box);
            const placeholders = [
                n.helper.i18n.get("new_tab_memo_placeholder_1") || "A thought…",
                n.helper.i18n.get("new_tab_memo_placeholder_2") || "Save for later…",
                n.helper.i18n.get("new_tab_memo_placeholder_3") || "Remember…"
            ];

            for (let i = 0; i < 3; i++) {
                const val = isBlankMemo(list[i]) ? "" : (list[i] || "");
                const input = $("<input />")
                    .attr({
                        type: "text",
                        maxlength: "80",
                        placeholder: placeholders[i],
                        "data-memo-idx": String(i),
                        autocomplete: "off",
                        spellcheck: "false"
                    })
                    .appendTo(wrap);
                // jsu has no .val() — set native value
                if (input[0]) {
                    input[0].value = val;
                }
            }
        };

        const loadCatalog = async () => {
            try {
                const res = await n.helper.dao.call("getValue", { key: "navigation_v2" });
                if (res && res.data) {
                    return typeof res.data === "string" ? JSON.parse(res.data) : res.data;
                }
            } catch (e) {
                return null;
            }
            return null;
        };

        const renderTools = async () => {
            const box = n.elm.widgets.tools;
            if (!box || (typeof box.length === "function" ? box.length() < 1 : !box[0])) {
                return;
            }
            box.html("");
            // Always keep the Tools card visible so users can Organize after clearing
            box.removeClass($.cl.hidden);

            const catalog = await loadCatalog();
            const tools = n.helper.catalog.getToolLinks(catalog, n.helper.i18n.getLanguage());

            const headRow = $("<div></div>").addClass("nt-tools-head-row").appendTo(box);
            $("<div></div>")
                .addClass("nt-tools-head")
                .text(n.helper.i18n.get("new_tab_tools_title") || "Tools")
                .appendTo(headRow);
            $("<button></button>")
                .attr({
                    type: "button",
                    title: n.helper.i18n.get("new_tab_tools_organize") || "Organize tools"
                })
                .addClass("nt-tools-edit")
                .text(n.helper.i18n.get("new_tab_folder_organize") || "Organize")
                .appendTo(headRow);

            if (!tools.length) {
                const empty = $("<button></button>")
                    .attr({type: "button"})
                    .addClass("nt-tools-empty")
                    .appendTo(box);
                $("<span></span>")
                    .addClass("nt-tools-empty-title")
                    .text(n.helper.i18n.get("new_tab_tools_empty") || "No tools yet")
                    .appendTo(empty);
                $("<span></span>")
                    .addClass("nt-tools-empty-hint")
                    .text(n.helper.i18n.get("new_tab_tools_empty_hint") || "Organize to add some")
                    .appendTo(empty);
                return;
            }

            const grid = $("<div></div>").addClass("nt-tools-grid").appendTo(box);
            // Four icons stay in view. The rest scroll inside the card.
            tools.forEach((tool, idx) => {
                const toolIcon = (tool.icon && String(tool.icon).indexOf("http") === 0)
                    ? n.helper.util.normalizeRemoteIconUrl(tool.icon)
                    : "";
                const imgAttrs = {
                    alt: tool.title,
                    "data-tool-icon": String(idx),
                    src: toolIcon || "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
                };

                const a = $("<a></a>")
                    .attr({ href: tool.url, title: tool.title })
                    .data("href", tool.url);
                a.append($("<img />").attr(imgAttrs));
                a.append($("<span></span>").text(tool.title));
                a.appendTo(grid);

                n.helper.dao.call("getFavicon", {
                    url: tool.url,
                    iconUrl: toolIcon,
                    icon: { size: 32, title: tool.title },
                    query: true
                }).then((response) => {
                    if (!response || !response.img) {
                        return;
                    }
                    const live = grid.find("img[data-tool-icon='" + idx + "']");
                    if (live && live[0]) {
                        live[0].src = response.img;
                    }
                });
            });
        };

        const openToolsEditor = async () => {
            const catalog = await loadCatalog();
            const folder = n.helper.catalog.getToolsFolder(catalog, n.helper.i18n.getLanguage());
            n.helper.popup.create(
                "tools",
                n.helper.i18n.get("new_tab_tools_edit_headline") || "Organize tools",
                folder
            );
        };

        const initEvents = () => {
            n.elm.widgets.memo.on("change blur", "input[data-memo-idx]", () => {
                const inputs = n.elm.widgets.memo.find("input[data-memo-idx]");
                const list = [];
                inputs.forEach((el) => {
                    list.push((el.value || "").trim());
                });
                while (list.length < 3) {
                    list.push("");
                }
                saveMemos(list.slice(0, 3));
            });

            n.elm.widgets.tools.on("click", "button.nt-tools-edit, button.nt-tools-empty", (e) => {
                e.preventDefault();
                e.stopPropagation();
                openToolsEditor();
            });

            n.elm.widgets.tools.on("click auxclick", "a", (e) => {
                e.preventDefault();
                if (e.button === 0 || e.button === 1) {
                    n.helper.dao.call("openLink", {
                        href: $(e.currentTarget).data("href"),
                        newTab: e.type === "auxclick",
                        position: n.helper.dao.getData("b/newTabPosition"),
                        active: e.type !== "auxclick"
                    });
                }
            });
        };
    };

})(jsu);
