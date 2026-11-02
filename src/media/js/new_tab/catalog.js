($ => {
    "use strict";

    /**
     * navigation_v2 → flat tile list (icons + folder tiles).
     */
    $.CatalogHelper = function (n) {

        /**
         * @param {object} catalog schemaVersion 2 payload
         * @param {string} lang
         * @returns {Array}
         */
        this.flattenToTiles = (catalog, lang) => {
            if (!catalog || !Array.isArray(catalog.categories)) {
                return [];
            }

            const tiles = [];
            const categories = catalog.categories.slice().sort((a, b) => {
                return (a.weight || 0) - (b.weight || 0);
            });

            categories.forEach((cat) => {
                if (!cat || cat.remove) {
                    return;
                }

                const title = localizeTitle(cat, lang) || cat.title || cat.id;
                const children = (cat.children || [])
                    .filter((c) => c && !c.remove)
                    .sort((a, b) => (a.weight || 0) - (b.weight || 0))
                    .map((c) => normalizeItem(c, lang, cat.id));

                const display = cat.display || (cat.id === "pinned" || cat.id === "default" ? "icons" : "folder");

                // "module" = Phase B strip (e.g. Tools). Still emit a n/links folder so
                // users can organize it; grid rendering skips id=tools.
                if (display === "module") {
                    if (cat.id === "tools") {
                        tiles.push({
                            id: "tools",
                            type: "folder",
                            title: title,
                            url: "",
                            icon: null,
                            selected: true,
                            fixed: false,
                            remove: false,
                            origin: 1,
                            weight: cat.weight || 0,
                            categoryId: "tools",
                            module: true,
                            children: children,
                            lang: cat.lang || null
                        });
                    }
                    return;
                }

                if (display === "icons") {
                    children.forEach((child) => {
                        tiles.push(child);
                    });
                } else if (display === "folder") {
                    tiles.push({
                        id: cat.id,
                        type: "folder",
                        title: title,
                        url: "",
                        icon: null,
                        selected: true,
                        fixed: false,
                        remove: false,
                        origin: 1,
                        weight: cat.weight || 0,
                        categoryId: cat.id,
                        children: children,
                        lang: cat.lang || null
                    });
                }
            });

            return tiles;
        };

        /**
         * Resolve tools list: prefer user n/links tools folder (even if empty), else catalog.
         */
        this.getToolLinks = (catalog, lang) => {
            const pages = n.helper.dao.getData("n/links") || [];
            const folder = this.getStoredToolsFolder(pages);
            // Folder present ⇒ user (or prior seed) owns the list — never fall back to catalog
            if (folder && Array.isArray(folder.children)) {
                return folder.children.filter((c) => c && c.selected !== false && c.url && c.title);
            }
            if (!catalog || !Array.isArray(catalog.categories)) {
                return [];
            }
            const tools = catalog.categories.find((c) => c && c.id === "tools");
            if (!tools || !Array.isArray(tools.children)) {
                return [];
            }
            return tools.children
                .filter((c) => c && !c.remove && c.selected !== false)
                .sort((a, b) => (a.weight || 0) - (b.weight || 0))
                .map((c) => normalizeItem(c, lang, "tools"));
        };

        /**
         * @param {Array=} pages
         * @returns {object|null}
         */
        this.getStoredToolsFolder = (pages) => {
            const list = pages || n.helper.dao.getData("n/links") || [];
            return list.find((item) => {
                return item && item.type === "folder"
                    && (item.id === "tools" || item.categoryId === "tools");
            }) || null;
        };

        /**
         * User-organized tools from n/links (id/categoryId = tools).
         */
        this.getStoredToolLinks = () => {
            const folder = this.getStoredToolsFolder();
            if (!folder || !Array.isArray(folder.children)) {
                return [];
            }
            return folder.children.filter((c) => c && c.selected !== false && c.url && c.title);
        };

        /**
         * Full tools folder object for the organize modal.
         */
        this.getToolsFolder = (catalog, lang) => {
            const existing = this.getStoredToolsFolder();
            if (existing) {
                return existing;
            }
            const links = this.getToolLinks(catalog, lang);
            return {
                id: "tools",
                type: "folder",
                title: n.helper.i18n.get("new_tab_tools_title") || "Tools",
                url: "",
                icon: null,
                selected: true,
                fixed: false,
                remove: false,
                origin: 1,
                categoryId: "tools",
                module: true,
                children: links
            };
        };

        const localizeTitle = (item, lang) => {
            if (!item || !item.lang) {
                return item && item.title;
            }
            const loc = item.lang[lang]
                || ((lang === "mx" || lang === "cl") && item.lang.es)
                || (lang !== "en" && item.lang.en);
            return (loc && loc.title) || item.title;
        };

        const normalizeItem = (item, lang, categoryId) => {
            const copy = Object.assign({}, item);
            copy.type = "link";
            copy.categoryId = categoryId || item.categoryId || null;
            copy.title = localizeTitle(item, lang) || item.title || item.url;
            if (typeof copy.origin === "undefined") {
                copy.origin = 1;
            }
            if (typeof copy.selected === "undefined") {
                copy.selected = true;
            }
            copy.icon = n.helper.util.normalizeRemoteIconUrl(copy.icon || null);
            return copy;
        };
    };

})(jsu);
