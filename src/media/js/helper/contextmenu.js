($ => {
    "use strict";

    /**
     * @param {object} ext
     * @constructor
     */
    $.ContextmenuHelper = function (ext) {
        
        let sidebarPos = null;
        let sidebarWidth = 0;
        let addMenuTimeout = null;
        const clickFuncs = {};

        /**
         * Generates a contextmenu of the given type for the given element
         *
         * @param {string} type
         * @param {jsu} elm
         */
        this.create = (type, elm) => {
            
            ext.helper.ball.addSidebarHoverClass();
            
            this.close(); // close other contextmenus
            elm.addClass($.cl.active);

            const contextmenu = $("<div></div>")
                .addClass($.cl.contextmenu.wrapper)
                .html("<ul class='" + $.cl.contextmenu.list + "'></ul>")
                .attr($.attr.type, type)
                .data("elm", elm)
                .appendTo(ext.elm.sidebar);

            let trackingLabel = type;
            const elmId = elm.attr($.attr.id);
            if (elmId) {
                contextmenu.attr($.attr.id, elmId);
            }

            switch (type) {
                case "list": {
                    handleListMenu(contextmenu, elm);
                    const data = ext.helper.entry.getDataById(elmId);
                    trackingLabel = data && data.isDir ? "directory" : "bookmark";
                    break;
                }
                case "separator": {
                    handleSeparatorMenu(contextmenu, elm);
                    break;
                }

            }

            initEvents(contextmenu);
            setPosition(contextmenu, elm, type);

            $.delay().then(() => {
                contextmenu.addClass($.cl.visible);
            });
        };

        /**
         * Closes all open contextmenus
         */
        this.close = () => {
            const contextmenus = ext.elm.iframeBody.find("div." + $.cl.contextmenu.wrapper);

            contextmenus.forEach((contextmenu) => {
                $(contextmenu).removeClass($.cl.visible);
                $(contextmenu).data("elm").removeClass($.cl.active);
            });

            $.delay(200).then(() => {
                contextmenus.remove();
                ext.helper.ball.removeSidebarHoverClass();
            });
        };

        /**
         * Returns whether a contextmenu from the same type and if available with the same element id already exists
         *
         * @param {string} type
         * @param {jsu} elm
         * @return {boolean}
         */
        const alreadyExists = (type, elm) => {
            const elmId = elm.attr($.attr.id);
            const value = elm.attr($.attr.value);

            let existingElm = "div." + $.cl.contextmenu.wrapper + "[" + $.attr.type + "='" + type + "']";
            if (elmId) {
                existingElm += "[" + $.attr.id + "='" + elmId + "']";
            } else if (value) {
                existingElm += "[" + $.attr.value + "='" + value + "']";
            }

            return ext.elm.sidebar.find(existingElm).length() > 0;
        };

        /**
         * Extends the contextmenu with the available sort flags
         *
         * @param {jsu} contextmenu
         */
        const handleSortMenu = (contextmenu) => {
            const sortList = ext.helper.util.getSortList();
            const currentSort = ext.helper.list.getSort();
            const list = contextmenu.children("ul." + $.cl.contextmenu.list);
            contextmenu.children("ul." + $.cl.contextmenu.icons).remove();

            Object.keys(sortList).forEach((value) => {
                const langName = value.replace(/([A-Z])/g, "_$1").toLowerCase();
                $("<li></li>")
                    .append(ext.helper.checkbox.get(ext.elm.iframeBody, {
                        [$.attr.name]: "sort",
                        [$.attr.value]: value
                    }, "radio"))
                    .append("<a " + $.attr.name + "='sort'>" + ext.helper.i18n.get("sort_label_" + langName) + "</a>")
                    .appendTo(list);

                if (value === currentSort.name) {
                    contextmenu.find("input[" + $.attr.name + "='sort'][" + $.attr.value + "='" + value + "']").parent("div." + $.cl.checkbox.box).trigger("click");
                }
            });
        };

        /**
         * Extends the contextmenu with the links which are relevant for the header menu
         *
         * @param {jsu} contextmenu
         */
        const handleHeaderMenu = (contextmenu) => {
            const list = contextmenu.children("ul." + $.cl.contextmenu.list);
            const iconWrapper = contextmenu.children("ul." + $.cl.contextmenu.icons);

            $("<li></li>")
                .append(ext.helper.checkbox.get(ext.elm.iframeBody, {[$.attr.name]: "toggleHidden"}))
                .append("<a " + $.attr.name + "='toggleHidden'>" + ext.helper.i18n.get("contextmenu_toggle_hidden") + "</a>")
                .appendTo(list);

            if (ext.helper.dao.getData("u/showHidden")) {
                contextmenu.find("input[" + $.attr.name + "='toggleHidden']").parent("div." + $.cl.checkbox.box).trigger("click");
            }

            $("<li></li>")
                .append("<a " + $.attr.name + "='select'>" + ext.helper.i18n.get("contextmenu_select_entries") + "</a>")
                .appendTo(list);

            $("<li></li>")
                .append("<a " + $.attr.name + "='reload'>" + ext.helper.i18n.get("contextmenu_reload_sidebar") + "</a>")
                .appendTo(list);

            const bookmarkList = ext.elm.bookmarkBox.all.children("ul");
            const hideRoot = bookmarkList.hasClass($.cl.sidebar.hideRoot);
            let hasOpenedDirectories = false;

            bookmarkList.find("a." + $.cl.sidebar.dirOpened).forEach((dir) => {
                if (hideRoot === false || $(dir).parents("li").length() > 1) {
                    hasOpenedDirectories = true;
                    return false;
                }
            });

            if (hasOpenedDirectories) { // show option to close all opened directories when at least one is opened
                $("<li></li>")
                    .append("<a " + $.attr.name + "='closeAll'>" + ext.helper.i18n.get("contextmenu_close_all_directories") + "</a>")
                    .appendTo(list);
            }

            iconWrapper
                .append("<li><a " + $.attr.name + "='settings' title='" + ext.helper.i18n.get("manage_title", null, true) + "'></a></li>")
                .append("<li><a " + $.attr.name + "='bookmarkManager' title='" + ext.helper.i18n.get("contextmenu_bookmark_manager", null, true) + "'></a></li>")
                .append("<li class='" + $.cl.contextmenu.right + "'><a " + $.attr.name + "='keyboardShortcuts' title='" + ext.helper.i18n.get("contextmenu_keyboard_shortcuts", null, true) + "'></a></li>");
        };

        /**
         * Extends the contextmenu with the links which are relevant for the separators
         *
         * @param {jsu} contextmenu
         * @param {jsu} elm
         */
        const handleSeparatorMenu = (contextmenu, elm) => {
            
            const elmId = elm.attr($.attr.id);
            const data = ext.helper.entry.getDataById(elmId);

            if (data && data.parents && data.parents.length > 0) {
                const list = contextmenu.children("ul." + $.cl.contextmenu.list);
                list.append("<li><a " + $.attr.name + "='edit'>" + ext.helper.i18n.get("contextmenu_edit_separator") + "</a></li>");
                list.append("<li><a " + $.attr.name + "='delete'>" + ext.helper.i18n.get("contextmenu_delete_separator") + "</a></li>");
            }
        };

        /**
         * Extends the contextmenu with the links which are relevant for the bookmark list
         *
         * @param {jsu} contextmenu
         * @param {jsu} elm
         */
        const handleListMenu = (contextmenu, elm) => {
            
            //获取数据
            const elmId = elm.attr($.attr.id);
            let i18nAppend=elm.hasClass("dir")?"_dir":elm.hasClass("separator")?"_separator":"_bookmark";
            const data = ext.helper.entry.getDataById(elmId);
            if (!data) {
                return;
            }

            //list
            const list = contextmenu.children("ul." + $.cl.contextmenu.list);

            const pinnedElm = elm.parents("li."+$.cl.sidebar.freUsed).find("> ul > li").length() > 0;

			if (data.parents.length > 0) { // root level can not be edited or deleted
			
				list.append("<li><a " + $.attr.name + "='edit'>"+ext.helper.i18n.get("contextmenu_edit" + i18nAppend, null, true)+"</a></li>")
	                .append("<li><a " + $.attr.name + "='delete'>"+ext.helper.i18n.get("contextmenu_delete" + i18nAppend, null, true)+"</a></li>");
	                    
				if(!data.isDir){
					list.append("<li><a " + $.attr.name + "='copyToClipboard'>"+ext.helper.i18n.get("contextmenu_copy", null, true)+"</a></li>");
				}
				
				if(data.url !== undefined && data.url.indexOf("about:blank") === -1 && !pinnedElm){//bookmark
					list.append("<li><a " + $.attr.name + "='pin'>"+ext.helper.i18n.get("contextmenu_add_pin", null, true)+"</a></li>");
				}
			}
			
			if (pinnedElm) {
				list.append("<li><a " + $.attr.name + "='unpin'>"+ext.helper.i18n.get("contextmenu_add_unpin", null, true)+"</a></li>");
			}
        };

        /**
         * Sets the correct position for the contextmenu based on the type
         *
         * @param {jsu} contextmenu
         * @param {jsu} elm
         * @param {string} type
         */
        const setPosition = (contextmenu, elm, type) => {
            const dim = {w: contextmenu.realWidth(), h: contextmenu.realHeight()};
            const elmBoundClientRect = elm[0].getBoundingClientRect();
            const top = elmBoundClientRect.top + elmBoundClientRect.height;

            if (top + dim.h >= window.innerHeight) { // no space to show contextmenu on bottom -> show on top instead
                contextmenu.css("top", top - dim.h).addClass($.cl.contextmenu.top);
            } else {
                contextmenu.css("top", top + "px");
            }

            const offset = {
                left: elm.parent("li")[0].offsetLeft,
                right: "auto"
            };

            if (ext.helper.i18n.isRtl()) {
                offset.left = elmBoundClientRect.width - dim.w;

                if (sidebarPos === "left" && offset.left < 0) { // contextmenu will be cut at the left -> limit left position to positive values to prevent that
                    offset.left = 0;
                }
            }

            ["left"].forEach((pos) => {
                if (typeof offset[pos] === "number") {
                    offset[pos] += "px";
                }
                contextmenu.css(pos, offset[pos]);
            });
        };

        /**
         * Show the extension settings
         */
        clickFuncs.settings = () => {
            ext.helper.dao.call("openLink", {
                href: $.api.extension.getURL("html/settings.html"),
                newTab: true
            });
        };

        /**
         * Triggers a click event on the checkbox
         *
         * @param {object} opts
         */
        clickFuncs.checkbox = (opts) => {
            opts.eventObj.stopPropagation();
            $(opts.elm).prev("div." + $.cl.checkbox.box).trigger("click");
        };

        /**
         * Opens the default bookmark manager
         */
        clickFuncs.bookmarkManager = () => {
            ext.helper.dao.call("openLink", {
                href: "chrome://bookmarks",
                newTab: true,
                active: true
            });
        };

        /**
         * Opens the bookmark in a new incognito window
         *
         * @param {object} opts
         */
        clickFuncs.newIncognito = (opts) => {
            if (opts.data) {
                ext.helper.util.openUrl(opts.data, "incognito");
            }
        };

        /**
         * Opens the bookmark in a new window
         *
         * @param {object} opts
         */
        clickFuncs.newWindow = (opts) => {
            if (opts.data) {
                ext.helper.util.openUrl(opts.data, "newWindow");
                ext.helper.ball.closeSidebar();
            }
        };

        /**
         * Opens the bookmark in the current tab
         *
         * @param {object} opts
         */
        clickFuncs.currentTab = (opts) => {
            if (opts.data) {
                opts.data.reopenSidebar = ext.helper.dao.getData("b/reopenSidebar");
                ext.helper.util.openUrl(opts.data);
            }
        };

        /**
         * Opens the bookmark in a new tab
         *
         * @param {object} opts
         */
        clickFuncs.newTab = (opts) => {
            if (opts.data) {
                const inForeground = ext.helper.dao.getData("b/newTab") === "foreground";
                opts.data.reopenSidebar = ext.helper.dao.getData("b/reopenSidebar");
                ext.helper.util.openUrl(opts.data, "newTab", inForeground);

                if (inForeground) {
                    ext.helper.ball.closeSidebar();
                }
            }
        };

        /**
         * Deletes the given entry
         *
         * @param {object} opts
         */
        clickFuncs["delete"] = (opts) => {
            ext.helper.bookmark.removeEntry(opts);
        };

        /**
         * Shows the hidden entries
         *
         * @param {object} opts
         */
        clickFuncs.showHidden = (opts) => {
            ext.startLoading();
            const hiddenEntries = ext.helper.dao.getData("u/hiddenEntries");
            delete hiddenEntries[opts.id];

            ext.helper.dao.setData({"u/hiddenEntries": hiddenEntries}).then(() => {
                return Promise.all([
                    ext.helper.dao.call("removeCache", {name: "htmlList"}),
                ]);
            }).then(() => {
                ext.helper.dao.call("reload", {type: "Hide"});
            });
        };

        /**
         * Opens all children of the given directory
         *
         * @param {object} opts
         */
        clickFuncs.openChildren = (opts) => {
            if (opts.data) {
                const bookmarks = opts.data.children.filter(val => val.url && val.url !== "about:blank");
                if (bookmarks.length > ext.helper.dao.getData("b/openChildrenWarnLimit")) { // more than x bookmarks -> show confirm dialog
                    ext.helper.overlay.create(opts.name, ext.helper.i18n.get("contextmenu_open_children"), opts.data);
                } else { // open bookmarks directly without confirmation
                    ext.helper.util.openAllBookmarks(bookmarks);
                }
            }
        };

        /**
         * Pins the given entry to the top
         *
         * @param {object} opts
         */
        clickFuncs.pin = (opts) => {
            ext.helper.bookmark.pinEntry(opts.data).then(() => {
                ext.helper.dao.call("reload", {type: "Pin"});
            });
        };

        /**
         * Unpins the given entry from the top
         *
         * @param {object} opts
         */
        clickFuncs.unpin = (opts) => {
            ext.helper.bookmark.unpinEntry(opts.data).then(() => {
                ext.helper.dao.call("reload", {type: "Unpin"});
            });
        };

        /**
         * Copies the URL of the given bookmark to the clipboard
         *
         * @param {object} opts
         */
        clickFuncs.copyToClipboard = (opts) => {
            
            const data = ext.helper.entry.getDataById(opts.id);

            if (data && data.url && ext.helper.util.copyToClipboard(data.url)) {
                const box = ext.helper.list.getActiveBookmarkBox();
                
                let elm=box.children(`ul > li:not(.${$.cl.sidebar.freUsed})`).find("a[" + $.attr.id + "='" + data.id + "']");
                if(opts.freUsed){
                	elm=box.find("ul > li."+$.cl.sidebar.freUsed).find("a[" + $.attr.id + "='" + data.id + "']");
                }

                $(elm).children("span." + $.cl.sidebar.copied).remove();
                const copiedNotice = $("<span></span>").addClass($.cl.sidebar.copied).html(ext.helper.i18n.get("sidebar_copied_to_clipboard")).appendTo(elm);

                $.delay(100).then(() => {
                    $(elm).addClass($.cl.sidebar.copied);
                    return $.delay(1000);
                }).then(() => {
                    $(elm).removeClass($.cl.sidebar.copied);
                    return $.delay(100);
                }).then(() => {
                    copiedNotice.remove();
                });
            }
        };

        /**
         * Shows search result in normal bookmark list
         *
         * @param {object} opts
         */
        clickFuncs.showInDir = (opts) => {
            const data = ext.helper.entry.getDataById(opts.id);
            if (data && data.parents) {
                const openParent = (i) => {
                    if (data.parents[i]) {
                        const entry = ext.elm.bookmarkBox.all.find("ul > li > a." + $.cl.sidebar.bookmarkDir + "[" + $.attr.id + "='" + data.parents[i] + "']");
                        if (!entry.hasClass($.cl.sidebar.dirOpened)) {
                            ext.helper.list.toggleBookmarkDir(entry, true, false).then(() => {
                                openParent(i + 1);
                            });
                        } else {
                            openParent(i + 1);
                        }
                    } else { // all parents opened -> close search and scroll to the bookmark
                        Promise.all([
                            ext.helper.list.cacheList(),
                            ext.helper.search.clearSearch()
                        ]).then(() => {
                            const entry = ext.elm.bookmarkBox.all.find("ul > li > a[" + $.attr.id + "='" + opts.id + "']");
                            ext.helper.scroll.setScrollPos(ext.elm.bookmarkBox.all, entry[0].offsetTop - 50);
                            entry.addClass($.cl.sidebar.mark);
                        });
                    }
                };

                openParent(0);
            }
        };

        /**
         * Selects the given entry
         */
        clickFuncs.select = (opts) => {
            if (opts.id) {
                ext.helper.selection.select(opts.id);
            } else {
                ext.helper.selection.start();
            }
        };

        /**
         * Removes the selection of the given entry
         */
        clickFuncs.deselect = (opts) => {
            ext.helper.selection.deselect(opts.id);
        };

        /**
         * Forces the sidebar to reload
         */
        clickFuncs.reload = () => {
            ext.helper.dao.setData({
                "u/openStates": {}
            }).then(() => {
                ext.helper.dao.call("reload", {type: "Force"});
            });
        };

        /**
         * Closes all opened directories
         */
        clickFuncs.closeAll = () => {
            const list = ext.elm.bookmarkBox.all.children("ul");
            const hideRoot = list.hasClass($.cl.sidebar.hideRoot);
            const promises = [];

            list.find("a." + $.cl.sidebar.dirOpened).forEach((dir) => {
                if (hideRoot === false || $(dir).parents("li").length() > 1) {
                    promises.push(ext.helper.list.toggleBookmarkDir($(dir), false, false));
                }
            });

            Promise.all(promises).then(() => {
                ext.helper.list.cacheList();
            });
        };

        /**
         * Shows the menu for adding a new entry
         *
         * @param {jsu} contextmenu
         */
        const showAddMenu = (contextmenu) => {
            if (addMenuTimeout) {
                clearTimeout(addMenuTimeout);
            }
            contextmenu.find("ul[" + $.attr.name + "='add']").addClass($.cl.visible);
        };

        /**
         * Hides the menu for adding a new entry after a small delay
         *
         * @param {jsu} contextmenu
         */
        const hideAddMenu = (contextmenu) => {
            if (addMenuTimeout) {
                clearTimeout(addMenuTimeout);
            }
            addMenuTimeout = setTimeout(() => {
                contextmenu.find("ul[" + $.attr.name + "='add']").removeClass($.cl.visible);
            }, 300);
        };

        /**
         * Initializes the events for the contextmenus
         *
         * @param {jsu} contextmenu
         */
        const initEvents = (contextmenu) => {

            contextmenu.find("> ul > li > a").on("mouseenter", (e) => {
                const elm = $(e.currentTarget);
                contextmenu.find("a").removeClass($.cl.hover);
                elm.addClass($.cl.hover);

                if (elm.parents("ul." + $.cl.contextmenu.icons).length() > 0 && elm.attr($.attr.name) === "add") { // show sub menu when hovering the add-button
                    showAddMenu(contextmenu);
                }
            }).on("mouseleave", (e) => {
                const elm = $(e.currentTarget);
                elm.removeClass($.cl.hover);
                hideAddMenu(contextmenu);
            });

            contextmenu.find("a").on("click", (e) => {
                e.preventDefault();

                let elm = e.currentTarget;
                const parentElm = $(elm).parents("ul").eq(0).prev("a");
                if (parentElm.length() > 0) { // click on submenu entry -> perform the action of the parent element
                    elm = parentElm;
                }
                
                const opts = {
                    elm: elm,
                    eventObj: e,
                    name: $(elm).attr($.attr.name),
                    id: contextmenu.attr($.attr.id),
                    type:contextmenu.attr($.attr.type),
                    freUsed:contextmenu.find("li > a[" + $.attr.name + "='unpin']").length()>0,
                };

                opts.data = opts.id ? ext.helper.entry.getDataById(opts.id) : {};
                opts.data.overlayType = $(e.currentTarget).attr($.attr.type);
                
                //close contextmenu
				ext.helper.contextmenu.close();
				
				//触发函数，不需要弹框
                if (typeof clickFuncs[opts.name] === "function") {
                    clickFuncs[opts.name](opts);
                } else {
                    ext.helper.confirm.create(opts.name, $(opts.elm).attr("title") || $(opts.elm).text(), opts.data);
                }
            });
        };
    };

})(jsu);