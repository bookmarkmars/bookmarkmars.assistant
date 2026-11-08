($ => {
    "use strict";

    /**
     * @param {object} n
     * @constructor
     */
    $.PopupHelper = function (n) {

        let elements = {};
        let linkEditor = null;

        /**
         * Creates a new overlay for the given type
         *
         * @param {string} type
         * @param {string} title
         */
        this.create = (type, title, payload) => {
            linkEditor = null;
            elements = n.helper.template.overlay(type, title);
            elements.buttonWrapper.children("a." + $.cl.close).text(n.helper.i18n.get("overlay_close"));

            switch (type) {
 
 
                case "searchEngine": {
                    handleSearchEngineHtml();
                    break;
                }
                
                case "link": {
                    handleGridHtml();
                    break;
                }

                case "folder": {
                    handleFolderHtml(payload);
                    break;
                }

                case "tools": {
                    handleToolsHtml(payload);
                    break;
                }
            }

            initEvents();
        };

        /**
         * Performs the action of the current overlay
         */
        const performAction = () => {
            switch (elements.modal.attr($.attr.type)) {
                
                case "searchEngine": {
                    updateSearchEngine();
                    break;
                }
                
                case "link":{
                	updateLinks();
                    break;
                }

                case "folder":
                case "tools": {
                    // Persist is wired inside organize handlers (CLOSE / X)
                    break;
                }
            }
        };

        /**
         * Persist shortcut list via grid helper (local + cloud).
         */
        const persistLinks = (links, opts) => {
            if (n.helper.grid && typeof n.helper.grid.persistLinks === "function") {
                return n.helper.grid.persistLinks(links, opts);
            }
            return n.helper.dao.setData({"n/links": links, "u/shortcutsSeeded": false}).then(() => {
                return n.helper.dao.call("saveShortcuts", {links: links}).catch(() => null);
            }).then(() => {
                location.reload(true);
            });
        };

        const cloneFolder = (folder) => {
            try {
                return JSON.parse(JSON.stringify(folder || {}));
            } catch (e) {
                return Object.assign({}, folder || {}, {
                    children: ((folder && folder.children) || []).slice()
                });
            }
        };
        
        /**
         * Initialises the drag&drop functionality for the given link list
         *
         * @param wrapper
         * @param linkSelector
         */
        const initDraggableLinks = (wrapper, linkSelector) => {
            
            let draggedElm = null;

            wrapper.find(linkSelector).attr("draggable", "draggable");
            wrapper.find("li.nt-edit-pin, li." + $.cl.lock).attr("draggable", "false");
            wrapper.off("dragstart").on("dragstart", linkSelector, (e) => {
                if ($(e.currentTarget).hasClass("nt-edit-pin") || $(e.currentTarget).hasClass($.cl.lock)) {
                    e.preventDefault();
                    draggedElm = null;
                    return;
                }
                draggedElm = e.currentTarget;
            });

            wrapper.off("dragenter").on("dragenter", linkSelector, (e) => {
                const row = $(e.currentTarget);
                if (row.hasClass($.cl.lock)) {
                    return;
                }
                if (row.hasClass("nt-edit-pin")) {
                    if (!draggedElm || $(draggedElm).hasClass("nt-edit-folder")) {
                        return;
                    }
                }
                row.addClass($.cl.drag.dragHover);
            });

            wrapper.off("dragover").on("dragover", linkSelector, (e) => { // allow dropping
                e.preventDefault();
            });

            wrapper.off("dragleave").on("dragleave", linkSelector, (e) => {
                $(e.currentTarget).removeClass($.cl.drag.dragHover);
            });

            wrapper.off("dragend").on("dragend", linkSelector, () => {
                wrapper.find(linkSelector).removeClass($.cl.drag.dragHover);
                $.delay().then(() => {
                    draggedElm = null;
                });
            });

            wrapper.off("drop").on("drop", linkSelector, (e) => {
                
                e.preventDefault();
                wrapper.find(linkSelector).removeClass($.cl.drag.dragHover);

                if (!draggedElm || draggedElm === e.currentTarget || $(draggedElm).hasClass("nt-edit-pin") || $(draggedElm).hasClass($.cl.lock) || $(e.currentTarget).hasClass($.cl.lock)) {
                    return;
                }

                const target = $(e.currentTarget);
                const source = $(draggedElm);

                // Drop a link onto a folder row → nest it inside the folder
                if (target.hasClass("nt-edit-folder") && !source.hasClass("nt-edit-folder")) {
                    const kids = (target.data("folder-children") || []).slice();
                    const title = source.attr($.attr.title)
                        || source.find("input[type='checkbox']").attr($.attr.title)
                        || source.children("a").text();
                    const url = source.attr($.attr.href)
                        || source.find("input[type='checkbox']").attr($.attr.href);
                    const origin = source.attr($.attr.origin);
                    if (!url) {
                        return;
                    }
                    const norm = n.helper.util.normalizeShortcutUrl;
                    const key = norm(url);
                    const existsAt = kids.findIndex((c) => c && norm(c.url) === key);
                    const child = existsAt >= 0 ? kids.splice(existsAt, 1)[0] : {
                        title: title,
                        url: url,
                        selected: true,
                        fixed: false,
                        remove: false,
                        origin: origin !== null && origin !== undefined ? parseInt(origin, 10) || 0 : 0,
                        type: "link",
                        icon: null
                    };
                    kids.unshift(child);
                    target.data("folder-children", kids);
                    target.attr("data-children", JSON.stringify(kids));
                    const label = (target.attr($.attr.title) || "Folder") + " (" + kids.length + ")";
                    target.children("a").text(label);
                    // Pinned copies. Every other folder moves the row.
                    if (!target.hasClass("nt-edit-pin")) {
                        source.remove();
                    }
                    draggedElm = null;
                    return;
                }

                // Pinned stays the first row. A folder dropped on it does not take its place.
                if ($(e.currentTarget).hasClass("nt-edit-pin")) {
                    return;
                }
                // Take the target row's place. The original row shifts back one.
                const parent = e.currentTarget.parentNode;
                parent.insertBefore(draggedElm, e.currentTarget);
                const pinRow = parent.querySelector ? parent.querySelector("li.nt-edit-pin") : null;
                if (pinRow && pinRow !== parent.firstElementChild) {
                    parent.insertBefore(pinRow, parent.firstElementChild);
                }
            });
        };

        /**
         * Closes the overlay
         */
        const closeOverlay = () => {
            n.helper.util.triggerEvent("overlayClosed");
            elements.overlay.removeClass($.cl.page.visible);

            $.delay(100).then(() => {
                elements.overlay.remove();
            });
        };


        /**
         * 搜索引擎处理
         */
        const handleSearchEngineHtml = () => {
            
            const scrollBox = $("<div></div>").addClass($.cl.scrollBox.wrapper).appendTo(elements.modal);

			//搜索提示
            const searchSuggestionWrapper = $("<div></div>").attr($.attr.name, "searchSuggest").appendTo(scrollBox);

            ["queries", "bookmarks", "history"].forEach((name) => {
                const fieldName = "searchSuggest" + n.helper.util.capitalizeFirstLetter(name);
                const checkbox = n.helper.checkbox.get(elements.overlay.find("body"), {
                    [$.attr.name]: fieldName
                }, "checkbox").appendTo(searchSuggestionWrapper);

                $("<span></span>").html(n.helper.i18n.get("new_tab_search_suggest_" + name)).insertAfter(checkbox);

                if (n.helper.dao.getData("n/" + fieldName)) {
                    checkbox.trigger("click");
                }

                checkbox.children("input[type='checkbox']").on("change", (e) => {

                    n.helper.search.setSearchSuggestion(name, e.currentTarget.checked);
                });
            });

            const list = $("<ul></ul>").addClass($.cl.result).appendTo(scrollBox);
            const searchEngines = n.helper.search.getSearchEngineList();
            const currentSearchEngine = n.helper.search.getCurrentSearchEngine();

            Object.entries(searchEngines).forEach(([value, info]) => {
                const entry = $("<li></li>")
                    .append(n.helper.checkbox.get(elements.overlay.find("body"), {
                        [$.attr.name]: "searchEngine",
                        [$.attr.value]: value
                    }, "radio"))
                    .append("<a>" + info.name + "</a>")
                    .appendTo(list);

                if (info.favicon) {
                    $("<img />").attr("src", info.favicon).prependTo(entry.children("a"));
                }

                if (currentSearchEngine.name === value) {
                    entry.find("input[" + $.attr.name + "='searchEngine'][" + $.attr.value + "='" + value + "']").parent("div." + $.cl.checkbox.box).trigger("click");
                }
            });

            const customWrapper = $("<ul></ul>").attr($.attr.type, "custom").appendTo(scrollBox);

            if (currentSearchEngine.name === "custom") {
                customWrapper.addClass($.cl.visible);
            }

            $("<li></li>")
                .append("<label>" + n.helper.i18n.get("new_tab_search_engine_custom_title") + "</label>")
                .append("<input type='text' name='title' value='" + currentSearchEngine.title.replace(/'/g, "&#x27;") + "' />")
                .appendTo(customWrapper);
            $("<li></li>")
                .append("<label>" + n.helper.i18n.get("new_tab_search_engine_custom_url_homepage") + "</label>")
                .append("<input type='text' name='homepage' value='" + currentSearchEngine.homepage.replace(/'/g, "&#x27;") + "' placeholder='https://example.com' />")
                .appendTo(customWrapper);
            $("<li></li>")
                .append("<label>" + n.helper.i18n.get("new_tab_search_engine_custom_url_results") + "</label>")
                .append("<input type='text' name='queryUrl' value='" + currentSearchEngine.queryUrl.replace(/'/g, "&#x27;") + "' placeholder='https://example.com/?q={1}' />")
                .appendTo(customWrapper);

            $("<a></a>").addClass($.cl.confirm.action).text(n.helper.i18n.get("overlay_save")).appendTo(elements.buttonWrapper);
        };
        
        /**
         * A new row sits after Pinned and any locked shortcut. The latest add is first.
         */
        const placeNewEditorRow = (list, entry) => {
            const parent = list && list[0];
            const node = entry && entry[0];
            if (!parent || !node || node.parentNode !== parent) {
                return;
            }
            let anchor = null;
            const rows = parent.children;
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                if (row === node) {
                    continue;
                }
                if (row.classList.contains("nt-edit-pin") || row.classList.contains($.cl.lock)) {
                    anchor = row;
                    continue;
                }
                break;
            }
            const before = anchor ? anchor.nextSibling : parent.firstChild;
            if (before !== node) {
                parent.insertBefore(node, before);
            }
            if (node.scrollIntoView) {
                node.scrollIntoView({block: "nearest"});
            }
        };

        const addEntry = (item,list,insertAfterLocked)=>{

        	// Folder row in the shortcut editor
        	if (item && item.type === "folder") {
        		const childCount = Array.isArray(item.children) ? item.children.length : 0;
        		const entry = $("<li></li>")
        			.addClass("nt-edit-folder")
        			.attr({
        				[$.attr.type]: "folder",
        				[$.attr.title]: item.title || "Folder",
        				[$.attr.origin]: typeof item.origin === "undefined" ? 0 : item.origin,
        				"data-folder-id": item.id || item.categoryId || ""
        			})
        			.data("folder-children", item.children || [])
        			.data("folder-id", item.id || item.categoryId || "")
        			.attr({
        				"data-category": item.categoryId || "",
        				"data-role": item.role || "",
        				"data-locked": item.locked ? "1" : "",
        				"data-pin-seeded": item.pinSeeded ? "1" : "",
        				"data-children": JSON.stringify(item.children || [])
        			})
        			.append(n.helper.checkbox.get(elements.overlay.find("body"), {
        				[$.attr.title]: item.title,
        				[$.attr.href]: "folder:" + (item.id || item.categoryId || item.title),
        				checked: item.selected !== false ? "checked" : false
        			}, "checkbox"))
        			.append("<a>" + (item.title || "Folder") + " (" + childCount + ")</a>")
        			.appendTo(list);

        		const isPinFolder = item.role === "categoryPin" || String(item.id || "").indexOf("pin:") === 0;
        		if (isPinFolder) {
        			entry.addClass("nt-edit-pin").attr("draggable", "false");
        		}

        		if (!isPinFolder && (item.origin === 0 || !item.hasOwnProperty("origin"))) {
        			const rm = $("<img />")
        				.attr("src", $.api.runtime.getURL("media/img/icon/newtab/icon-remove.png"));
        			entry.addClass($.cl.remove)
        				.append($("<span></span>").append(rm));
        		}
        		if (insertAfterLocked) {
        			placeNewEditorRow(list, entry);
        		}
        		return;
        	}
        	 
        	const entry = $("<li></li>")
                .append(n.helper.checkbox.get(elements.overlay.find("body"), {
                    [$.attr.title]:item.title,
                    [$.attr.href]: item.url,
                    checked: item.selected?"checked":false
                }, "checkbox"))
                .append("<a>" + item.title + "</a>")
                .appendTo(list);
            
            //指明来源
            entry.attr($.attr.origin,item.origin);
            entry.attr($.attr.type, "link");
            if (item.icon && String(item.icon).indexOf("http") === 0) {
            	entry.attr("data-icon", n.helper.util.normalizeRemoteIconUrl(item.icon));
            }
            entry.attr("data-category", item.categoryId || "");
            if (item.id) {
            	entry.attr("data-id", item.id);
            }
            
            //部分内容锁死
            if(item.fixed){
            	
            	const lock=$("<img />")
            	.attr("src", $.api.runtime.getURL("media/img/icon/newtab/icon-lock.png"));
            	
            	entry.find("div[data-type='checkbox']").remove();
            	
            	entry
            	.attr({
            		[$.attr.title]:item.title,
                    [$.attr.href]: item.url,
            	})
            	.addClass($.cl.lock)
            	.prepend(
            		$("<div></div>")
            		.append(lock)
            	);
            }
            
            //===0 或者 兼容过往用户添加的，没有origin的快捷方式
            if(item.origin===0 || !item.hasOwnProperty('origin')){
            	
            	const rm=$("<img />")
            	.attr("src", $.api.runtime.getURL("media/img/icon/newtab/icon-remove.png"))
            	
            	entry
            	.addClass($.cl.remove)
            	.append($("<span></span>")
            	.append(rm));
            	
            }
            
            if (insertAfterLocked) {
            	placeNewEditorRow(list, entry);
            }

            const iconUrl = (item.icon && String(item.icon).indexOf("http") === 0)
            	? n.helper.util.normalizeRemoteIconUrl(item.icon)
            	: "";
            const favicon = $("<img />").attr({
            	alt: item.title || "",
            	src: iconUrl || "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
            });
            const liveIcon = favicon.prependTo(entry.children("a"));
            if (item.url) {
            	n.helper.dao.call("getFavicon", {
            		url: item.url,
            		iconUrl: iconUrl,
            		icon: {size: 32, title: item.title || item.url},
            		query: true
            	}).then((response) => {
            		if (response && response.img && liveIcon && liveIcon[0]) {
            			liveIcon[0].src = response.img;
            		}
            	});
            }
        }
        
        
        /**
         * The dragged tile takes the target tile's place. The target shifts back one.
         */
        const placeDraggedTile = (dragged, target) => {
            if (!dragged || !target || dragged === target || !target.parentNode) {
                return;
            }
            const parent = target.parentNode;
            const draggedIsAfter = (target.compareDocumentPosition(dragged) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
            parent.insertBefore(dragged, draggedIsAfter ? target : target.nextSibling);
        };

        /**
         * Open a shortcut folder — browse mode, or full organize mode (reorder / eject / add).
         * @param {object} payload folder object, or {folder, organize:true}
         */
        const handleFolderHtml = (payload) => {
            const startOrganize = !!(payload && payload.organize && payload.folder);
            const folder = startOrganize ? payload.folder : payload;
            const working = cloneFolder(folder);
            if (!working.id && working.categoryId) {
                working.id = working.categoryId;
            }
            if (!Array.isArray(working.children)) {
                working.children = [];
            }
            working.type = "folder";

            let editMode = startOrganize;
            let dirty = false;
            let draggedTile = null;
            const pendingEject = []; // children moved back to this tab; applied on CLOSE/X
            let layout = (working.children || []).slice();
            const syncLayout = () => {
                const current = (working.children || []).slice();
                const stillThere = new Set(current);
                const next = current.slice();
                layout.forEach((item, oldAt) => {
                    if (!item || stillThere.has(item)) {
                        return;
                    }
                    let insertAt = next.length;
                    for (let i = oldAt + 1; i < layout.length; i++) {
                        const follower = next.indexOf(layout[i]);
                        if (follower >= 0) {
                            insertAt = follower;
                            break;
                        }
                    }
                    next.splice(insertAt, 0, item);
                });
                layout = next;
            };
            const categories = (n.helper.grid && typeof n.helper.grid.getNavCategories === "function")
                ? n.helper.grid.getNavCategories()
                : [];
            const homeId = (categories[0] && categories[0].id) || "pinned";
            const folderCategory = () => {
                if (working.categoryId) {
                    return working.categoryId;
                }
                const id = String(working.id || "");
                if (id.indexOf("pin:") === 0) {
                    return id.slice(4);
                }
                return homeId;
            };
            const itemCategory = (item) => (item && item.categoryId) || homeId;

            const markDirty = () => {
                dirty = true;
            };

            const scrollBox = $("<div></div>")
                .addClass($.cl.scrollBox.wrapper)
                .addClass("nt-folder-panel")
                .appendTo(elements.modal);

            const tip = $("<p></p>")
                .addClass("nt-folder-tip")
                .appendTo(scrollBox);

            const renameRow = $("<div></div>")
                .addClass("nt-folder-rename")
                .appendTo(scrollBox);
            $("<label></label>")
                .text(n.helper.i18n.get("new_tab_folder_name") || "Folder name")
                .appendTo(renameRow);
            const renameInput = $("<input />")
                .attr({type: "text", name: "folder-title", maxlength: "40"})
                .appendTo(renameRow);
            if (renameInput[0]) {
                renameInput[0].value = working.title || "";
            }

            const grid = $("<div></div>").addClass("nt-folder-grid").appendTo(scrollBox);

            const addPanel = $("<div></div>")
                .addClass("nt-folder-add-panel")
                .appendTo(scrollBox);
            $("<p></p>")
                .addClass("nt-folder-add-label")
                .text(n.helper.i18n.get("new_tab_folder_add_existing") || "Add from this tab")
                .appendTo(addPanel);
            const picker = $("<select></select>")
                .addClass("nt-folder-picker")
                .appendTo(addPanel);
            const addExistingBtn = $("<button></button>")
                .attr({type: "button"})
                .text(n.helper.i18n.get("new_tab_folder_add") || "Add")
                .appendTo(addPanel);
            $("<p></p>")
                .addClass("nt-folder-add-label")
                .text(n.helper.i18n.get("new_tab_folder_add_custom") || "Or add a custom link")
                .appendTo(addPanel);
            const customTitle = $("<input />")
                .attr({type: "text", name: "title", placeholder: n.helper.i18n.get("new_tab_navigation_title") || "Title"})
                .appendTo(addPanel);
            const customUrl = $("<input />")
                .attr({type: "text", name: "url", placeholder: "https://example.com"})
                .appendTo(addPanel);
            const addCustomBtn = $("<button></button>")
                .attr({type: "button"})
                .addClass("nt-folder-add-custom-btn")
                .text(n.helper.i18n.get("new_tab_add_navigation_url") || "Add")
                .appendTo(addPanel);

            // Only Organize/Done — Save removed. Persist+refresh happens on CLOSE / X.
            elements.buttonWrapper.children("a." + $.cl.confirm.action).remove();
            const editBtn = $("<a></a>")
                .addClass("nt-folder-edit-btn")
                .text(n.helper.i18n.get("new_tab_folder_organize") || "Organize")
                .prependTo(elements.buttonWrapper);

            const syncChrome = () => {
                if (editMode) {
                    scrollBox.addClass("is-editing");
                    tip.text(n.helper.i18n.get("new_tab_folder_edit_tip")
                        || "Drag to reorder · × moves back to home · add below · Close to apply");
                    editBtn.text(n.helper.i18n.get("new_tab_folder_done") || "Done");
                    renameRow.css("display", "flex");
                    addPanel.css("display", "block");
                } else {
                    scrollBox.removeClass("is-editing");
                    tip.text(n.helper.i18n.get("new_tab_folder_tip")
                        || "Click a site to open it · Organize to edit");
                    editBtn.text(n.helper.i18n.get("new_tab_folder_organize") || "Organize");
                    renameRow.css("display", "none");
                    addPanel.css("display", "none");
                }
            };

            const fillPicker = () => {
                picker.html("");
                $("<option></option>")
                    .attr("value", "")
                    .text(n.helper.i18n.get("new_tab_folder_pick") || "Choose a shortcut…")
                    .appendTo(picker);
                const links = n.helper.dao.getData("n/links") || [];
                const inFolder = new Set((working.children || []).map((c) => {
                    return c && c.url ? n.helper.util.normalizeShortcutUrl(c.url) : "";
                }).filter(Boolean));
                const tabId = folderCategory();
                links.forEach((item) => {
                    if (!item || item.type === "folder" || !item.url || !item.title) {
                        return;
                    }
                    if (itemCategory(item) !== tabId) {
                        return;
                    }
                    if (item.fixed || (item.selected === false)) {
                        return;
                    }
                    const key = n.helper.util.normalizeShortcutUrl(item.url);
                    if (inFolder.has(key)) {
                        return;
                    }
                    $("<option></option>")
                        .attr("value", item.url)
                        .text(item.title)
                        .data("item", item)
                        .appendTo(picker);
                });
            };

            const readOrderFromDom = () => {
                const ordered = [];
                const used = new Set();
                grid.children("a.nt-folder-tile").forEach((elm) => {
                    const node = elm && elm.getAttribute ? elm : (elm && elm[0]);
                    if (!node || !node.getAttribute) {
                        return;
                    }
                    const url = node.getAttribute("data-url") || $(node).data("href") || node.getAttribute("href");
                    const key = n.helper.util.normalizeShortcutUrl(url || "");
                    const match = (working.children || []).find((c) => {
                        if (!c || !c.url || used.has(c)) {
                            return false;
                        }
                        return n.helper.util.normalizeShortcutUrl(c.url) === key;
                    });
                    if (match) {
                        used.add(match);
                        ordered.push(match);
                    }
                });
                (working.children || []).forEach((c) => {
                    if (c && !used.has(c)) {
                        ordered.push(c);
                    }
                });
                working.children = ordered;
                syncLayout();
            };

            const renderTiles = () => {
                grid.html("");
                const kids = (working.children || []).filter((item) => item && item.selected !== false);
                kids.forEach((item, idx) => {
                    // jsu clones on append — set img src (+ data attr) BEFORE any insert
                    const folderIcon = (item.icon && String(item.icon).indexOf("http") === 0)
                    	? n.helper.util.normalizeRemoteIconUrl(item.icon)
                    	: "";
                    const imgAttrs = {
                        alt: item.title || "",
                        "data-folder-open-icon": String(idx),
                        src: folderIcon || "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
                    };

                    const tile = $("<a></a>")
                        .addClass("nt-folder-tile")
                        .attr({
                            href: item.url || "#",
                            title: item.title || "",
                            "data-url": item.url || ""
                        })
                        .data("href", item.url)
                        .attr("draggable", editMode ? "true" : "false");

                    $("<div></div>")
                        .addClass("nt-folder-tile-icon")
                        .append($("<img />").attr(imgAttrs))
                        .appendTo(tile);
                    $("<span></span>").text(item.title || "").appendTo(tile);

                    if (editMode) {
                        const eject = $("<button></button>")
                            .attr({type: "button", title: n.helper.i18n.get("new_tab_folder_eject") || "Move to home"})
                            .addClass("nt-folder-eject")
                            .text("×");
                        eject.appendTo(tile);
                    }
                    tile.appendTo(grid);

                    if (!item.url) {
                        return;
                    }
                    const childIdx = idx;
                    n.helper.dao.call("getFavicon", {
                        url: item.url,
                        iconUrl: folderIcon,
                        icon: {size: 32, title: item.title || item.url},
                        query: true
                    }).then((response) => {
                        if (!response || !response.img) {
                            return;
                        }
                        const live = grid.find("img[data-folder-open-icon='" + childIdx + "']");
                        if (live && live[0]) {
                            live[0].src = response.img;
                        }
                    });
                });
                fillPicker();
            };

            const applyWorkingToStorage = () => {
                if (renameInput[0]) {
                    const name = (renameInput[0].value || "").trim();
                    if (name) {
                        working.title = name;
                    }
                }
                readOrderFromDom();
                working.userManaged = true;
                working.pinSeeded = true;
                if (String(working.id || "").indexOf("pin:") === 0) {
                	working.role = "categoryPin";
                	working.locked = true;
                }
                working.type = "folder";
                working.children = (working.children || []).filter((c) => c && c.url && c.title);
                const links = n.helper.dao.getData("n/links") || [];
                const folderId = working.id || working.categoryId;
                const isPin = !!(working.locked || working.role === "categoryPin");
                const tabId = folderCategory();
                const norm = n.helper.util.normalizeShortcutUrl;
                const childKeys = new Set((working.children || []).map((c) => {
                    return c && c.url ? norm(c.url) : "";
                }).filter(Boolean));

                // Replace this folder in place. Pinned copies stay on the tab.
                // A normal folder still takes the shortcut off the grid.
                const next = [];
                let folderAt = -1;
                links.forEach((item) => {
                    if (!item) {
                        return;
                    }
                    const isThisFolder = item.type === "folder" && (item.id === folderId
                        || (isPin && item.role === "categoryPin" && item.categoryId === working.categoryId));
                    if (isThisFolder) {
                        folderAt = next.length;
                        next.push(working);
                        return;
                    }
                    if (!isPin && item.type !== "folder" && item.url && childKeys.has(norm(item.url))
                        && itemCategory(item) === tabId) {
                        return;
                    }
                    next.push(item);
                });
                if (folderAt < 0) {
                    folderAt = next.length;
                    next.push(working);
                }

                // Released shortcuts return just after this folder, in folder order.
                const released = pendingEject.slice().sort((a, b) => {
                    return layout.indexOf(a) - layout.indexOf(b);
                });
                const block = [];
                released.forEach((item) => {
                    if (!item || !item.url) {
                        return;
                    }
                    const key = norm(item.url);
                    const exists = next.some((row) => {
                        return row && row.type !== "folder" && itemCategory(row) === tabId && norm(row.url) === key;
                    });
                    if (exists || childKeys.has(key)) {
                        return;
                    }
                    const keptOrigin = (item.origin === 1 || item.origin === "1") ? 1 : 0;
                    block.push(Object.assign({}, item, {
                        type: "link",
                        selected: true,
                        fixed: false,
                        categoryId: tabId,
                        origin: keptOrigin
                    }));
                });
                block.forEach((item, index) => {
                    next.splice(folderAt + 1 + index, 0, item);
                });

                closeOverlay();
                return persistLinks(next, {reload: true});
            };

            // CLOSE / top-right X: apply edits + refresh NTP. Browse-only close: no refresh.
            elements.onBeforeClose = () => {
                if (dirty) {
                    applyWorkingToStorage();
                    return;
                }
                closeOverlay();
            };

            grid.on("click auxclick", "a.nt-folder-tile", (e) => {
                if (editMode) {
                    e.preventDefault();
                    return;
                }
                e.preventDefault();
                if (e.button === 0 || e.button === 1) {
                    n.helper.dao.call("openLink", {
                        href: $(e.currentTarget).data("href"),
                        newTab: e.type === "auxclick",
                        position: n.helper.dao.getData("b/newTabPosition"),
                        active: e.type !== "auxclick"
                    });
                    closeOverlay();
                }
            });

            grid.on("click", "button.nt-folder-eject", (e) => {
                e.preventDefault();
                e.stopPropagation();
                const tile = $(e.currentTarget).parent("a.nt-folder-tile");
                const url = tile.data("href");
                const norm = n.helper.util.normalizeShortcutUrl;
                const target = norm(url);
                syncLayout();
                const removed = [];
                working.children = (working.children || []).filter((c) => {
                    if (c && norm(c.url) === target) {
                        removed.push(c);
                        return false;
                    }
                    return true;
                });
                removed.forEach((c) => pendingEject.push(c));
                working.userManaged = true;
                markDirty();
                renderTiles();
            });

            grid.on("dragstart", "a.nt-folder-tile", (e) => {
                if (!editMode) {
                    return;
                }
                draggedTile = e.currentTarget;
                try {
                    e.originalEvent.dataTransfer.effectAllowed = "move";
                } catch (err) {
                    // ignore
                }
            });
            grid.on("dragover", "a.nt-folder-tile", (e) => {
                if (!editMode || !draggedTile) {
                    return;
                }
                e.preventDefault();
                $(e.currentTarget).addClass("nt-drop-target");
            });
            grid.on("dragleave", "a.nt-folder-tile", (e) => {
                $(e.currentTarget).removeClass("nt-drop-target");
            });
            grid.on("drop", "a.nt-folder-tile", (e) => {
                e.preventDefault();
                $(e.currentTarget).removeClass("nt-drop-target");
                if (!editMode || !draggedTile || draggedTile === e.currentTarget) {
                    return;
                }
                placeDraggedTile(draggedTile, e.currentTarget);
                readOrderFromDom();
                markDirty();
                draggedTile = null;
            });
            grid.on("dragend", "a.nt-folder-tile", () => {
                draggedTile = null;
                grid.find("a.nt-folder-tile").removeClass("nt-drop-target");
            });

            renameInput.on("input change", () => {
                markDirty();
            });

            addExistingBtn.on("click", (e) => {
                e.preventDefault();
                const url = picker[0] ? picker[0].value : "";
                if (!url) {
                    return;
                }
                const links = n.helper.dao.getData("n/links") || [];
                const tabId = folderCategory();
                const match = links.find((item) => {
                    return item && item.type !== "folder"
                        && itemCategory(item) === tabId
                        && n.helper.util.normalizeShortcutUrl(item.url)
                        === n.helper.util.normalizeShortcutUrl(url);
                });
                if (!match) {
                    return;
                }
                // Memory-only until CLOSE — then persist + refresh
                working.children.push(Object.assign({}, match, {
                    type: "link",
                    selected: true,
                    categoryId: tabId
                }));
                // If it was pending eject, cancel that
                const norm = n.helper.util.normalizeShortcutUrl;
                const key = norm(match.url);
                for (let i = pendingEject.length - 1; i >= 0; i--) {
                    if (pendingEject[i] && norm(pendingEject[i].url) === key) {
                        pendingEject.splice(i, 1);
                    }
                }
                markDirty();
                renderTiles();
            });

            addCustomBtn.on("click", (e) => {
                e.preventDefault();
                const title = customTitle[0] ? (customTitle[0].value || "").trim() : "";
                const url = customUrl[0] ? (customUrl[0].value || "").trim() : "";
                if (!title || !url) {
                    return;
                }
                working.children.push({
                    title: title,
                    url: url,
                    selected: true,
                    fixed: false,
                    remove: false,
                    origin: 0,
                    type: "link",
                    icon: null,
                    categoryId: folderCategory()
                });
                if (customTitle[0]) {
                    customTitle[0].value = "";
                }
                if (customUrl[0]) {
                    customUrl[0].value = "";
                }
                markDirty();
                renderTiles();
            });

            editBtn.on("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (editMode) {
                    // Done = leave organize mode only (no refresh)
                    editMode = false;
                    syncChrome();
                    renderTiles();
                    return;
                }
                editMode = true;
                syncChrome();
                renderTiles();
            });

            syncChrome();
            renderTiles();
        };

        /**
         * Organize the Tools module (Phase B strip) — reorder / remove / add.
         * Persist + NTP refresh only on CLOSE / X when dirty.
         */
        const handleToolsHtml = (folder) => {
            const working = cloneFolder(folder);
            working.id = "tools";
            working.categoryId = "tools";
            working.type = "folder";
            working.module = true;
            working.title = working.title || (n.helper.i18n.get("new_tab_tools_title") || "Tools");
            if (!Array.isArray(working.children)) {
                working.children = [];
            }

            let dirty = false;
            let draggedTile = null;
            const catalogDefaults = [];

            const markDirty = () => {
                dirty = true;
            };

            // Snapshot catalog defaults for "Add from catalog"
            try {
                n.helper.dao.call("getValue", {key: "navigation_v2"}).then((res) => {
                    if (!res || !res.data) {
                        return;
                    }
                    const catalog = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
                    const toolsCat = (catalog.categories || []).find((c) => c && c.id === "tools");
                    (toolsCat && toolsCat.children || []).forEach((c) => {
                        if (c && c.url && c.title) {
                            catalogDefaults.push(Object.assign({}, c, {type: "link"}));
                        }
                    });
                    fillPicker();
                }).catch(() => null);
            } catch (e) {
                //
            }

            const scrollBox = $("<div></div>")
                .addClass($.cl.scrollBox.wrapper)
                .addClass("nt-folder-panel")
                .addClass("is-editing")
                .appendTo(elements.modal);

            $("<p></p>")
                .addClass("nt-folder-tip")
                .text(n.helper.i18n.get("new_tab_tools_edit_tip")
                    || "Drag to reorder · × removes · add below · Close to apply")
                .appendTo(scrollBox);

            const grid = $("<div></div>").addClass("nt-folder-grid").appendTo(scrollBox);

            const addPanel = $("<div></div>")
                .addClass("nt-folder-add-panel")
                .css("display", "block")
                .appendTo(scrollBox);
            $("<p></p>")
                .addClass("nt-folder-add-label")
                .text(n.helper.i18n.get("new_tab_tools_add_catalog") || "Add from catalog")
                .appendTo(addPanel);
            const picker = $("<select></select>")
                .addClass("nt-folder-picker")
                .appendTo(addPanel);
            const addExistingBtn = $("<button></button>")
                .attr({type: "button"})
                .text(n.helper.i18n.get("new_tab_folder_add") || "Add")
                .appendTo(addPanel);
            $("<p></p>")
                .addClass("nt-folder-add-label")
                .text(n.helper.i18n.get("new_tab_folder_add_custom") || "Or add a custom link")
                .appendTo(addPanel);
            const customTitle = $("<input />")
                .attr({type: "text", name: "title", placeholder: n.helper.i18n.get("new_tab_navigation_title") || "Title"})
                .appendTo(addPanel);
            const customUrl = $("<input />")
                .attr({type: "text", name: "url", placeholder: "https://example.com"})
                .appendTo(addPanel);
            const addCustomBtn = $("<button></button>")
                .attr({type: "button"})
                .text(n.helper.i18n.get("new_tab_add_navigation_url") || "Add")
                .appendTo(addPanel);

            elements.buttonWrapper.children("a." + $.cl.confirm.action).remove();

            const fillPicker = () => {
                picker.html("");
                $("<option></option>")
                    .attr("value", "")
                    .text(n.helper.i18n.get("new_tab_folder_pick") || "Choose a shortcut…")
                    .appendTo(picker);
                const inTools = new Set((working.children || []).map((c) => {
                    return c && c.url ? n.helper.util.normalizeShortcutUrl(c.url) : "";
                }).filter(Boolean));
                catalogDefaults.forEach((item) => {
                    const key = n.helper.util.normalizeShortcutUrl(item.url);
                    if (inTools.has(key)) {
                        return;
                    }
                    $("<option></option>")
                        .attr("value", item.url)
                        .text(item.title)
                        .appendTo(picker);
                });
            };

            const readOrderFromDom = () => {
                const ordered = [];
                grid.children("a.nt-folder-tile").forEach((elm) => {
                    const url = $(elm).data("href");
                    const match = (working.children || []).find((c) => c && c.url === url)
                        || (working.children || []).find((c) => {
                            return c && n.helper.util.normalizeShortcutUrl(c.url)
                                === n.helper.util.normalizeShortcutUrl(url);
                        });
                    if (match) {
                        ordered.push(match);
                    }
                });
                working.children = ordered;
            };

            const renderTiles = () => {
                grid.html("");
                (working.children || []).forEach((item, idx) => {
                    if (!item || item.selected === false) {
                        return;
                    }
                    const folderIcon = (item.icon && String(item.icon).indexOf("http") === 0)
                    	? n.helper.util.normalizeRemoteIconUrl(item.icon)
                    	: "";
                    const imgAttrs = {
                        alt: item.title || "",
                        "data-folder-open-icon": String(idx),
                        src: folderIcon || "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
                    };

                    const tile = $("<a></a>")
                        .addClass("nt-folder-tile")
                        .attr({href: item.url || "#", title: item.title || ""})
                        .data("href", item.url)
                        .attr("draggable", "true");

                    $("<div></div>")
                        .addClass("nt-folder-tile-icon")
                        .append($("<img />").attr(imgAttrs))
                        .appendTo(tile);
                    $("<span></span>").text(item.title || "").appendTo(tile);

                    $("<button></button>")
                        .attr({
                            type: "button",
                            title: n.helper.i18n.get("new_tab_tools_remove") || "Remove"
                        })
                        .addClass("nt-folder-eject")
                        .text("×")
                        .appendTo(tile);

                    tile.appendTo(grid);

                    if (!item.url) {
                        return;
                    }
                    const childIdx = idx;
                    n.helper.dao.call("getFavicon", {
                        url: item.url,
                        iconUrl: folderIcon,
                        icon: {size: 32, title: item.title || item.url},
                        query: true
                    }).then((response) => {
                        if (!response || !response.img) {
                            return;
                        }
                        const live = grid.find("img[data-folder-open-icon='" + childIdx + "']");
                        if (live && live[0]) {
                            live[0].src = response.img;
                        }
                    });
                });
                fillPicker();
            };

            const applyWorkingToStorage = () => {
                readOrderFromDom();
                working.userManaged = true;
                working.module = true;
                working.id = "tools";
                working.categoryId = "tools";
                working.type = "folder";
                // Persist exact list (including empty) so catalog cannot revive removals
                working.children = (working.children || []).filter((c) => c && c.url && c.title);
                const links = n.helper.dao.getData("n/links") || [];
                const next = links.filter((item) => {
                    return !(item && item.type === "folder"
                        && (item.id === "tools" || item.categoryId === "tools"));
                });
                next.push(working);
                closeOverlay();
                return persistLinks(next, {reload: true});
            };

            elements.onBeforeClose = () => {
                if (dirty) {
                    applyWorkingToStorage();
                    return;
                }
                closeOverlay();
            };

            grid.on("click", "a.nt-folder-tile", (e) => {
                e.preventDefault();
            });

            grid.on("click", "button.nt-folder-eject", (e) => {
                e.preventDefault();
                e.stopPropagation();
                const url = $(e.currentTarget).parent("a.nt-folder-tile").data("href");
                const norm = n.helper.util.normalizeShortcutUrl;
                const target = norm(url);
                working.children = (working.children || []).filter((c) => {
                    return !(c && norm(c.url) === target);
                });
                working.userManaged = true;
                markDirty();
                renderTiles();
            });

            grid.on("dragstart", "a.nt-folder-tile", (e) => {
                draggedTile = e.currentTarget;
            });
            grid.on("dragover", "a.nt-folder-tile", (e) => {
                if (!draggedTile) {
                    return;
                }
                e.preventDefault();
                $(e.currentTarget).addClass("nt-drop-target");
            });
            grid.on("dragleave", "a.nt-folder-tile", (e) => {
                $(e.currentTarget).removeClass("nt-drop-target");
            });
            grid.on("drop", "a.nt-folder-tile", (e) => {
                e.preventDefault();
                $(e.currentTarget).removeClass("nt-drop-target");
                if (!draggedTile || draggedTile === e.currentTarget) {
                    return;
                }
                placeDraggedTile(draggedTile, e.currentTarget);
                readOrderFromDom();
                markDirty();
                draggedTile = null;
            });
            grid.on("dragend", "a.nt-folder-tile", () => {
                draggedTile = null;
                grid.find("a.nt-folder-tile").removeClass("nt-drop-target");
            });

            addExistingBtn.on("click", (e) => {
                e.preventDefault();
                const url = picker[0] ? picker[0].value : "";
                if (!url) {
                    return;
                }
                const match = catalogDefaults.find((item) => {
                    return item && n.helper.util.normalizeShortcutUrl(item.url)
                        === n.helper.util.normalizeShortcutUrl(url);
                });
                if (!match) {
                    return;
                }
                working.children.push(Object.assign({}, match, {
                    type: "link",
                    selected: true
                }));
                markDirty();
                renderTiles();
            });

            addCustomBtn.on("click", (e) => {
                e.preventDefault();
                const title = customTitle[0] ? (customTitle[0].value || "").trim() : "";
                const url = customUrl[0] ? (customUrl[0].value || "").trim() : "";
                if (!title || !url) {
                    return;
                }
                working.children.push({
                    title: title,
                    url: url,
                    selected: true,
                    fixed: false,
                    remove: false,
                    origin: 0,
                    type: "link",
                    icon: null
                });
                if (customTitle[0]) {
                    customTitle[0].value = "";
                }
                if (customUrl[0]) {
                    customUrl[0].value = "";
                }
                markDirty();
                renderTiles();
            });

            renderTiles();
        };

        /**
         * 快捷方式处理
         */
        const handleGridHtml = () => {
            
            const scrollBox = $("<div></div>").addClass($.cl.scrollBox.wrapper).appendTo(elements.modal);
            const disclaimer = $("<div></div>").addClass($.cl.newtab.disclaimer).text(n.helper.i18n.get("overlay_confirm_disclaimer")).appendTo(elements.modal);
            
            const categories = (n.helper.grid && typeof n.helper.grid.getNavCategories === "function")
                ? n.helper.grid.getNavCategories()
                : [];
            const homeId = (categories[0] && categories[0].id) || "pinned";
            let editCategoryId = (n.helper.grid && typeof n.helper.grid.getActiveCategoryId === "function"
                    && n.helper.grid.getActiveCategoryId())
                || n.helper.dao.getData("n/activeCategory")
                || homeId;
            if (categories.length && !categories.some((cat) => cat && cat.id === editCategoryId)) {
                editCategoryId = homeId;
            }

            let pages = [];
            try {
                pages = JSON.parse(JSON.stringify(n.helper.dao.getData("n/links") || []));
            } catch (e) {
                pages = (n.helper.dao.getData("n/links") || []).slice();
            }
            n.helper.util.sanitizeShortcutLocks(pages);

            const isToolsItem = (item) => {
                return !!(item && item.type === "folder"
                    && (item.id === "tools" || (item.categoryId === "tools" && item.role !== "categoryPin")));
            };
            const categoryOf = (item) => {
                if (!item || isToolsItem(item)) {
                    return null;
                }
                if (item.role === "categoryPin" || String(item.id || "").indexOf("pin:") === 0) {
                    return item.categoryId || String(item.id || "").replace(/^pin:/, "") || homeId;
                }
                return item.categoryId || homeId;
            };
            const rowsFor = (catId) => {
                const pins = [];
                const rest = [];
                pages.forEach((item) => {
                    if (!item || isToolsItem(item)) {
                        return;
                    }
                    if (categories.length && categoryOf(item) !== catId) {
                        return;
                    }
                    if (item.type === "folder" && (item.role === "categoryPin" || String(item.id || "").indexOf("pin:") === 0)) {
                        pins.push(item);
                    } else {
                        rest.push(item);
                    }
                });
                const fixedRest = [];
                const normalRest = [];
                rest.forEach((item) => {
                    if (item && item.fixed) {
                        fixedRest.push(item);
                    } else {
                        normalRest.push(item);
                    }
                });
                return pins.concat(fixedRest, normalRest);
            };
            const commitCategory = (catId) => {
                const visible = readLinkRows();
                visible.forEach((item) => {
                    if (item.role === "categoryPin" || String(item.id || "").indexOf("pin:") === 0) {
                        item.role = "categoryPin";
                        item.locked = true;
                        item.categoryId = catId;
                        item.id = "pin:" + catId;
                    } else if (categories.length) {
                        item.categoryId = catId;
                    } else if (!item.categoryId) {
                        item.categoryId = homeId;
                    }
                });
                if (!categories.length) {
                    pages = visible.concat(pages.filter(isToolsItem));
                    return;
                }
                const next = [];
                let placed = false;
                pages.forEach((item) => {
                    if (categoryOf(item) === catId) {
                        if (!placed) {
                            visible.forEach((row) => next.push(row));
                            placed = true;
                        }
                        return;
                    }
                    next.push(item);
                });
                if (!placed) {
                    visible.forEach((row) => next.push(row));
                }
                pages = next;
            };

            const catNav = $("<nav></nav>").addClass("nt-edit-cats").appendTo(scrollBox);
            categories.forEach((cat) => {
                const btn = $("<button></button>")
                    .attr({type: "button", "data-category": cat.id});
                n.helper.catalog.fillCategoryTab(btn, cat);
                if (cat.id === editCategoryId) {
                    btn.addClass("is-active");
                }
                btn.appendTo(catNav);
            });

            $("<span></span>")
            .addClass($.cl.newtab.suggestions)
            .text(n.helper.i18n.get("new_tab_drag_suggestions"))
            .appendTo(scrollBox);
            const list = $("<ul></ul>").addClass($.cl.result).appendTo(scrollBox);
            
            const currentSearchEngine = n.helper.search.getCurrentSearchEngine() || {};
            const defaultTitle = (currentSearchEngine.title || "").replace(/'/g, "&#x27;");
            const defaultUrl = (currentSearchEngine.homepage || "").replace(/'/g, "&#x27;");
            
            //自定义添加
            
            $("<span></span>")
            .addClass($.cl.add)
            .text(n.helper.i18n.get("new_tab_add_new_navigation"))
            .prepend($("<img />").attr("src",$.api.runtime.getURL("media/img/icon/newtab/icon-add.png")))
            .appendTo(scrollBox);

            $("<span></span>")
            .addClass("nt-add-folder")
            .text(n.helper.i18n.get("new_tab_add_folder") || "Add folder")
            .prepend($("<img />").attr("src", $.api.runtime.getURL("media/img/icon/newtab/icon-add.png")))
            .appendTo(scrollBox);

            $("<p></p>")
            .addClass("nt-edit-folder-hint")
            .text(n.helper.i18n.get("new_tab_folder_edit_list_tip")
                || "Drag a shortcut onto a folder row to nest it. Open a folder tile on the grid to Organize.")
            .appendTo(scrollBox);
            
            const customWrapper = $("<ul></ul>")
            .attr($.attr.type, "custom")
            .appendTo(scrollBox);

            const addShortcutLabel = () => {
                return n.helper.i18n.get("new_tab_add_navigation_url")
                    || n.helper.i18n.get("overlay_save")
                    || "Add";
            };
            
            $("<li></li>")
                .append("<label>" + (n.helper.i18n.get("new_tab_navigation_title") || "Title") + "</label>")
                .append("<input type='text' name='title' value='" + defaultTitle + "' />")
                .appendTo(customWrapper);
            
            $("<li></li>")
                .append("<label>" + (n.helper.i18n.get("new_tab_navigation_url") || "Link") + "</label>")
                .append("<input type='text' name='url' value='" + defaultUrl + "' placeholder='https://example.com' />")
                .appendTo(customWrapper);

            // Build button without type= in HTML string (jsu clones via innerHTML; keep label resilient)
            const addButton = $("<button></button>")
                .addClass("add-shortcut")
                .attr({
                    type: "button",
                    "data-role": "add-shortcut"
                })
                .text(addShortcutLabel());
                
            $("<li></li>")
                .addClass("favicon-preview")
                .append($("<img />").attr({
                    "src": $.api.runtime.getURL("media/img/icon/newtab/icon-custom.png"),
                    "alt": ""
                }))
                .append(addButton)
                .appendTo(customWrapper);
            
            const paintCategory = () => {
                list.html("");
                rowsFor(editCategoryId).forEach((item) => {
                    addEntry(item, list);
                });
                initDraggableLinks(scrollBox, "> ul." + $.cl.result + " > li");
                catNav.children("button").removeClass("is-active");
                catNav.children("button").forEach((elm) => {
                    const node = elm && elm.getAttribute ? elm : (elm && elm[0]);
                    if (node && node.getAttribute("data-category") === editCategoryId) {
                        $(node).addClass("is-active");
                    }
                });
            };

            linkEditor = {
                get categoryId() {
                    return editCategoryId;
                },
                commit() {
                    commitCategory(editCategoryId);
                },
                pages() {
                    return pages;
                },
                switchCategory(id) {
                    if (!id || id === editCategoryId) {
                        return;
                    }
                    commitCategory(editCategoryId);
                    editCategoryId = id;
                    paintCategory();
                }
            };

            paintCategory();

            $("<a></a>").addClass($.cl.confirm.action).text(n.helper.i18n.get("overlay_save")).appendTo(elements.buttonWrapper);
        };

        /**
         * Returns the currently selectes search engine from the list
         *
         * @returns {string}
         */
        const getSelectedSearchEngine = () => {
            let value = null;
            elements.modal.find(" ul."+$.cl.result+" input[type='checkbox']").forEach((elm) => {
                if (elm.checked) {
                    value = $(elm).attr($.attr.value);
                    return false;
                }
            });
            return value;
        };


        /**
         * Sets the selected search engine and closes the overlay
         */
        const updateSearchEngine = () => {
            
            const value = getSelectedSearchEngine();
            let data={};

            if (value) {
            	
            	const searchEngineCustom = {
                    title: elements.modal.find("input[name='title']")[0].value,
                    homepage: elements.modal.find("input[name='homepage']")[0].value,
                    queryUrl: elements.modal.find("input[name='queryUrl']")[0].value
                }
                n.helper.search.updateSearchEngine(value,searchEngineCustom);
				
				data={
                	"n/searchEngine":value,
                	"n/searchEngineCustom":searchEngineCustom,
                }
            }
            
            elements.modal.find("div[data-name='searchSuggest'] > div.checkbox").forEach((elm) => {
            	
            	let name=$(elm).attr($.attr.name);
            	let checked=$(elm).hasClass($.cl.active);
            	data["n/"+name]=checked;
            	
            });

            //存储数据
            n.helper.dao.setData(data).then(()=>{
            	 closeOverlay();
            });
        };
        
        const readLinkRows = () => {
        	const links = [];
            elements.modal.find(" ul."+$.cl.result+" > li").forEach((elm) => {
                
                const row = $(elm);
                const ch = row.find("input[type='checkbox']");
                const img = row.find("a > img");
                const item = {};

                if (row.hasClass("nt-edit-folder") || row.attr($.attr.type) === "folder") {
                    item.type = "folder";
                    item.id = row.attr("data-folder-id") || row.data("folder-id") || ("user-folder-" + Date.now());
                    item.categoryId = row.attr("data-category") || null;
                    item.role = row.attr("data-role") || undefined;
                    item.locked = row.attr("data-locked") === "1" || item.role === "categoryPin";
                    item.pinSeeded = row.attr("data-pin-seeded") === "1" || item.locked;
                    item.title = row.attr($.attr.title) || (ch.length() > 0 ? ch.attr($.attr.title) : "") || "Folder";
                    item.url = "";
                    item.icon = null;
                    let kids = row.data("folder-children");
                    if (!kids || !kids.length) {
                    	try {
                    		kids = JSON.parse(row.attr("data-children") || "[]");
                    	} catch (e) {
                    		kids = [];
                    	}
                    }
                    item.children = kids || [];
                    item.selected = ch.length() > 0 && ch[0].checked ? true : false;
                    item.fixed = !!item.locked;
                    item.remove = false;
                    item.origin = row.attr($.attr.origin) !== null && row.attr($.attr.origin) !== undefined
                        ? parseInt(row.attr($.attr.origin), 10)
                        : 0;
                    if (isNaN(item.origin)) {
                        item.origin = 0;
                    }
                    links.push(item);
                    return;
                }
                
                item.type = "link";
                item.id = row.attr("data-id") || undefined;
                item.categoryId = row.attr("data-category") || null;
                item['title']=row.attr($.attr.title) || ch.attr($.attr.title);
                item['url']=row.attr($.attr.href) || ch.attr($.attr.href);
                item['selected']=row.hasClass($.cl.lock) || (ch.length() > 0 && ch[0].checked) ? true : false;
                item['fixed']=row.hasClass($.cl.lock)?true:false;
                item['remove']=false;
                // The row may show a cached data URL. Keep the catalog http address.
                const storedIcon = row.attr("data-icon");
                const iconSrc = img.length() > 0 ? img.attr("src") : null;
                if (storedIcon && storedIcon.indexOf("http") === 0) {
                	item.icon = storedIcon;
                } else {
                	item.icon = (iconSrc && iconSrc.indexOf("http") === 0) ? iconSrc : null;
                }
                item['origin']=!!row.attr($.attr.origin) ? parseInt(row.attr($.attr.origin)) : 0;
                
                links.push(item);
            });
            return links;
        };

        const updateLinks = () => {
            if (linkEditor) {
                linkEditor.commit();
            }
            const links = linkEditor ? linkEditor.pages() : readLinkRows();
            n.helper.util.sanitizeShortcutLocks(links);
            closeOverlay();
            persistLinks(links, {reload: true});
        };

        /**
         * Initializes the events for the currently displayed overlay
         */
        const initEvents = () => {
            
            let clickstart = null;
            
            const requestClose = () => {
                if (typeof elements.onBeforeClose === "function") {
                    elements.onBeforeClose();
                    return;
                }
                closeOverlay();
            };

            //close
            elements.overlay.find("body").on("mousedown", (e) => {
                clickstart = e.target;
            }).on("click", (e) => { // close overlay when click outside the modal
                if (e.target.tagName === "BODY" && clickstart.tagName === "BODY") {
                    requestClose();
                }
            });

			//close
            elements.modal.find("a." + $.cl.close).on("click", (e) => { // close overlay by close button / X
                e.preventDefault();
                requestClose();
            });

			//choose
            elements.modal.on("click", "a", (e) => {
                e.preventDefault();
                const elmObj = $(e.currentTarget);
                const checkbox = elmObj.prev("div." + $.cl.checkbox.box);

                if (checkbox.length() > 0) {
                    checkbox.trigger("click");
                }

                if (elmObj.hasClass($.cl.confirm.action)) { // perform the action
                    performAction();
                }
            });

			//change listen
            elements.modal.find(" ul."+$.cl.result+" input[type='checkbox']").on("change", () => {
                $.delay().then(() => {
                    const customList = elements.modal.find("ul[" + $.attr.type + "='custom']");
                    if (getSelectedSearchEngine() === "custom") {
                        customList.addClass($.cl.visible);
                    } else {
                        customList.removeClass($.cl.visible);
                    }
                });
            });
            
            //click listen — toggle custom form; always re-apply Add label when shown
            elements.modal.on("click","span."+$.cl.add,() => {
                $.delay().then(() => {
                    const customList = elements.modal.find("ul[" + $.attr.type + "='custom']");
                    if (!customList.hasClass($.cl.visible)) {
                        customList.addClass($.cl.visible);
                        const btn = customList.find("button.add-shortcut, button[data-role='add-shortcut']");
                        if (btn.length() > 0) {
                            const label = n.helper.i18n.get("new_tab_add_navigation_url")
                                || n.helper.i18n.get("overlay_save")
                                || "Add";
                            btn.text(label);
                            if (btn[0]) {
                                btn[0].removeAttribute("disabled");
                            }
                        }
                        scheduleFaviconPreview();
                        const scrollNode = elements.modal.find("div." + $.cl.scrollBox.wrapper)[0];
                        if (scrollNode) {
                            const scrollToEnd = () => {
                                scrollNode.scrollTop = scrollNode.scrollHeight;
                            };
                            scrollToEnd();
                            requestAnimationFrame(scrollToEnd);
                        }
                    } else {
                        customList.removeClass($.cl.visible);
                    }
                });
            });

            // Add empty user folder from Shortcut edit overlay
            elements.modal.on("click", "nav.nt-edit-cats > button", (e) => {
                e.preventDefault();
                e.stopPropagation();
                const id = e.currentTarget && e.currentTarget.getAttribute
                    ? e.currentTarget.getAttribute("data-category")
                    : "";
                if (linkEditor && id) {
                    linkEditor.switchCategory(id);
                }
            });

            elements.modal.on("click", "span.nt-add-folder", (e) => {
                e.preventDefault();
                e.stopPropagation();
                const title = window.prompt(
                    n.helper.i18n.get("new_tab_folder_name_prompt") || "Folder name",
                    n.helper.i18n.get("new_tab_folder_default_name") || "New folder"
                );
                if (title === null) {
                    return;
                }
                const name = (title || "").trim() || (n.helper.i18n.get("new_tab_folder_default_name") || "New folder");
                const list = elements.modal.find("ul." + $.cl.result);
                addEntry({
                    id: "user-folder-" + Date.now(),
                    type: "folder",
                    title: name,
                    url: "",
                    selected: true,
                    fixed: false,
                    remove: false,
                    origin: 0,
                    categoryId: linkEditor ? linkEditor.categoryId : null,
                    children: []
                }, list, true);
                initDraggableLinks(
                    elements.modal.find("div." + $.cl.scrollBox.wrapper),
                    "> ul." + $.cl.result + " > li"
                );
            });
            
            elements.modal.on("click"," ul > li."+$.cl.remove +" > span",(e) => {
            	
            	$(e.target).parents("li."+$.cl.remove).remove();
            	
            });
            
            //click listen
            elements.modal.on("click","ul[data-type=\"custom\"] > li.favicon-preview > button.add-shortcut",(e) => {
                e.preventDefault();
                e.stopPropagation();

                const btn = e.currentTarget;
                btn.setAttribute("disabled", "disabled");
                
                const titleInput = elements.modal.find("ul[data-type=\"custom\"] > li > input[name='title']")[0];
                const urlInput = elements.modal.find("ul[data-type=\"custom\"] > li > input[name='url']")[0];
                const previewImg = elements.modal.find("ul[data-type=\"custom\"] > li.favicon-preview > img");
                const defaultPreview = $.api.runtime.getURL("media/img/icon/newtab/icon-custom.png");
                
                const customNavigation = {
                    title: titleInput ? titleInput.value : "",
                    url: urlInput ? urlInput.value : "",
                    fixed:false,
                    selected:true,
                    remove:false,
                    origin:0,//本地用户添加
                    categoryId: linkEditor ? linkEditor.categoryId : null,
                    // Do not attach data: icons here — sync storage cannot hold base64 payloads.
                    icon: null
                }
                
                if(customNavigation.title && customNavigation.url){
                	addEntry(customNavigation,elements.modal.find("ul."+$.cl.result), true);
                }

                if (titleInput) {
                    titleInput.value="";
                }
                if (urlInput) {
                    urlInput.value="";
                }
                if (previewImg.length() > 0) {
                    previewImg.attr("src", defaultPreview);
                }

                const label = n.helper.i18n.get("new_tab_add_navigation_url")
                    || n.helper.i18n.get("overlay_save")
                    || "Add";
                btn.textContent = label;
                btn.removeAttribute("disabled");
                
                initDraggableLinks(elements.modal.find("div."+$.cl.scrollBox.wrapper), "> ul."+$.cl.result+" > li");//刷新drag
            });

            // Live favicon preview — debounce input so it updates while typing
            let previewTimer = null;
            let previewReq = 0;
            const refreshFaviconPreview = () => {
                const urlInput = elements.modal.find("ul[data-type=\"custom\"] > li > input[name='url']")[0];
                const titleInput = elements.modal.find("ul[data-type=\"custom\"] > li > input[name='title']")[0];
                const previewImg = elements.modal.find("ul[data-type=\"custom\"] > li.favicon-preview > img");
                if (!urlInput || previewImg.length() === 0) {
                    return;
                }
                const url = (urlInput.value || "").trim();
                const title = (titleInput && titleInput.value) || url;
                const fallbackTitle = title || url || "N";
                const reqId = ++previewReq;

                if (!/^https?:\/\//i.test(url)) {
                    n.helper.dao.call("getFavicon", {
                    	url: url || "https://local.invalid/",
                    	icon: {size: 32, title: fallbackTitle},
                    	query: true
                    }).then((response) => {
                    	if (reqId !== previewReq) {
                    		return;
                    	}
                    	if (response && response.img) {
                    		previewImg.attr("src", response.img);
                    	}
                    });
                    return;
                }

                n.helper.dao.call("getFavicon", {url: url, icon: {size: 32, title: fallbackTitle}, query: true}).then((response) => {
                    if (reqId !== previewReq) {
                        return;
                    }
                    if (response && response.img) {
                        previewImg.attr("src", response.img);
                    }
                });
            };

            const scheduleFaviconPreview = () => {
                if (previewTimer) {
                    clearTimeout(previewTimer);
                }
                previewTimer = setTimeout(refreshFaviconPreview, 400);
            };

            elements.modal.on("input change blur", "ul[data-type=\"custom\"] > li > input[name='url']", () => {
                scheduleFaviconPreview();
            });
            elements.modal.on("blur", "ul[data-type=\"custom\"] > li > input[name='title']", () => {
                scheduleFaviconPreview();
            });
        };
    };

})(jsu);