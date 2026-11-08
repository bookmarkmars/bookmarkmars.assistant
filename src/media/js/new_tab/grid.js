($ => {
    "use strict";

    $.GridHelper = function (n) {

        let maxCols = 0;
        let maxRows = 0;
        let updateRunning = false;
        let currentPage = 1;
        let linkList=[];
        let activeCategoryId = null;
        let navCategories = [];
        let navTiles = [];
        let updatePending = false;

        const colWidth = 168;
        const rowHeight = 128;

        /**
         *
         * @returns {Promise}
         */
        this.init = async () => {
            
            initEvents();
            
            n.elm.grid.html("");
            $("<nav></nav>").addClass("nt-cats").appendTo(n.elm.grid);
            $("<ul></ul>").appendTo(n.elm.grid);
            maxCols = n.helper.dao.getData("n/gridMaxCols");
            maxRows = n.helper.dao.getData("n/gridMaxRows");
            // Redesign: use wider grid even if an older sync value capped cols at 5
            if (!maxCols || maxCols < 7) {
                maxCols = 8;
            }
            if (!maxRows || maxRows < 2) {
                maxRows = 2;
            }
            
            // Local-first: render from local/cache immediately; cloud restore is background-only
            loadNavigation().then(()=>{
            	getLinkList();
            	updateEntries();
            	showPendingRestoreToast();
            	restoreShortcutsFromServer();
            })
        };

        /**
         * Toast after reload when cloud restore just applied.
         */
        const showPendingRestoreToast = () => {
        	try {
        		if (sessionStorage.getItem("be_shortcuts_restored") === "1") {
        			sessionStorage.removeItem("be_shortcuts_restored");
        			const msg = n.helper.i18n.get("new_tab_shortcuts_restored")
        				|| "Cloud shortcuts restored";
        			if (typeof n.createToast === "function") {
        				n.createToast(msg, 3);
        			}
        		}
        	} catch (e) {
        		// sessionStorage may be unavailable
        	}
        };

        /**
         * 根据窗口大小调整
         */
        this.handleWindowResize = async () => {
            const amount = getAmount();
            const currentTotal = n.elm.grid.children("ul").data("total");

            if (amount.total !== currentTotal) {
                await updateEntries();
            }
        };

        /**
         * Initialises the eventhandlers
         */
        const initEvents = () => {
            
            $(window).on("resize.grid", () => {
                this.handleWindowResize();
            }, {passive: true});


			//click

			n.elm.grid.on("click auxclick", "> ul > li > a", (e) => { // handle chrome urls -> regular clicking will be blocked

                e.preventDefault();
                
                if (e.button === 0 || e.button === 1) {
                    const link = $(e.currentTarget);
                    if (link.attr($.attr.type) === "folder" || link.data("folder")) {
                        // Mini icon in 2×2 preview → open that site. Big tile → organize popup.
                        const directUrl = findFolderPreviewHref(e.target);
                        if (directUrl) {
                            n.helper.dao.call("openLink", {
                                href: directUrl,
                                newTab: e.type === "auxclick",
                                position: n.helper.dao.getData("b/newTabPosition"),
                                active: e.type !== "auxclick"
                            });
                            return;
                        }
                        openFolderOverlay(link.data("folder") || link.data("folderId"), true);
                        return;
                    }
                    n.helper.dao.call("openLink", {
                        href: link.data("href"),
                        newTab: e.type === "auxclick",
                        position: n.helper.dao.getData("b/newTabPosition"),
                        active: e.type !== "auxclick"
                    });
                }
            });
            
            n.elm.grid.on("click", "nav.nt-cats > button", (e) => {
            	e.preventDefault();
            	const id = $(e.currentTarget).attr("data-category");
            	if (!id || id === activeCategoryId) {
            		return;
            	}
            	activeCategoryId = id;
            	currentPage = 1;
            	n.helper.dao.setData({ "n/activeCategory": id });
            	renderTabs();
            	getLinkList();
            	updateEntries();
            });

            n.elm.grid.on("mouseenter", () => {
            	n.elm.grid.addClass("is-hover");
            });
            n.elm.grid.on("mouseleave", () => {
            	n.elm.grid.removeClass("is-hover");
            });

            //翻页左
            n.elm.grid.on("click auxclick", "div.scroll-left", (e) => {
            		currentPage--;
            		if(currentPage<1){currentPage=1;}
            		updateEntries();
            });
            
            //翻页右
            n.elm.grid.on("click auxclick", "div.scroll-right", (e) => {
            	    currentPage++;
            	    const totalPage=n.elm.grid.children("ul").attr("totalPage");
            	    if(currentPage>totalPage){currentPage=totalPage;}
            	    updateEntries();
            });

            // Drag a shortcut onto a folder to nest it.
            // Drag a normal folder onto a shortcut to take that shortcut's place.
            // Pinned and any locked shortcut stay put: no drag, no copy, no reorder.
            let gridDragUrl = null;
            const beginGridDrag = (e, token) => {
                if (!token) {
                    gridDragUrl = null;
                    return;
                }
                gridDragUrl = token;
                try {
                    e.originalEvent.dataTransfer.setData("text/plain", token);
                    e.originalEvent.dataTransfer.effectAllowed = "move";
                } catch (err) {
                    // some environments block dataTransfer
                }
                $(e.currentTarget).addClass("nt-dragging");
            };
            n.elm.grid.on("dragstart", "> ul > li.is-locked", (e) => {
                e.preventDefault();
                gridDragUrl = null;
            });
            n.elm.grid.on("dragstart", "> ul > li:not(.nt-folder):not(.is-locked)", (e) => {
                const link = $(e.currentTarget).children("a");
                const href = link.data("href") || link.attr("href") || "";
                if (!href || href === "#") {
                    gridDragUrl = null;
                    return;
                }
                beginGridDrag(e, href);
            });
            n.elm.grid.on("dragstart", "> ul > li.nt-folder:not(.is-locked)", (e) => {
                const link = $(e.currentTarget).children("a");
                const folderId = link.attr("data-folder-id") || link.data("folderId") || "";
                if (!folderId) {
                    gridDragUrl = null;
                    return;
                }
                beginGridDrag(e, "folder:" + folderId);
            });
            n.elm.grid.on("dragend", "> ul > li", () => {
                gridDragUrl = null;
                n.elm.grid.find("li").removeClass("nt-dragging nt-drop-target");
            });
            n.elm.grid.on("dragenter dragover", "> ul > li.nt-folder", (e) => {
                if (!gridDragUrl) {
                    return;
                }
                e.preventDefault();
                $(e.currentTarget).addClass("nt-drop-target");
            });
            n.elm.grid.on("dragleave", "> ul > li.nt-folder", (e) => {
                $(e.currentTarget).removeClass("nt-drop-target");
            });
            n.elm.grid.on("dragenter dragover", "> ul > li:not(.nt-folder):not(.is-locked)", (e) => {
                if (!gridDragUrl) {
                    return;
                }
                e.preventDefault();
                $(e.currentTarget).addClass("nt-drop-target");
            });
            n.elm.grid.on("dragleave", "> ul > li:not(.nt-folder)", (e) => {
                $(e.currentTarget).removeClass("nt-drop-target");
            });
            n.elm.grid.on("drop", "> ul > li:not(.nt-folder):not(.is-locked)", (e) => {
                e.preventDefault();
                if ($(e.currentTarget).hasClass("is-locked")) {
                    gridDragUrl = null;
                    return;
                }
                const targetUrl = $(e.currentTarget).children("a").attr("href") || "";
                const token = gridDragUrl
                    || (e.originalEvent.dataTransfer && e.originalEvent.dataTransfer.getData("text/plain"));
                n.elm.grid.find("li").removeClass("nt-dragging nt-drop-target");
                gridDragUrl = null;
                if (!token || !targetUrl || token === targetUrl) {
                    return;
                }
                if (String(token).indexOf("folder:") === 0) {
                    this.reorderEntry(
                        {type: "folder", id: String(token).slice(7)},
                        {type: "link", url: targetUrl}
                    );
                    return;
                }
                this.reorderEntry({type: "link", url: token}, {type: "link", url: targetUrl});
            });
            n.elm.grid.on("drop", "> ul > li.nt-folder", (e) => {
                e.preventDefault();
                e.stopPropagation();
                const folderLink = $(e.currentTarget).children("a");
                const folderId = folderLink.attr("data-folder-id") || folderLink.data("folderId");
                const token = gridDragUrl
                    || (e.originalEvent.dataTransfer && e.originalEvent.dataTransfer.getData("text/plain"));
                const targetLocked = $(e.currentTarget).hasClass("is-locked");
                n.elm.grid.find("li").removeClass("nt-dragging nt-drop-target");
                gridDragUrl = null;
                if (!folderId || !token) {
                    return;
                }
                if (String(token).indexOf("folder:") === 0) {
                    const dragId = String(token).slice(7);
                    if (targetLocked || dragId === folderId) {
                        return;
                    }
                    this.reorderEntry({type: "folder", id: dragId}, {type: "folder", id: folderId});
                    return;
                }
                this.moveLinkIntoFolder(token, folderId);
            });
        };

        /**
         * Returns info about how much columns and rows should be displayed, based on how much space is on the screen
         *
         * @returns {object}
         */
        const getAmount = () => {
            
            const ret = {
                cols: maxCols,
                rows: maxRows
            };

            const dim = {
                w: n.elm.content[0].offsetWidth || window.innerWidth,
                h: (n.elm.content[0].offsetHeight || window.innerHeight) - n.elm.search.wrapper[0].offsetHeight - 150
            };

            while (colWidth * ret.cols > dim.w && ret.cols > 0) { // adjust column amount to fit the grid on the page
                ret.cols--;
            }

            while (rowHeight * ret.rows > dim.h && ret.rows > 0) { // adjust row amount to fit the grid on the page
                ret.rows--;
            }

            if (ret.cols < 1) {
            	ret.cols = 1;
            }
            if (ret.rows < 1) {
            	ret.rows = 1;
            }

            ret.total = ret.cols * ret.rows;
            return ret;
        };
        
        /**
         * 更新grid的展示
         *
         * @returns {Promise}
         */
        const finishUpdate = () => {
        	updateRunning = false;
        	if (updatePending) {
        		updatePending = false;
        		updateEntries();
        	}
        };

        const updateEntries = () => {
            
            return new Promise((resolve) => {

                if (updateRunning) {
                	updatePending = true;
                	resolve();
                	return;
                }

                const gridWrapper = n.elm.grid.children("ul");

                if (updateRunning === false) {//未更新
                    
                    updateRunning = true;

                    getEntryData().then((data) => {
                    	renderTabs();
                    	
                    	// Shortcuts section: hide the whole grid when empty (unlike Tools card)
                    	if (!data || JSON.stringify(data) === "{}"
                    		|| !data.list || data.list.length === 0) {
                    		gridWrapper.html("").removeClass($.cl.visible);
                    		n.elm.grid.find("div." + $.cl.newtab.scrollLeft
                    			+ ", div." + $.cl.newtab.scrollRight).remove();
                    		if (navCategories.length) {
                    			n.elm.grid.removeClass($.cl.hidden);
                    		} else {
                    			n.elm.grid.addClass($.cl.hidden);
                    		}
                    		finishUpdate();
                    		resolve();
                    		return;
                    	}
                    	n.elm.grid.removeClass($.cl.hidden);
                    	
                        gridWrapper
                            .html("")
                            .attr({
                            	"pageSize":data['pageSize'],
                            	"totalPage":data['totalPage']
                            })
                            .css("grid-template-columns", "1fr ".repeat(data['cols']).trim());
					
                        data['list'].forEach((page) => {
                            const isFolder = page.type === "folder";
                            const entry = $("<li></li>").appendTo(gridWrapper);
                            // jsu toggleClass(name) ignores 2nd arg — it only toggles
                            if (isFolder) {
                                entry.addClass("nt-folder");
                                if (page.locked || page.role === "categoryPin") {
                                	entry.addClass("is-locked");
                                }
                            }
                            const entryLink = $("<a></a>")
                                .attr({
                                    href: isFolder ? "#" : page.url,
                                    title: page.title,
                                    [$.attr.type]: isFolder ? "folder" : "link",
                                    [$.attr.value]: isFolder ? "folder" : (page.url.length === 0 ? "empty" : "url")
                                })
                                .data("href", page.url || "")
                                .appendTo(entry);

                            if (isFolder) {
                                entryLink.data("folder", page);
                                entryLink.data("folderId", page.id || page.categoryId);
                                entryLink.attr("data-folder-id", page.id || page.categoryId || "");
                                renderFolderTile(entryLink, page);
                                if (!(page.locked || page.role === "categoryPin")) {
                                    entry.attr("draggable", "true");
                                }
                            } else if (page.fixed) {
                                entry.addClass("is-locked").attr("draggable", "false");
                                $("<span></span>").text(page.title).appendTo(entryLink);
                                paintShortcutIcon(entryLink, page);
                                entry.find("img").attr("draggable", "false");
                            } else {
                                entry.attr("draggable", "true");
                                $("<span></span>").text(page.title).appendTo(entryLink);
                                paintShortcutIcon(entryLink, page);
                            }
                        });
                        
                        //立马影藏并删除
                        const scrollLeft=n.elm.grid.find("div."+$.cl.newtab.scrollLeft)
                        const scrollRight=n.elm.grid.find("div."+$.cl.newtab.scrollRight);
                        scrollLeft.remove();
                        scrollRight.remove();

                        if(data['totalPage']>1){
	                        // Arrows are positioned by CSS on both sides of #grid
	                        n.elm.grid.prepend(
				            	$("<div></div>")
				            	.addClass($.cl.newtab.scrollLeft)
				            	.append($("<p></p>"))
				            );
				            
				            n.elm.grid.append(
				            	$("<div></div>")
				            	.addClass($.cl.newtab.scrollRight)
				            	.append($("<p></p>"))
				            );
                        }

                        gridWrapper.addClass($.cl.visible);
                        finishUpdate();
                        resolve();
                    });
                }
            });
        };

        /**
         * 返回展示页面
         *
         * @returns {Promise}
         */
        const getEntryData = () => {
            return new Promise((resolve) => {
                
                const amount = getAmount();
                resolve(amount.total > 0 ? getCustomEntries():{});
            });
        };
        
        /**
         * Parse cloud links payload (array or JSON string).
         */
        const parseCloudLinks = (raw) => {
        	let links = raw;
        	if (typeof links === "string") {
        		try {
        			links = JSON.parse(links);
        		} catch (e) {
        			return [];
        		}
        	}
        	return Array.isArray(links) ? links : [];
        };

        /**
         * Sanitize one shortcut / folder for sync storage (no data: icons).
         */
        const sanitizeCloudItem = (item) => {
        	if (!item || !item.title) {
        		return null;
        	}
        	const origin = (item.origin === 1 || item.origin === "1") ? 1 : 0;
        	let icon = item.icon;
        	if (icon && typeof icon === "string" && icon.indexOf("http") === 0) {
        		icon = n.helper.util.normalizeRemoteIconUrl(icon);
        	} else {
        		icon = null;
        	}

        	if (item.type === "folder") {
        		const children = Array.isArray(item.children)
        			? item.children.map(sanitizeCloudItem).filter(Boolean)
        			: [];
        		return {
        			id: item.id || item.categoryId || ("folder-" + Date.now()),
        			type: "folder",
        			title: item.title,
        			url: "",
        			selected: item.selected !== false && item.selected !== "false",
        			fixed: !!item.fixed && item.fixed !== "false",
        			remove: false,
        			origin: origin,
        			icon: null,
        			categoryId: item.categoryId || item.id || null,
        			children: children,
        			lang: item.lang || undefined
        		};
        	}

        	if (!item.url) {
        		return null;
        	}
        	return {
        		id: item.id || undefined,
        		type: "link",
        		title: item.title,
        		url: item.url,
        		selected: item.selected !== false && item.selected !== "false",
        		fixed: !!item.fixed && item.fixed !== "false",
        		remove: false,
        		origin: origin,
        		icon: icon,
        		categoryId: item.categoryId || undefined,
        		lang: item.lang || undefined
        	};
        };

        /**
         * Cloud backup is the user's saved snapshot (order + selection + customs + folders).
         * Sanitize icons; never keep data: URLs in sync storage.
         */
        const sanitizeCloudLinks = (serverLinks) => {
        	return (serverLinks || []).map(sanitizeCloudItem).filter(Boolean);
        };

        /**
         * Stable compare key for shortcut lists (ignore volatile fields like lang).
         */
        const shortcutListFingerprint = (links) => {
        	return (Array.isArray(links) ? links : []).map((item) => {
        		if (!item) {
        			return "";
        		}
        		if (item.type === "folder") {
        			const kids = (item.children || []).map((c) => {
        				return c && c.url
        					? String(c.url).replace(/\/+$/, "").toLowerCase()
        					: "";
        			}).filter(Boolean).join(",");
        			return [
        				"folder",
        				item.id || item.categoryId || "",
        				item.title || "",
        				item.selected === false || item.selected === "false" ? "0" : "1",
        				kids
        			].join("\t");
        		}
        		if (!item.url) {
        			return "";
        		}
        		return [
        			String(item.url).replace(/\/+$/, "").toLowerCase(),
        			item.title || "",
        			item.selected === false || item.selected === "false" ? "0" : "1",
        			item.fixed ? "1" : "0",
        			(item.origin === 1 || item.origin === "1") ? "1" : "0"
        		].join("\t");
        	}).filter(Boolean).join("\n");
        };

        /**
         * Persist n/links (+ optional cloud backup) then refresh the grid.
         * Local save is authoritative for UI refresh; cloud backup is background.
         */
        this.persistLinks = (links, opts) => {
        	const next = n.helper.util.sanitizeShortcutLocks(links || []);
        	const reload = !(opts && opts.reload === false);
        	return n.helper.dao.setData({
        		"n/links": next,
        		"u/shortcutsSeeded": false
        	}).then(() => {
        		// Do not block NTP refresh on network / login
        		n.helper.dao.call("saveShortcuts", {links: next}).then((res) => {
        			if (res && res.code === "ok" && res.data && res.data.updateTime) {
        				n.helper.dao.setData({
        					"u/shortcutsSyncTime": res.data.updateTime,
        					"u/shortcutsLastCheck": Date.now()
        				});
        			}
        		}).catch(() => null);

        		if (reload) {
        			try {
        				(window.top || window).location.reload();
        			} catch (e) {
        				location.reload();
        			}
        			return null;
        		}
        		getLinkList();
        		return updateEntries();
        	});
        };

        this.getNavCategories = () => (navCategories || []).slice();

        this.getActiveCategoryId = () => activeCategoryId;

        /**
         * Drag a tile onto another tile in the same tab.
         * The dragged tile takes that place, and the original shifts back one.
         * Pinned and locked shortcuts are never moved.
         */
        this.reorderEntry = (drag, target) => {
        	const links = (n.helper.dao.getData("n/links") || []).slice();
        	const norm = n.helper.util.normalizeShortcutUrl;
        	const homeId = (navCategories[0] && navCategories[0].id) || "pinned";
        	const catOf = (item) => (item && item.categoryId) || homeId;
        	const isPin = (item) => {
        		return !!(item && item.type === "folder"
        			&& (item.role === "categoryPin" || String(item.id || "").indexOf("pin:") === 0));
        	};
        	const matchRef = (item, ref) => {
        		if (!item || !ref || catOf(item) !== activeCategoryId || isPin(item)) {
        			return false;
        		}
        		if (ref.type === "folder") {
        			return item.type === "folder" && (item.id === ref.id || item.categoryId === ref.id);
        		}
        		return item.type !== "folder" && norm(item.url) === norm(ref.url);
        	};
        	let from = links.findIndex((item) => matchRef(item, drag));
        	if (from < 0) {
        		const tile = (navTiles || []).find((item) => matchRef(item, drag));
        		if (!tile) {
        			return Promise.resolve(false);
        		}
        		links.push(Object.assign({}, tile, {
        			type: drag.type === "folder" ? "folder" : "link",
        			selected: true
        		}));
        		from = links.length - 1;
        	}
        	const moving = links.splice(from, 1)[0];
        	const targetItem = links.find((item) => matchRef(item, target));
        	if (isPin(moving) || (moving && moving.fixed) || (targetItem && targetItem.fixed)) {
        		links.splice(from, 0, moving);
        		return Promise.resolve(false);
        	}
        	let to = links.findIndex((item) => matchRef(item, target));
        	if (to < 0) {
        		links.push(moving);
        	} else {
        		links.splice(to, 0, moving);
        	}
        	return this.persistLinks(links, {reload: false});
        };

        /**
         * Drop a shortcut onto a folder.
         * The locked Pinned folder copies; other folders move.
         * The shortcut just dropped is inserted as the first item in that folder.
         */
        this.moveLinkIntoFolder = (linkUrl, folderId) => {
        	const links = n.helper.dao.getData("n/links") || [];
        	const norm = n.helper.util.normalizeShortcutUrl;
        	const targetUrl = norm(linkUrl);
        	let moving = null;
        	const remaining = [];
        	links.forEach((item) => {
        		if (!item) {
        			return;
        		}
        		if (item.type !== "folder" && norm(item.url) === targetUrl) {
        			moving = item;
        			if (item.fixed) {
        				remaining.push(item);
        			}
        			return;
        		}
        		remaining.push(item);
        	});
        	if (!moving || moving.fixed) {
        		return Promise.resolve(false);
        	}
        	const folder = links.find((item) => {
        		return item && item.type === "folder"
        			&& (item.id === folderId || item.categoryId === folderId);
        	});
        	if (!folder) {
        		return Promise.resolve(false);
        	}
        	if (!Array.isArray(folder.children)) {
        		folder.children = [];
        	}
        	const child = Object.assign({}, moving, {
        		type: "link",
        		selected: true,
        		fixed: false
        	});
        	const alreadyAt = folder.children.findIndex((c) => c && norm(c.url) === targetUrl);
        	if (alreadyAt >= 0) {
        		const existing = folder.children.splice(alreadyAt, 1)[0];
        		folder.children.unshift(existing);
        	} else {
        		folder.children.unshift(child);
        	}
        	const copyOnly = !!(folder.locked || folder.role === "categoryPin");
        	return this.persistLinks(copyOnly ? links : remaining, {reload: false}).then(() => true);
        };

        /**
         * Background restore from cloud. Does not block first paint.
         * A catalog seed retries often. An unsynced real grid retries every 5 minutes.
         * A synced grid checks once a day.
         */
        const shortcutsAreSeed = () => !!n.helper.dao.getData("u/shortcutsSeeded");

        const pushShortcuts = (links) => {
        	return n.helper.dao.call("saveShortcuts", {links: links}).then((res) => {
        		if (res && res.code === "ok" && res.data && res.data.updateTime) {
        			return n.helper.dao.setData({
        				"u/shortcutsSyncTime": res.data.updateTime,
        				"u/shortcutsLastCheck": Date.now(),
        				"u/shortcutsSeeded": false
        			});
        		}
        		return null;
        	}).catch(() => null);
        };

        const restoreShortcutsFromServer = () => {
        	return new Promise((resolve) => {
        		const localSyncTime = Number(n.helper.dao.getData("u/shortcutsSyncTime")) || 0;
        		const lastCheck = Number(n.helper.dao.getData("u/shortcutsLastCheck")) || 0;
        		const seeded = shortcutsAreSeed();
        		const now = Date.now();
        		// A catalog seed (fresh install) retries often so login can replace it.
        		// A real grid that never uploaded retries every 5 minutes.
        		// A grid that already synced checks once a day.
        		const interval = seeded
        			? (15 * 1000)
        			: (localSyncTime ? (24 * 60 * 60 * 1000) : (5 * 60 * 1000));

        		if (lastCheck && (now - lastCheck) < interval) {
        			resolve(false);
        			return;
        		}

        		const markChecked = () => n.helper.dao.setData({"u/shortcutsLastCheck": Date.now()});

        		const applyCloud = (cloudLinks, cloudTime) => {
        			n.helper.dao.setData({
        				"n/links": n.helper.util.sanitizeShortcutLocks(cloudLinks),
        				"u/shortcutsSyncTime": cloudTime || Date.now(),
        				"u/shortcutsLastCheck": Date.now(),
        				"u/shortcutsSeeded": false
        			}).then(() => {
        				try {
        					sessionStorage.setItem("be_shortcuts_restored", "1");
        				} catch (e) {
        					// ignore
        				}
        				location.reload();
        				resolve(true);
        			}).catch(() => resolve(false));
        		};

        		n.helper.dao.call("loadShortcuts").then((res) => {
        			if (!res || res.code === "not_login" || res.code === "error") {
        				markChecked().then(() => resolve(false));
        				return;
        			}
        			if (res.code === "not_found" || res.code !== "ok" || !res.data) {
        				const localLinks = n.helper.dao.getData("n/links") || [];
        				// Create the server row from a real local grid. Never upload the catalog seed.
        				if (!seeded && localLinks.length && res.code === "not_found") {
        					pushShortcuts(localLinks).then(() => resolve(false));
        					return;
        				}
        				markChecked().then(() => resolve(false));
        				return;
        			}

        			const cloudLinks = sanitizeCloudLinks(parseCloudLinks(res.data.links));
        			if (!cloudLinks.length) {
        				markChecked().then(() => resolve(false));
        				return;
        			}

        			const localLinks = n.helper.dao.getData("n/links") || [];
        			const cloudTime = Number(res.data.updateTime) || 0;
        			const syncTime = Number(n.helper.dao.getData("u/shortcutsSyncTime")) || 0;
        			const seededNow = shortcutsAreSeed();
        			const same = shortcutListFingerprint(cloudLinks) === shortcutListFingerprint(localLinks);

        			if (same) {
        				const patch = {
        					"u/shortcutsLastCheck": Date.now(),
        					"u/shortcutsSeeded": false
        				};
        				if (cloudTime) {
        					patch["u/shortcutsSyncTime"] = cloudTime;
        				}
        				n.helper.dao.setData(patch).then(() => resolve(false));
        				return;
        			}

        			// The catalog seed is written before this returns. It is not a user edit,
        			// so a server snapshot replaces it. A real local edit is replaced only
        			// when the server copy is newer than the last successful sync.
        			const cloudWins = localLinks.length === 0
        				|| seededNow
        				|| (syncTime && cloudTime > syncTime);

        			if (cloudWins) {
        				applyCloud(cloudLinks, cloudTime);
        				return;
        			}

        			// This browser already synced and its copy is the newer one.
        			if (syncTime && (!cloudTime || cloudTime <= syncTime)) {
        				pushShortcuts(localLinks).then(() => resolve(false));
        				return;
        			}

        			markChecked().then(() => resolve(false));
        		}).catch(() => {
        			markChecked().then(() => resolve(false));
        		});
        	});
        };

        /**
         * jsu append/prependTo CLONES nodes then removes the originals.
         * Always set src on <img> BEFORE insert, and for async updates
         * query the LIVE img under entryLink (not the detached wrapper).
         */
        const liveIconImg = (entryLink) => {
            const found = entryLink.find("div > img");
            return found && found[0] ? found[0] : null;
        };

        const paintShortcutIcon = (entryLink, page) => {
            const icon = { size: 32, title: page.title || page.url };
            const iconUrl = (page.icon && String(page.icon).indexOf("http") === 0)
            	? n.helper.util.normalizeRemoteIconUrl(page.icon)
            	: "";
            $("<div></div>")
                .append($("<img />").attr({
                	alt: page.title || "",
                	src: iconUrl || "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
                }))
                .prependTo(entryLink);

            if (!page.url) {
                return;
            }

            n.helper.dao.call("getFavicon", {
                url: page.url,
                iconUrl: iconUrl,
                icon: icon,
                query: true
            }).then((response) => {
                const el = liveIconImg(entryLink);
                if (response && response.img && el) {
                    el.src = response.img;
                }
            });
        };

        const renderFolderTile = (entryLink, page) => {
            const preview = $("<div></div>").addClass("nt-folder-preview");
            const kids = (page.children || []).filter((c) => c && c.selected !== false).slice(0, 4);
            kids.forEach((child, idx) => {
                const childIcon = (child.icon && String(child.icon).indexOf("http") === 0)
                	? n.helper.util.normalizeRemoteIconUrl(child.icon)
                	: "";
                const imgAttrs = {
                    alt: child.title || "",
                    "data-folder-icon": String(idx),
                    src: childIcon || "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
                };
                const cell = $("<div></div>");
                if (child.url) {
                    cell.attr("data-href", child.url)
                        .attr("title", child.title || child.url)
                        .addClass("nt-folder-preview-link");
                    cell.data("href", child.url);
                }
                cell.append($("<img />").attr(imgAttrs)).appendTo(preview);

                if (!child.url) {
                    return;
                }
                const childUrl = child.url;
                const childIdx = idx;
                n.helper.dao.call("getFavicon", {
                    url: childUrl,
                    iconUrl: childIcon,
                    icon: { size: 32, title: child.title || childUrl },
                    query: true
                }).then((response) => {
                    if (!response || !response.img) {
                        return;
                    }
                    // Resolve live img after preview was prependTo'd (cloned into DOM)
                    const livePreview = entryLink.find("div.nt-folder-preview");
                    const liveImg = livePreview.find("img[data-folder-icon='" + childIdx + "']");
                    if (liveImg && liveImg[0]) {
                        liveImg[0].src = response.img;
                    }
                });
            });
            while (preview.children().length() < 4) {
                $("<div></div>").addClass("nt-folder-empty").appendTo(preview);
            }
            if (kids.length === 0) {
                preview.addClass("is-empty");
            }
            const label = (page.role === "categoryPin")
            	? (n.helper.i18n.get("new_tab_category_pin") || "Pinned")
            	: page.title;
            $("<span></span>").text(label).appendTo(entryLink);
            // Insert preview last so clones keep children + src
            preview.prependTo(entryLink);
        };

        /**
         * Walk up from the click target to a preview cell that carries data-href.
         */
        const findFolderPreviewHref = (target) => {
            let node = target;
            while (node && node.nodeType === 1) {
                if (node.getAttribute && node.getAttribute("data-href")
                    && node.parentNode
                    && node.parentNode.classList
                    && node.parentNode.classList.contains("nt-folder-preview")) {
                    return node.getAttribute("data-href");
                }
                // Stop at the folder <a> — anything outside preview cells is "big box"
                if (node.getAttribute && node.getAttribute($.attr.type) === "folder") {
                    break;
                }
                node = node.parentNode;
            }
            return null;
        };

        /**
         * @param {object|string} folderOrId
         * @param {boolean=} organize open directly in Organize mode
         */
        const openFolderOverlay = (folderOrId, organize) => {
            let folder = folderOrId;
            if (typeof folderOrId === "string") {
                folder = (n.helper.dao.getData("n/links") || []).find((item) => {
                    return item && item.type === "folder" && (item.id === folderOrId || item.categoryId === folderOrId);
                });
            }
            if (!folder) {
                return;
            }
            if (!Array.isArray(folder.children)) {
                folder.children = [];
            }
            n.helper.popup.create("folder", folder.title || "Folder", {
                folder: folder,
                organize: !!organize
            });
        };

        const parseCatalogPayload = (raw) => {
            if (!raw) {
                return null;
            }
            try {
                let data;
                if (typeof raw === "string") {
                    data = JSON.parse(raw);
                } else if (raw && Object.prototype.hasOwnProperty.call(raw, "data")) {
                    // bg cache shape: { cat, data } — data may already be an object
                    data = typeof raw.data === "string" ? JSON.parse(raw.data) : raw.data;
                } else {
                    data = raw;
                }
                if (data && data.schemaVersion === 2 && Array.isArray(data.categories)) {
                    return data;
                }
                // Legacy flat v1 → wrap as pinned icons
                if (data && Array.isArray(data.children)) {
                    return {
                        schemaVersion: 2,
                        categories: [{
                            id: "pinned",
                            title: "Pinned",
                            display: "icons",
                            weight: 0,
                            children: data.children
                        }]
                    };
                }
            } catch (e) {
                return null;
            }
            return null;
        };

        const loadNavigation = () => {

            // The server sends the global or the Chinese catalog; "catalog" tells which.
            // Anything else (old cache, legacy v1, bundled seed) is global.
            const readV2 = async () => {
                const res = await n.helper.dao.call("getValue", { key: "navigation_v2" });
                if (res && (res.data || res.schemaVersion === 2)) {
                    const catalog = parseCatalogPayload(res);
                    if (catalog) {
                        return { catalog: catalog, id: res.catalog === "cn" ? "cn" : "global" };
                    }
                }
                return null;
            };
            const readLegacy = async () => {
                const res = await n.helper.dao.call("getValue", { key: "navigation" });
                if (res && (res.data || res.children)) {
                    const catalog = parseCatalogPayload(res);
                    if (catalog) {
                        return { catalog: catalog, id: "global" };
                    }
                }
                return null;
            };

            const savedLinks = n.helper.dao.getData("n/links") || [];
            const hasGrid = savedLinks.length > 0;
            // Once the user edits the grid (or restores one from the cloud), it stays on the
            // catalog it holds. Only Chinese catalog entries have cn_ ids.
            const holdsChinese = savedLinks.some((item) => {
                return item && (String(item.id || "").indexOf("cn_") === 0
                    || (item.children || []).some((c) => c && String(c.id || "").indexOf("cn_") === 0));
            });
            const lockCatalog = hasGrid && !n.helper.dao.getData("u/shortcutsSeeded")
                ? (holdsChinese ? "cn" : "global")
                : undefined;
            const fits = (remote) => !!remote && (!lockCatalog || remote.id === lockCatalog);

            return new Promise((resolve) => {
                const readCatalog = async () => {
                    // The background refresh sends this lock with every request.
                    if (lockCatalog && n.helper.dao.getData("u/navCatalogSent") !== lockCatalog) {
                        await n.helper.dao.call("setValue", { key: "u/navCatalog", value: lockCatalog }).catch(() => null);
                        await n.helper.dao.setData({ "u/navCatalogSent": lockCatalog });
                    }
                    const cached = await readV2().catch(() => null);
                    if (fits(cached)) {
                        return cached;
                    }
                    // No cache yet, or the cache is the other catalog. A first run waits a little
                    // longer, so a new user is seeded from the server instead of the bundled list.
                    await n.helper.dao.call("cacheRemote", {
                        name: "navigation_v2",
                        timeout: hasGrid ? undefined : 3000
                    }).catch(() => null);
                    const fresh = await readV2().catch(() => null);
                    if (fresh) {
                        return fresh;
                    }
                    return cached || readLegacy().catch(() => null);
                };

                readCatalog().then((remote) => {
                    const catalogId = (remote && remote.id) || "global";
                    let catalog = remote && remote.catalog;
                    if (!catalog) {
                        catalog = parseCatalogPayload(n.helper.dao.getData("n/topLinks"));
                    }
                    // n/topLinks used to hold the whole catalog inside sync storage and
                    // pushed the newtab item over the 8KB quota, so shortcut saves were dropped.
                    const dropTopLinks = () => {
                    	if (n.helper.dao.getData("n/topLinks")) {
                    		return n.helper.dao.setData({ "n/topLinks": "" });
                    	}
                    	return Promise.resolve();
                    };
                    // A grid locked to the other catalog (offline, or the server could not
                    // serve it) shows what it has. Merging would swap the user's sites.
                    const apply = (source, id) => {
                    	const lang = n.helper.i18n.getLanguage();
                    	navCategories = n.helper.catalog.listTabs(source, lang);
                    	if (!activeCategoryId) {
                    		activeCategoryId = n.helper.dao.getData("n/activeCategory")
                    			|| (navCategories[0] && navCategories[0].id)
                    			|| null;
                    	}
                    	if (lockCatalog && id !== lockCatalog) {
                    		navTiles = [];
                    		return Promise.resolve();
                    	}
                    	const tiles = n.helper.catalog.flattenToTiles(source, lang);
                    	navTiles = tiles;
                    	return appendNewLinks(tiles, id);
                    };

                    if (!catalog) {
                        // Emergency seed (no affiliates), global
                        $.fetch($.api.runtime.getURL("media/conf/navigation_seed.json"), { method: "GET" }).then((obj) => {
                            obj.text().then((data) => {
                                apply(parseCatalogPayload(data), "global").then(resolve);
                            });
                        }).catch(() => resolve());
                        return;
                    }

                    dropTopLinks().then(() => {
                    	return apply(catalog, remote ? catalogId : "global");
                    }).then(resolve);
                }).catch(() => resolve());
            });
        };
        
        /**
         * Merge catalog children into a folder the user already has.
         * Once the user has any children list, it is authoritative — catalog may
         * refresh meta for kept items, but must NOT revive removed ones.
         * Empty user list (first seed) takes the full catalog set.
         */
        const mergeFolderChildren = (userKids, catalogKids, opts) => {
        	const user = Array.isArray(userKids) ? userKids : [];
        	const catalog = Array.isArray(catalogKids) ? catalogKids : [];
        	const keyOf = (c) => {
        		if (!c) {
        			return "";
        		}
        		if (c.id) {
        			return "id:" + c.id;
        		}
        		return "url:" + n.helper.util.normalizeShortcutUrl(c.url || "");
        	};
        	const userManaged = !!(opts && opts.userManaged);

        	// First paint / never organized → seed from catalog
        	if (!user.length && !userManaged) {
        		return catalog.map((c) => Object.assign({}, c));
        	}

        	// Catalog children the catalog dropped go too (e.g. a switch to the Chinese catalog).
        	// If that leaves nothing, the folder seeds again from the new catalog.
        	const fromCatalog = (u) => u && (u.origin === 1 || u.origin === "1");
        	const kept = user.filter((u) => !fromCatalog(u) || catalog.some((c) => keyOf(c) === keyOf(u)));
        	if (user.length && !kept.length) {
        		return catalog.map((c) => Object.assign({}, c));
        	}

        	// User list wins: keep order, refresh catalog meta only for survivors
        	return kept.map((u) => {
        		if (!u) {
        			return u;
        		}
        		const cat = catalog.find((c) => keyOf(c) === keyOf(u));
        		if (!cat || u.origin === 0 || u.origin === "0") {
        			return u;
        		}
        		return Object.assign({}, cat, {
        			selected: u.selected,
        			title: u.title || cat.title,
        			icon: n.helper.util.normalizeRemoteIconUrl(cat.icon || u.icon)
        		});
        	}).filter(Boolean);
        };

        const appendNewLinks = (arr, catalogId)=>{
        	
        	return new Promise((resolve) => {
        		
        		const lang = n.helper.i18n.getLanguage();
	        	let pages = n.helper.dao.getData("n/links") || [];
	        	// An untouched seed from the other catalog is replaced, not merged
	        	// (e.g. the bundled global list was used before the server answered).
	        	if (pages.length && catalogId && n.helper.dao.getData("u/shortcutsSeeded")
	        		&& (n.helper.dao.getData("u/seedCatalog") || "global") !== catalogId) {
	        		pages = [];
	        	}
	        	promoteCategoryFolders(pages);
	        	// First seed may follow catalog weight. After that, saved order wins.
	        	const seeding = pages.length === 0;
	        	// After a cloud restore/save, do not re-inject catalog URLs the user removed
	        	const cloudSynced = !!n.helper.dao.getData("u/shortcutsSyncTime");
	        	const list = [];
	        	const urlWithoutSearch = (url) => {
	        		const key = n.helper.util.normalizeShortcutUrl(url);
	        		const q = key.indexOf("?");
	        		return q >= 0 ? key.slice(0, q) : key;
	        	};
	        	// Market URL and affiliate are separate.
	        	// lang.<locale>.url is always preferred for this language. affiliate true
	        	// also overwrites a saved link the user changed, including inside a folder.
	        	const localeKeys = () => {
	        		let raw = "";
	        		try {
	        			raw = ($.api.i18n.getUILanguage() || "").replace(/-/g, "_");
	        		} catch (err) {
	        			raw = "";
	        		}
	        		const keys = [];
	        		const add = (key) => {
	        			if (key && keys.indexOf(key) < 0) {
	        				keys.push(key);
	        			}
	        		};
	        		add(raw);
	        		add(lang);
	        		if (raw.indexOf("_") > 0) {
	        			add(raw.split("_")[0]);
	        		}
	        		if (lang === "mx" || lang === "cl") {
	        			add("es");
	        		}
	        		add("en");
	        		return keys;
	        	};
	        	const marketPack = (item) => {
	        		const pack = (item && item.lang) || {};
	        		const keys = localeKeys();
	        		for (let i = 0; i < keys.length; i++) {
	        			const loc = pack[keys[i]];
	        			if (loc && loc.url) {
	        				return loc.url;
	        			}
	        		}
	        		return item && item.url;
	        	};
	        	const marketBases = (item) => {
	        		const bases = new Set();
	        		const addBase = (url) => {
	        			if (url) {
	        				bases.add(urlWithoutSearch(url));
	        			}
	        		};
	        		addBase(item && item.url);
	        		Object.keys((item && item.lang) || {}).forEach((key) => {
	        			addBase(item.lang[key] && item.lang[key].url);
	        		});
	        		return bases;
	        	};
	        	const applyMarketUrl = (item) => {
	        		if (!item || item.type === "folder" || !item.url) {
	        			return;
	        		}
	        		const bases = marketBases(item);
	        		const target = marketPack(item);
	        		const apply = (node) => {
	        			if (!node || node.type === "folder" || !node.url) {
	        				return;
	        			}
	        			const idMatch = !!(item.id && node.id === item.id);
	        			const baseMatch = bases.has(urlWithoutSearch(node.url));
	        			if (!baseMatch && !(item.affiliate && idMatch)) {
	        				return;
	        			}
	        			node.url = target;
	        			if (item.id) {
	        				node.id = item.id;
	        			}
	        		};
	        		pages.forEach((node) => {
	        			apply(node);
	        			if (node && node.type === "folder" && Array.isArray(node.children)) {
	        				node.children.forEach(apply);
	        			}
	        		});
	        	};
	        	
	        	arr
	        	.filter(val => !val.remove)//过滤掉已经删除的
	        	.sort(function(x, y) {
	        		return (x.weight === y.weight)? 0 : x.weight > y.weight ? 1 : -1;// 越小权重越大
			    })//sort by weight
	        	.forEach((item)=>{

	        		const isFolder = item.type === "folder";
	        		if (!isFolder) {
	        			const targetUrl = marketPack(item);
	        			if (targetUrl) {
	        				item.url = targetUrl;
	        			}
	        			applyMarketUrl(item);
	        		}
	        		//如果pages中包含该链接（trailing slash / host case 归一后比较）
	        		const itemKey = isFolder
	        			? ("folder:" + (item.id || item.categoryId || item.title))
	        			: n.helper.util.normalizeShortcutUrl(item.url);
	        		const matchPage = (e) => {
	        			if (!e) {
	        				return false;
	        			}
	        			if (isFolder) {
	        				if (e.type !== "folder") {
	        					return false;
	        				}
	        				// Pinned folders are client-owned. Never treat them as a catalog folder.
	        				if (e.role === "categoryPin" || String(e.id || "").indexOf("pin:") === 0) {
	        					return false;
	        				}
	        				return e.id === item.id || e.id === item.categoryId;
	        			}
	        			return e.type !== "folder" && n.helper.util.normalizeShortcutUrl(e.url) === itemKey;
	        		};
	        		if(pages.some(matchPage)){
	        			// Catalog may mark a URL as fixed (e.g. Google) — apply that to
	        			// one row only. User-added duplicates of the same URL must stay editable.
	        			const matches = pages.filter(matchPage);
	        			const primary = matches.find((node) => node.origin === 1 || node.origin === "1")
	        				|| matches[0];

	        			matches.forEach((node) => {
	        				if (node === primary) {
	        					node.origin = item.origin;
	        					node.title = item.title;
	        					node.icon = n.helper.util.normalizeRemoteIconUrl(item.icon);
	        					node.fixed = item.fixed;//服务器端只控制固定权限，select权限给用户
	        					node.lang = item.lang;//别名也可能在服务器端修改
	        					node.type = item.type || node.type || "link";
	        					node.id = item.id || node.id;
	        					node.categoryId = item.categoryId || node.categoryId;
	        					if (isFolder) {
	        						// Folder already lives in n/links → user ownership of children.
	        						// Never re-seed Amazon/eBay/etc. after the user removed them
	        						// (including when children is []).
	        						node.children = mergeFolderChildren(node.children, item.children, {
	        							userManaged: true
	        						});
	        						node.url = "";
	        						node.userManaged = true;
	        						if (item.module || item.id === "tools" || node.id === "tools") {
	        							node.module = true;
	        						}
	        					}
	        				} else {
	        					node.fixed = false;
	        					if (node.origin === 1 || node.origin === "1") {
	        						node.origin = 0;
	        					}
	        				}
	        			});
	        			
	        			return;
	        		}

	        		// After cloud sync: still accept brand-new catalog ids (pagination / ops adds).
	        		// Skip URL-only revival of entries the user fully deleted from n/links.
	        		if (cloudSynced && !item.id && !item.categoryId) {
	        			return;
	        		}
	        		
	        		// Already stored in this category — top-level match returned above.
	        		// A copy inside Pinned or any other folder also owns the URL,
	        		// so a refresh cannot put BBC/CNN back on the grid.
	        		if (!isFolder) {
	        			const heldInFolder = pages.some((e) => {
	        				if (!e || e.type !== "folder") {
	        					return false;
	        				}
	        				const folderCat = (e.role === "categoryPin" || String(e.id || "").indexOf("pin:") === 0)
	        					? (e.categoryId || String(e.id || "").replace(/^pin:/, ""))
	        					: e.categoryId;
	        				if (item.categoryId && folderCat && folderCat !== item.categoryId) {
	        					return false;
	        				}
	        				return (e.children || []).some((c) => {
	        					return c && n.helper.util.normalizeShortcutUrl(c.url) === itemKey;
	        				});
	        			});
	        			if (heldInFolder) {
	        				return;
	        			}
	        		}

	        		// New catalog rows go to the end so a refresh cannot undo a drag.
	        		item.icon = n.helper.util.normalizeRemoteIconUrl(item.icon);
	        		pages.push(item);
	        	})
	        	
	        	const catalogLinkIds = new Set();
	        	const catalogLinkUrls = new Set();
	        	const rememberCatalogLink = (node) => {
	        		if (!node || node.type === "folder" || !node.url) {
	        			return;
	        		}
	        		if (node.id) {
	        			catalogLinkIds.add(node.id);
	        		}
	        		catalogLinkUrls.add(n.helper.util.normalizeShortcutUrl(node.url));
	        	};
	        	arr.forEach((entry) => {
	        		if (!entry) {
	        			return;
	        		}
	        		if (entry.type === "folder") {
	        			(entry.children || []).forEach(rememberCatalogLink);
	        			return;
	        		}
	        		rememberCatalogLink(entry);
	        	});

	        	// Pin folders copy catalog links when seeded. Drop copies the catalog no longer has
	        	// (e.g. the user moved to the Chinese catalog); an emptied folder seeds again.
	        	pages.forEach((item) => {
	        		if (!item || item.type !== "folder" || !(item.role === "categoryPin" || String(item.id || "").indexOf("pin:") === 0)) {
	        			return;
	        		}
	        		const kids = item.children || [];
	        		const kept = kids.filter((c) => {
	        			if (!c || !(c.origin === 1 || c.origin === "1")) {
	        				return true;
	        			}
	        			return (c.id && catalogLinkIds.has(c.id))
	        				|| catalogLinkUrls.has(n.helper.util.normalizeShortcutUrl(c.url || ""));
	        		});
	        		if (kept.length !== kids.length) {
	        			item.children = kept;
	        			if (!kept.length) {
	        				item.pinSeeded = false;
	        			}
	        		}
	        	});

	        	//push
	        	pages.forEach((item)=>{
	        		
	        		item.icon = n.helper.util.normalizeRemoteIconUrl(item.icon);
	        		if (item.lang) {
	        			const loc = item.lang[lang]
	        				|| ((lang === "mx" || lang === "cl") && item.lang.es)
	        				|| (lang !== "zh_CN" && item.lang.en);
	        			if (loc && loc.title) {
	        				item['title'] = loc.title;
	        			}
	                }
	        		
	        		// A catalog child moved out of its folder keeps the catalog id.
	        		if (item.type !== "folder" && item.id && catalogLinkIds.has(item.id)) {
	        			item.origin = 1;
	        		}

	        		//本地缓存显示来源远程，但是实际上现在又没有了，则说明远程删除
	        		// categoryPin folders are client-owned and are not catalog tiles.
	        		// A link inside a catalog folder still counts, so moving it out does not delete it.
	        		if (item.origin === 1 && item.role !== "categoryPin" && !(item.type === "folder" && String(item.id || "").indexOf("pin:") === 0)) {
	        			let stillInCatalog = false;
	        			if (item.type === "folder") {
	        				// Match by id. Two catalog folders can share a tab (ai / cn_ai both in Home).
	        				stillInCatalog = arr.some((e) => {
	        					if (!e || e.type !== "folder") {
	        						return false;
	        					}
	        					if (item.id) {
	        						return e.id === item.id;
	        					}
	        					return e.categoryId === item.categoryId || e.id === item.categoryId;
	        				});
	        			} else {
	        				const key = n.helper.util.normalizeShortcutUrl(item.url);
	        				stillInCatalog = catalogLinkUrls.has(key) || !!(item.id && catalogLinkIds.has(item.id));
	        			}
	        			if (!stillInCatalog) {
	        				return;
	        			}
	        		}
	        		
	        		//兼容过去，没有origin属性的item
	        		if(!item.hasOwnProperty('origin')){
	        			item['origin']=0;
	        		}

	        		list.push(item);
	        	})

	        	
	        	// Catalog weight only on an empty grid. Later loads keep saved order,
	        	// except a fixed shortcut, which is always moved to the front of its category.
	            if (seeding) {
		            list.sort(function(x, y) {
				        const xw = x.weight || 0;
				        const yw = y.weight || 0;
				        if (xw !== yw) {
				        	return xw - yw;
				        }
				        return (x.fixed === y.fixed) ? 0 : x.fixed ? -1 : 1;
				    });
	            }

			    // Hard guarantee: never more than one lock per URL (heals bad saved state)
			    n.helper.util.sanitizeShortcutLocks(list);
			    ensurePinFolders(list);
			    placeFixedFirst(list);
			    
			    const payload = {"n/links": list};
			    if (seeding) {
			    	payload["u/shortcutsSeeded"] = true;
			    	payload["u/seedCatalog"] = catalogId || "global";
			    }
			    n.helper.dao.setData(payload).then(resolve);
        	});
        }
        
        const renderTabs = () => {
        	const nav = n.elm.grid.children("nav.nt-cats");
        	if (!nav || (typeof nav.length === "function" && nav.length() < 1)) {
        		return;
        	}
        	if (!activeCategoryId) {
        		activeCategoryId = n.helper.dao.getData("n/activeCategory")
        			|| (navCategories[0] && navCategories[0].id)
        			|| null;
        	}
        	if (navCategories.length && !navCategories.some((cat) => cat.id === activeCategoryId)) {
        		activeCategoryId = navCategories[0].id;
        	}
        	nav.html("");
        	navCategories.forEach((cat) => {
        		const btn = $("<button></button>")
        			.attr({ type: "button", "data-category": cat.id });
        		n.helper.catalog.fillCategoryTab(btn, cat);
        		if (cat.id === activeCategoryId) {
        			btn.addClass("is-active");
        		}
        		btn.appendTo(nav);
        	});
        };

        /**
         * Old category containers (id === tab id) become shortcuts on that tab.
         */
        const promoteCategoryFolders = (pages) => {
        	const ids = new Set((navCategories || []).map((cat) => cat.id));
        	if (!ids.size) {
        		return;
        	}
        	const norm = n.helper.util.normalizeShortcutUrl;
        	const extra = [];
        	pages.forEach((item) => {
        		if (!item || item.type !== "folder" || item.role === "categoryPin") {
        			return;
        		}
        		if (!ids.has(item.id)) {
        			return;
        		}
        		(item.children || []).forEach((child) => {
        			if (!child || !child.url) {
        				return;
        			}
        			const url = norm(child.url);
        			const exists = pages.concat(extra).some((entry) => {
        				return entry && entry.type !== "folder"
        					&& entry.categoryId === item.id
        					&& norm(entry.url) === url;
        			});
        			if (!exists) {
        				extra.push(Object.assign({}, child, {
        					type: "link",
        					categoryId: item.id,
        					selected: child.selected !== false
        				}));
        			}
        		});
        	});
        	extra.forEach((entry) => pages.push(entry));
        };

        const seedPinChildren = (categoryId) => {
        	const norm = n.helper.util.normalizeShortcutUrl;
        	const seen = new Set();
        	const seeds = [];
        	(navTiles || []).forEach((tile) => {
        		if (!tile || tile.type === "folder" || tile.categoryId !== categoryId || !tile.url || tile.selected === false) {
        			return;
        		}
        		const key = norm(tile.url);
        		if (!key || seen.has(key)) {
        			return;
        		}
        		seen.add(key);
        		if (seeds.length >= 4) {
        			return;
        		}
        		seeds.push(Object.assign({}, tile, {
        			type: "link",
        			selected: true,
        			fixed: false
        		}));
        	});
        	return seeds;
        };

        const isPinFolder = (item) => {
        	return !!(item && item.type === "folder"
        		&& (item.role === "categoryPin" || String(item.id || "").indexOf("pin:") === 0));
        };

        /**
         * A fixed shortcut stays at the front of its category.
         * Pinned folders keep their own slots. Other rows keep their relative order.
         */
        const placeFixedFirst = (list) => {
        	const homeId = (navCategories[0] && navCategories[0].id) || "pinned";
        	const catOf = (item) => {
        		if (isPinFolder(item)) {
        			return item.categoryId || String(item.id || "").replace(/^pin:/, "") || homeId;
        		}
        		return (item && item.categoryId) || homeId;
        	};
        	const groups = new Map();
        	list.forEach((item, index) => {
        		if (!item || isPinFolder(item)) {
        			return;
        		}
        		const cat = catOf(item);
        		if (!groups.has(cat)) {
        			groups.set(cat, []);
        		}
        		groups.get(cat).push(index);
        	});
        	groups.forEach((indices) => {
        		const items = indices.map((index) => list[index]);
        		const fixed = items.filter((item) => item && item.fixed);
        		const rest = items.filter((item) => !item || !item.fixed);
        		fixed.concat(rest).forEach((item, n) => {
        			list[indices[n]] = item;
        		});
        	});
        	return list;
        };

        const ensurePinFolders = (list) => {
        	const title = n.helper.i18n.get("new_tab_category_pin") || "Pinned";
        	(navCategories || []).forEach((cat) => {
        		const id = "pin:" + cat.id;
        		let folder = list.find((item) => {
        			return item && item.type === "folder"
        				&& (item.id === id || (item.role === "categoryPin" && item.categoryId === cat.id));
        		});
        		if (!folder) {
        			list.unshift({
        				id: id,
        				type: "folder",
        				role: "categoryPin",
        				locked: true,
        				fixed: true,
        				pinSeeded: true,
        				title: title,
        				url: "",
        				icon: null,
        				selected: true,
        				remove: false,
        				origin: 1,
        				categoryId: cat.id,
        				children: seedPinChildren(cat.id)
        			});
        			return;
        		}
        		folder.id = id;
        		folder.role = "categoryPin";
        		folder.locked = true;
        		folder.fixed = true;
        		folder.categoryId = cat.id;
        		folder.origin = 1;
        		folder.title = title;
        		if (!folder.pinSeeded && (!folder.children || !folder.children.length)) {
        			folder.children = seedPinChildren(cat.id);
        			folder.pinSeeded = true;
        		}
        	});
        };

        const getLinkList = ()=>{
        	
        	linkList=[];
        	const pages = n.helper.dao.getData("n/links") || [];
        	const homeId = (navCategories[0] && navCategories[0].id) || "pinned";
        	if (!activeCategoryId || !navCategories.some((cat) => cat.id === activeCategoryId)) {
        		activeCategoryId = n.helper.dao.getData("n/activeCategory") || homeId;
        	}
        	const catId = activeCategoryId;
        	const norm = n.helper.util.normalizeShortcutUrl;
        	const pins = [];
        	const rest = [];
        	const seen = new Set();

            pages.forEach((item)=>{
            	if (!item) {
            		return;
            	}
            	if (item.type === "folder" && (item.id === "tools" || (item.categoryId === "tools" && item.role !== "categoryPin"))) {
            		return;
            	}
            	const rememberUrls = (node) => {
            		(node && node.children || []).forEach((child) => {
            			if (child && child.url) {
            				const key = norm(child.url);
            				if (key) {
            					seen.add(key);
            				}
            			}
            		});
            	};
            	if (item.type === "folder" && (item.role === "categoryPin" || item.id === "pin:" + catId)) {
            		if (item.categoryId === catId || item.id === "pin:" + catId) {
            			rememberUrls(item);
            			if (item.selected !== false && item.selected !== "false") {
            				pins.push(item);
            			}
            		}
            		return;
            	}
            	const itemCat = item.categoryId || homeId;
            	if (itemCat !== catId) {
            		return;
            	}
            	// A saved row or folder child owns this URL, even when that folder is off.
            	// Otherwise the catalog paints BBC, Amazon, and the rest back onto the grid.
            	if (item.type !== "folder" && item.url) {
            		const key = norm(item.url);
            		if (key) {
            			seen.add(key);
            		}
            	}
            	if (item.type === "folder") {
            		rememberUrls(item);
            	}
            	const turnedOff = item.selected === false || item.selected === "false" || item.selected === 0 || item.selected === "0";
            	if (turnedOff && !item.fixed) {
            		return;
            	}
            	if (item.type === "folder" && item.title) {
            		rest.push(item);
            	} else if (item.title && item.url) {
            		rest.push(item);
            		seen.add(norm(item.url));
            	}
            });

            (navTiles || []).forEach((tile) => {
            	if (!tile || tile.type === "folder" || tile.categoryId !== catId || !tile.url || !tile.title) {
            		return;
            	}
            	if (tile.selected === false) {
            		return;
            	}
            	const key = norm(tile.url);
            	if (!key || seen.has(key)) {
            		return;
            	}
            	seen.add(key);
            	rest.push(tile);
            });

            const pinStored = pages.some((item) => {
            	return item && item.type === "folder"
            		&& (item.role === "categoryPin" || item.id === "pin:" + catId)
            		&& (item.categoryId === catId || item.id === "pin:" + catId);
            });
            if (!pins.length && !pinStored) {
            	pins.push({
            		id: "pin:" + catId,
            		type: "folder",
            		role: "categoryPin",
            		locked: true,
            		fixed: true,
            		pinSeeded: true,
            		title: n.helper.i18n.get("new_tab_category_pin") || "Pinned",
            		url: "",
            		selected: true,
            		categoryId: catId,
            		children: seedPinChildren(catId)
            	});
            } else if (pins[0] && !pins[0].pinSeeded && !(pins[0].children || []).length) {
            	pins[0].children = seedPinChildren(catId);
            	pins[0].pinSeeded = true;
            }

            const fixedRest = [];
            const normalRest = [];
            rest.forEach((item) => {
            	if (item && item.fixed) {
            		fixedRest.push(item);
            	} else {
            		normalRest.push(item);
            	}
            });
            linkList = pins.concat(fixedRest, normalRest);
            return linkList;
        }

        /**
         * Returns the user defined entries
         *
         * @returns {Array}
         */
        const getCustomEntries = () => {
        	
        	
            const data = {};
            
            const amount = getAmount();
            const totalAmount=linkList.length;
            const pageSize=amount.total < 1?5:amount.total;
            const totalPage=parseInt(totalAmount / pageSize)  + (totalAmount % pageSize == 0 ? 0 : 1);
            
            
            const start=(currentPage-1) * pageSize;
            const list=linkList.slice(start,start+pageSize);
            
            data['list']=list;
            data['totalPage']=totalPage;
            data['pageSize']=pageSize;
            data['totalAmount']=totalAmount;
            data['cols']=amount.cols;
            data['currentPage']=currentPage;
            
            return data;
        };

        /**
         * Returns the bookmarks sorted by the given type
         *
         * @param {string} type
         * @returns {Array}
         */
        const getSortedBookmarks = (type) => {
            const amount = getAmount();
            const list = [];
            const showHidden = n.helper.model.getData("u/showHidden");
            const allBookmarks = n.helper.entry.getAllDataByType("bookmarks");

            n.helper.utility.sortEntries(allBookmarks, {name: type, dir: "DESC"});

            allBookmarks.some((bookmark) => {
                if ((showHidden || n.helper.entry.isVisible(bookmark.id)) && n.helper.entry.isSeparator(bookmark.id) === false && bookmark.url.search(/^file:\/\//) !== 0) {
                    list.push(bookmark);
                    if (list.length >= amount.total) {
                        return true;
                    }
                }
            });

            return list;
        };
    };

})(jsu);