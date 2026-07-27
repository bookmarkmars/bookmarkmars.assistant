($ => {
    "use strict";

    $.GridHelper = function (n) {

        let maxCols = 0;
        let maxRows = 0;
        let updateRunning = false;
        let currentPage = 1;
        let linkList=[];

        const colWidth = 145;
        const rowHeight = 121;

        /**
         *
         * @returns {Promise}
         */
        this.init = async () => {
            
            initEvents();
            
            n.elm.grid.html("<ul></ul>");
            maxCols = n.helper.dao.getData("n/gridMaxCols");
            maxRows = n.helper.dao.getData("n/gridMaxRows");
            
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
                    n.helper.dao.call("openLink", {
                        href: $(e.currentTarget).data("href"),
                        newTab: e.type === "auxclick",
                        position: n.helper.dao.getData("b/newTabPosition"),
                        active: e.type !== "auxclick"
                    });
                }
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

            ret.total = ret.cols * ret.rows;
            return ret;
        };
        
        /**
         * 更新grid的展示
         *
         * @returns {Promise}
         */
        const updateEntries = () => {
            
            return new Promise((resolve) => {

                const gridWrapper = n.elm.grid.children("ul");
                
                gridWrapper.removeClass($.cl.visible);

                if (updateRunning === false) {//未更新
                    
                    updateRunning = true;

                    Promise.all([
                        getEntryData(),
                        $.delay(200),
                    ]).then(([data]) => {
                    	
                    	if(JSON.stringify(data)==="{}" || JSON.stringify(data['list'])==="[]" ){return $.delay();}//停止
                    	
                        gridWrapper
                            .html("")
                            .attr({
                            	"pageSize":data['pageSize'],
                            	"totalPage":data['totalPage']
                            })
                            .css("grid-template-columns", "1fr ".repeat(data['cols']).trim());
					
                        data['list'].forEach((page) => {
                            const entry = $("<li></li>").appendTo(gridWrapper);
                            const entryLink = $("<a></a>")
                                .attr({
                                    href: page.url,
                                    title: page.title,
                                    [$.attr.value]: page.url.length === 0 ? "empty" : "url"
                                })
                                .data("href", page.url)
                                .appendTo(entry);

                            $("<span></span>").text(page.title).appendTo(entryLink);
                            
							//准备icon
							const icon={
								size:32,
								title:page.title
							}
							
							const resolveIconSrc = (src) => {
								if (!src || src === "undefined") {
									return null;
								}
								src = n.helper.util.normalizeRemoteIconUrl(src);
								if (src.startsWith("http") || src.startsWith("data:")) {
									return src;
								}
								return $.api.runtime.getURL(src);
							};

							const appendFavicon = (src, allowRetry) => {
								const resolved = resolveIconSrc(src);
								if (!resolved) {
									return false;
								}
								const favicon = $("<img />").attr("src", resolved);
								favicon[0].onerror = () => {
									if (allowRetry === false) {
										return;
									}
									// Remote/file icon failed → first character of title
									n.helper.dao.call("getFavicon", {
										url: page.url,
										icon: icon,
										query: true
									}).then((response) => {
										if (response && response.img) {
											favicon.attr("src", response.img);
											favicon[0].onerror = null;
										}
									});
								};
								$("<div></div>").append(favicon).prependTo(entryLink);
								return true;
							};

							// Prefer stored icon; otherwise fetch (ends with first-character glyph)
							if (!appendFavicon(page.icon)) {
								n.helper.dao.call("getFavicon", {url: page.url, icon: icon, query: true}).then((response) => {
	                                if (response && response.img) {
										appendFavicon(response.img, false);
	                                }
	                            });
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
                        
                        updateRunning = false;

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
         * Cloud backup is the user's saved snapshot (order + selection + customs).
         * Sanitize icons; never keep data: URLs in sync storage.
         */
        const sanitizeCloudLinks = (serverLinks) => {
        	return serverLinks
        		.filter((item) => item && item.url && item.title)
        		.map((item) => {
        			const origin = (item.origin === 1 || item.origin === "1") ? 1 : 0;
        			let icon = item.icon;
        			if (icon && typeof icon === "string" && icon.indexOf("http") === 0) {
        				icon = n.helper.util.normalizeRemoteIconUrl(icon);
        			} else {
        				icon = null;
        			}
        			return {
        				title: item.title,
        				url: item.url,
        				selected: item.selected !== false && item.selected !== "false",
        				fixed: !!item.fixed && item.fixed !== "false",
        				remove: false,
        				origin: origin,
        				icon: icon,
        				lang: item.lang || undefined
        			};
        		});
        };

        /**
         * Stable compare key for shortcut lists (ignore volatile fields like lang).
         */
        const shortcutListFingerprint = (links) => {
        	return (Array.isArray(links) ? links : []).map((item) => {
        		if (!item || !item.url) {
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
        			const shouldApply = !syncTime
        				|| cloudTime > syncTime
        				|| syncTime > cloudTime
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

        const loadNavigation  = () =>{
        	
        	const tryReq = async (retry=1) =>{
        		
        		for(let i=0;i<retry;i++){
        			const res = await n.helper.dao.call("getValue",{key:"navigation"});
        			if(!!res){
        				return res;
        			}
        		}
        		
        		return null;
        	}
        	
        	return new Promise((resolve) => {
        		
        		tryReq(1)
        		.then(res=>{
        		
        			if(!!res){
        				
        				let jsonData=JSON.parse(res.data);
				        appendNewLinks(jsonData.children).then(()=>{
				        	
				        	//cache
				        	const cache=n.helper.dao.getData("n/topLinks");
				        	const jsonStr=JSON.stringify(jsonData);
				        	if(cache!==jsonStr){
				        		return n.helper.dao.setData({"n/topLinks":jsonStr});
				        	}
				        	return Promise.resolve();
				        })
				        .then(resolve);
				        
        			}else{
        				
        				const cache=n.helper.dao.getData("n/topLinks");
        				if(!!cache){
    						let jsonData=JSON.parse(cache);
				            appendNewLinks(jsonData.children).then(resolve);
    					}
    					else{
    						$.fetch($.api.runtime.getURL("media/conf/navigation.json")).then((obj) => {
				                obj.text().then((data)=>{
				                	let jsonData=JSON.parse(data);
				                	appendNewLinks(jsonData.children).then(resolve);
				                });
				           	}).catch(err => {});
    					}
        			}
        		});
        	});
        }
        
        const appendNewLinks = (arr)=>{
        	
        	return new Promise((resolve) => {
        		
        		const lang = n.helper.i18n.getLanguage();
	        	const pages = n.helper.dao.getData("n/links");
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

	        		//如果pages中包含该链接（trailing slash / host case 归一后比较）
	        		const itemKey = n.helper.util.normalizeShortcutUrl(item.url);
	        		if(pages.some(e => n.helper.util.normalizeShortcutUrl(e.url) === itemKey)){
	        			// Catalog may mark a URL as fixed (e.g. Google) — apply that to
	        			// one row only. User-added duplicates of the same URL must stay editable.
	        			const matches = pages.filter((node) =>
	        				n.helper.util.normalizeShortcutUrl(node.url) === itemKey
	        			);
	        			const primary = matches.find((node) => node.origin === 1 || node.origin === "1")
	        				|| matches[0];

	        			matches.forEach((node) => {
	        				if (node === primary) {
	        					node.origin = item.origin;
	        					node.title = item.title;
	        					node.icon = n.helper.util.normalizeRemoteIconUrl(item.icon);
	        					node.fixed = item.fixed;//服务器端只控制固定权限，select权限给用户
	        					node.lang = item.lang;//别名也可能在服务器端修改
	        				} else {
	        					node.fixed = false;
	        					if (node.origin === 1 || node.origin === "1") {
	        						node.origin = 0;
	        					}
	        				}
	        			});
	        			
	        			return;
	        		}

	        		if (cloudSynced) {
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
	        		if(
	        			item.origin===1 &&
	        			!arr.some(e => n.helper.util.normalizeShortcutUrl(e.url) === n.helper.util.normalizeShortcutUrl(item.url))
	        		){
	        		   return;
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
			    
			    n.helper.dao.setData({"n/links":list}).then(resolve);
        	});
        }
        
        const getLinkList = ()=>{
        	
        	linkList=[];
        	const pages = n.helper.dao.getData("n/links");
        	
            pages.forEach((item)=>{
            	
            	//只要选中的 或者 固定的
            	if(item && item.selected || item.fixed){
            		if (item && item.title && item.url) {
	                    linkList.push(item);
	                } else {
	                    linkList.push({title: "", url: ""});
	                }
            	}
            })
            
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