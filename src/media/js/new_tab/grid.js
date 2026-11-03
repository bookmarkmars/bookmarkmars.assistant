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

            // Drag a top-level shortcut onto a folder tile to nest it
            let gridDragUrl = null;
            n.elm.grid.on("dragstart", "> ul > li:not(.nt-folder)", (e) => {
                const link = $(e.currentTarget).children("a");
                gridDragUrl = link.data("href") || link.attr("href") || "";
                if (!gridDragUrl || gridDragUrl === "#") {
                    gridDragUrl = null;
                    return;
                }
                try {
                    e.originalEvent.dataTransfer.setData("text/plain", gridDragUrl);
                    e.originalEvent.dataTransfer.effectAllowed = "move";
                } catch (err) {
                    // some environments block dataTransfer
                }
                $(e.currentTarget).addClass("nt-dragging");
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
            n.elm.grid.on("drop", "> ul > li.nt-folder", (e) => {
                e.preventDefault();
                e.stopPropagation();
                const folderLink = $(e.currentTarget).children("a");
                const folderId = folderLink.data("folderId");
                const url = gridDragUrl
                    || (e.originalEvent.dataTransfer && e.originalEvent.dataTransfer.getData("text/plain"));
                n.elm.grid.find("li").removeClass("nt-dragging nt-drop-target");
                gridDragUrl = null;
                if (!folderId || !url) {
                    return;
                }
                this.moveLinkIntoFolder(url, folderId);
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
                
                gridWrapper.removeClass($.cl.visible);

                if (updateRunning === false) {//未更新
                    
                    updateRunning = true;

                    Promise.all([
                        getEntryData(),
                        $.delay(200),
                    ]).then(([data]) => {
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
                                renderFolderTile(entryLink, page);
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

                        return $.delay(400);
                    }).then(() => {
                        
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
        	return n.helper.dao.setData({"n/links": next}).then(() => {
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

        /**
         * Drop a shortcut onto a folder.
         * The locked Pinned folder copies; other folders move.
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
        			return;
        		}
        		remaining.push(item);
        	});
        	if (!moving) {
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
        	const already = folder.children.some((c) => c && norm(c.url) === targetUrl);
        	if (!already) {
        		folder.children.push(Object.assign({}, moving, {
        			type: "link",
        			selected: true,
        			fixed: false
        		}));
        	}
        	const copyOnly = !!(folder.locked || folder.role === "categoryPin");
        	return this.persistLinks(copyOnly ? links : remaining, {reload: false}).then(() => true);
        };

        /**
         * Eject a child link from a folder back to the top-level grid.
         */
        this.ejectFromFolder = (folderId, childUrl) => {
        	const links = n.helper.dao.getData("n/links") || [];
        	const norm = n.helper.util.normalizeShortcutUrl;
        	const targetUrl = norm(childUrl);
        	let ejected = null;
        	links.forEach((item) => {
        		if (!item || item.type !== "folder") {
        			return;
        		}
        		if (item.id !== folderId && item.categoryId !== folderId) {
        			return;
        		}
        		const kids = Array.isArray(item.children) ? item.children : [];
        		item.children = kids.filter((c) => {
        			if (c && norm(c.url) === targetUrl) {
        				ejected = c;
        				return false;
        			}
        			return true;
        		});
        	});
        	if (!ejected) {
        		return Promise.resolve(false);
        	}
        	const exists = links.some((item) => {
        		return item && item.type !== "folder" && norm(item.url) === targetUrl;
        	});
        	if (!exists) {
        		links.unshift(Object.assign({}, ejected, {
        			type: "link",
        			selected: true,
        			fixed: false
        		}));
        	}
        	return this.persistLinks(links, {reload: true}).then(() => true);
        };

        /**
         * Create an empty user folder at the front of the grid.
         */
        this.createFolder = (title) => {
        	const links = n.helper.dao.getData("n/links") || [];
        	const name = (title || "").trim() || "New folder";
        	const folder = {
        		id: "user-folder-" + Date.now(),
        		type: "folder",
        		title: name,
        		url: "",
        		icon: null,
        		selected: true,
        		fixed: false,
        		locked: false,
        		remove: false,
        		origin: 0,
        		categoryId: activeCategoryId || null,
        		children: []
        	};
        	links.unshift(folder);
        	return this.persistLinks(links, {reload: true});
        };

        const isUserCustomShortcut = (item) => {
        	return !!(item && item.origin !== 1 && item.origin !== "1");
        };

        /**
         * Background restore from cloud. Does not block first paint.
         * Throttled: once per day when already synced; at most every 5 min when still recovering.
         */
        const restoreShortcutsFromServer = () => {
        	return new Promise((resolve) => {
        		const localSyncTime = Number(n.helper.dao.getData("u/shortcutsSyncTime")) || 0;
        		const lastCheck = Number(n.helper.dao.getData("u/shortcutsLastCheck")) || 0;
        		const now = Date.now();
        		const interval = localSyncTime
        			? (24 * 60 * 60 * 1000)   // already restored/saved → 1/day
        			: (5 * 60 * 1000);        // not yet synced → light retry while logged out / recovering

        		if (lastCheck && (now - lastCheck) < interval) {
        			resolve(false);
        			return;
        		}

        		const markChecked = () => n.helper.dao.setData({"u/shortcutsLastCheck": Date.now()});

        		n.helper.dao.call("loadShortcuts").then((res) => {
        			if (!res || res.code === "not_login" || res.code === "not_found" || res.code === "error") {
        				markChecked().then(() => resolve(false));
        				return;
        			}
        			if (res.code !== "ok" || !res.data) {
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
        			const same = shortcutListFingerprint(cloudLinks) === shortcutListFingerprint(localLinks);

        			if (same) {
        				const patch = {"u/shortcutsLastCheck": Date.now()};
        				if (cloudTime && syncTime !== cloudTime) {
        					patch["u/shortcutsSyncTime"] = cloudTime;
        				}
        				n.helper.dao.setData(patch).then(() => resolve(false));
        				return;
        			}

        			const localCustoms = localLinks.filter(isUserCustomShortcut);
        			const cloudCustoms = cloudLinks.filter(isUserCustomShortcut);
        			// Only apply when cloud is authoritative — never clobber a richer
        			// local grid just because fingerprints differ after catalog inject.
        			const shouldApply = !syncTime
        				|| cloudTime > syncTime
        				|| (cloudCustoms.length > 0 && localCustoms.length === 0);

        			if (!shouldApply) {
        				markChecked().then(() => resolve(false));
        				return;
        			}

        			n.helper.dao.setData({
        				"n/links": n.helper.util.sanitizeShortcutLocks(cloudLinks),
        				"u/shortcutsSyncTime": cloudTime || Date.now(),
        				"u/shortcutsLastCheck": Date.now()
        			}).then(() => {
        				try {
        					sessionStorage.setItem("be_shortcuts_restored", "1");
        				} catch (e) {
        					// ignore
        				}
        				location.reload();
        				resolve(true);
        			}).catch(() => resolve(false));
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
            const provisional = page.icon ? n.helper.util.normalizeRemoteIconUrl(page.icon) : null;
            const imgAttrs = { alt: page.title || "" };
            if (provisional && (provisional.indexOf("data:") === 0 || provisional.indexOf("http") === 0)) {
                imgAttrs.src = provisional;
            } else {
                // Transparent 1x1 so Chrome never shows the broken-image glyph
                imgAttrs.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
            }

            $("<div></div>")
                .append($("<img />").attr(imgAttrs))
                .prependTo(entryLink);

            if (!page.url) {
                return;
            }

            n.helper.dao.call("getFavicon", {
                url: page.url,
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
                const provisional = child.icon ? n.helper.util.normalizeRemoteIconUrl(child.icon) : null;
                const imgAttrs = {
                    alt: child.title || "",
                    "data-folder-icon": String(idx)
                };
                if (provisional && (provisional.indexOf("data:") === 0 || provisional.indexOf("http") === 0)) {
                    imgAttrs.src = provisional;
                } else {
                    imgAttrs.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
                }
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

            const tryRemote = async () => {
                let res = await n.helper.dao.call("getValue", { key: "navigation_v2" });
                if (res && (res.data || res.schemaVersion === 2)) {
                    return parseCatalogPayload(res);
                }
                // Brief dual-read for sunset window
                res = await n.helper.dao.call("getValue", { key: "navigation" });
                if (res && (res.data || res.children)) {
                    return parseCatalogPayload(res);
                }
                return null;
            };

            return new Promise((resolve) => {
                const readCatalog = () => {
                	return tryRemote().then((remote) => {
                		if (remote) {
                			return remote;
                		}
                		// One fetch if local cache is empty (startup request may still be in flight)
                		return n.helper.dao.call("cacheRemote", { name: "navigation_v2" }).then(() => {
                			return tryRemote();
                		}).catch(() => null);
                	});
                };

                readCatalog().then((remote) => {
                    let catalog = remote;
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
                    if (!catalog) {
                        // Emergency seed (no affiliates)
                        $.fetch($.api.runtime.getURL("media/conf/navigation_seed.json"), { method: "GET" }).then((obj) => {
                            obj.text().then((data) => {
                                const catalogSeed = parseCatalogPayload(data);
                                const lang = n.helper.i18n.getLanguage();
                                navCategories = n.helper.catalog.listTabs(catalogSeed, lang);
                                const tiles = n.helper.catalog.flattenToTiles(catalogSeed, lang);
                                navTiles = tiles;
                                appendNewLinks(tiles).then(resolve);
                            });
                        }).catch(() => resolve());
                        return;
                    }

                    const lang = n.helper.i18n.getLanguage();
                    navCategories = n.helper.catalog.listTabs(catalog, lang);
                    if (!activeCategoryId) {
                    	activeCategoryId = n.helper.dao.getData("n/activeCategory")
                    		|| (navCategories[0] && navCategories[0].id)
                    		|| null;
                    }
                    const tiles = n.helper.catalog.flattenToTiles(catalog, lang);
                    navTiles = tiles;
                    dropTopLinks().then(() => {
                    	return appendNewLinks(tiles);
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

        	// User list wins: keep order, refresh catalog meta only for survivors
        	return user.map((u) => {
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

        const appendNewLinks = (arr)=>{
        	
        	return new Promise((resolve) => {
        		
        		const lang = n.helper.i18n.getLanguage();
	        	const pages = n.helper.dao.getData("n/links") || [];
	        	promoteCategoryFolders(pages);
	        	const order= JSON.stringify(pages) === '[]' ? "push": "unshift";
	        	// After a cloud restore/save, do not re-inject catalog URLs the user removed
	        	const cloudSynced = !!n.helper.dao.getData("u/shortcutsSyncTime");
	        	const list = [];
	        	
	        	arr
	        	.filter(val => !val.remove)//过滤掉已经删除的
	        	.sort(function(x, y) {
	        		return (x.weight === y.weight)? 0 : x.weight > y.weight ? 1 : -1;// 越小权重越大
			    })//sort by weight
	        	.forEach((item)=>{

	        		const isFolder = item.type === "folder";
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
	        				return e.id === item.id || e.categoryId === item.categoryId || e.id === item.categoryId;
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
	        		
	        		//添加到开头，order==push，说明是初始化的顺序，按weight排序
	        		item.icon = n.helper.util.normalizeRemoteIconUrl(item.icon);
	        		if(order==='push'){
	        			pages.push(item);
	        		}else{
	        			pages.unshift(item);//之前没有加入过，插入到最前面
	        		}
	        	})
	        	
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
	        		
	        		//本地缓存显示来源远程，但是实际上现在又没有了，则说明远程删除
	        		// categoryPin folders are client-owned and are not catalog tiles
	        		if (item.origin === 1 && item.role !== "categoryPin") {
	        			const stillInCatalog = arr.some((e) => {
	        				if (!e) {
	        					return false;
	        				}
	        				if (item.type === "folder") {
	        						return e.type === "folder"
	        							&& (e.id === item.id || e.categoryId === item.categoryId || e.id === item.categoryId);
	        				}
	        				if (e.type === "folder") {
	        					return false;
	        				}
	        				return n.helper.util.normalizeShortcutUrl(e.url) === n.helper.util.normalizeShortcutUrl(item.url);
	        			});
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

	        	
	        	//将固定的内容排到前面
	            list.sort(function(x, y) {
			        return (x.fixed === y.fixed)? 0 : x.fixed ? -1 : 1;// true values first
			        // return (x.fixed === y.fixed)? 0 : x.fixed? 1 : -1;// false values first
			    });

			    // Hard guarantee: never more than one lock per URL (heals bad saved state)
			    n.helper.util.sanitizeShortcutLocks(list);
			    ensurePinFolders(list);
			    
			    n.helper.dao.setData({"n/links":list}).then(resolve);
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
        			.attr({ type: "button", "data-category": cat.id })
        			.text(cat.title);
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
        		folder.selected = true;
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
        	const folders = [];
        	const links = [];
        	const seen = new Set();

            pages.forEach((item)=>{
            	if (!item) {
            		return;
            	}
            	if (item.type === "folder" && (item.id === "tools" || (item.categoryId === "tools" && item.role !== "categoryPin"))) {
            		return;
            	}
            	if (item.type === "folder" && (item.role === "categoryPin" || item.id === "pin:" + catId)) {
            		if (item.categoryId === catId || item.id === "pin:" + catId) {
            			pins.push(item);
            		}
            		return;
            	}
            	if (!(item.selected || item.fixed)) {
            		return;
            	}
            	const itemCat = item.categoryId || homeId;
            	if (itemCat !== catId) {
            		return;
            	}
            	if (item.type === "folder" && item.title) {
            		folders.push(item);
            	} else if (item.title && item.url) {
            		links.push(item);
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
            	links.push(tile);
            });

            if (!pins.length) {
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
            } else if (!pins[0].pinSeeded && !(pins[0].children || []).length) {
            	pins[0].children = seedPinChildren(catId);
            	pins[0].pinSeeded = true;
            }

            linkList = pins.concat(folders, links);
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