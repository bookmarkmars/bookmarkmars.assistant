($ => {
    "use strict";

    /**
     * @param {object} ext
     * @constructor
     */
    $.UtilHelper = function (ext) {
    	
    	let urlMap={}
    	
    	const websites={
        	searchEngine:["google.com","baidu.com","sogou.com","so.com","biying.com","toutiao.com",".bing.com"],
        	shopping:["taobao.com","jd.com","tmall.com","vip.com","alibaba.com"],
        	forum:["zhihu.com","jianshu.com","douban.com"],
        	video:["bilibili.com","youku.com","iqiyi.com","v.qq.com"],
        	technique:["stackoverflow.com","csdn.net","cnblogs.com","segmentfault.com","gitee.com","github.com"],
        	bookmarkmars:["bookmarkmars.com"]
        }
    	
    	//有些网站，比如百度，自定义滚动条但又很常用，所以特殊处理
    	const specialScrollBarWebsite=["baidu.com"];

        /**
         * Opens the url of the given bookmark
         *
         * @param {object} infos
         * @param {string} type
         * @param {boolean} active
         * @returns {Promise}
         */
        this.openUrl = async (infos, type = "default", active = true) => {
            ext.helper.dao.setData({
                "u/lastOpened": infos.id,
                "u/performReopening": active ? (infos.reopenSidebar || false) : false
            });

            if (type === "incognito") {
                await ext.helper.dao.call("openLink", {
                    href: infos.url,
                    incognito: true
                });
            } else if (type === "newWindow") {
                await ext.helper.dao.call("openLink", {
                    href: infos.url,
                    newWindow: true
                });
            } else {
                const newtab = type === "newTab";
                if (infos.url.startsWith("javascript:") && newtab === false) {
                    location.href = infos.url;
                } else {
                    await ext.helper.dao.call("openLink", {
                        parentId: infos.parentId,
                        id: infos.id,
                        href: infos.url,
                        newTab: type === "newTab",
                        position: ext.helper.dao.getData("b/newTabPosition"),
                        active: active
                    });
                }
            }
        };
        
        this.getFamousWebsites = () => websites;

        /**
         * Keep CDN icon filenames that actually exist (bookmarkmars.ico is not uploaded).
         *
         * @param {string} src
         * @returns {string}
         */
        this.normalizeRemoteIconUrl = (src) => {
            if (!src || typeof src !== "string") {
                return src;
            }
            return src.replace(/bookmarkmars\.ico/gi, "bookmarkearth.ico");
        };

        /**
         * Stable key for shortcut URL compare (host + path, ignore trailing slash / case).
         *
         * @param {string} url
         * @returns {string}
         */
        this.normalizeShortcutUrl = (url) => {
            if (!url || typeof url !== "string") {
                return "";
            }
            const raw = url.trim();
            try {
                const u = new URL(raw);
                let path = u.pathname || "/";
                if (path.length > 1 && path.endsWith("/")) {
                    path = path.slice(0, -1);
                }
                return (u.protocol + "//" + u.hostname.toLowerCase() + path + (u.search || "")).toLowerCase();
            } catch (e) {
                return raw.replace(/\/+$/, "").toLowerCase();
            }
        };

        /**
         * At most one locked (fixed) shortcut per URL. Extra duplicates stay editable.
         *
         * @param {Array} pages
         * @returns {Array}
         */
        this.sanitizeShortcutLocks = (pages) => {
            if (!Array.isArray(pages)) {
                return pages;
            }
            const lockedKeys = new Set();
            pages.forEach((node) => {
                if (!node) {
                    return;
                }
                // Folders are never lock-icons; skip empty-url rows.
                // The per-category Pinned folder stays fixed.
                if (node.type === "folder") {
                    if (!(node.locked || node.role === "categoryPin")) {
                        node.fixed = false;
                    }
                    if (!Array.isArray(node.children)) {
                        node.children = [];
                    }
                    return;
                }
                const isFixed = node.fixed === true || node.fixed === "true";
                if (!isFixed) {
                    node.fixed = false;
                    return;
                }
                const key = this.normalizeShortcutUrl(node.url);
                if (!key || lockedKeys.has(key)) {
                    node.fixed = false;
                    if (node.origin === 1 || node.origin === "1") {
                        node.origin = 0;
                    }
                } else {
                    lockedKeys.add(key);
                    node.fixed = true;
                }
            });
            return pages;
        };
        
        this.isFamousWebsite = (url) =>{
        	
        	let rs={};
        	Object.entries(websites).some(([key, list]) => {
        	 	
        	 	if(list.some(e => url.indexOf(e)!==-1)){
            		rs['key']=key;
            		rs['yes']=true;
            		return true;
            	}
        	});
        	
        	return rs;
        }

        /**
         * Opens all given bookmarks in new tabs
         *
         * @param {Array} bookmarks
         * @returns {Promise}
         */
        this.openAllBookmarks = async (bookmarks) => {
            const newTabPosition = ext.helper.dao.getData("b/newTabPosition");

            if (newTabPosition === "afterCurrent" || newTabPosition === "beforeFirst") { // reverse bookmarks to open them in the correct order
                bookmarks.reverse();
            }

            for (const bookmark of bookmarks) {
                await this.openUrl(bookmark, "newTab", false);
            }
        };

        /**
         * Checks whether the background script is connected
         *
         * @returns {boolean}
         */
        this.isBackgroundConnected = () => {
            try {
                const port = $.api.runtime.connect();
                if (port) {
                    port.disconnect();
                    $.api.runtime.lastError;
                    return true;
                }
            } catch (e) {
                //
            }
            return false;
        };

        /**
         * Triggers an event with the given name
         *
         * @param {string} key
         * @param {object} data
         * @param {Element} scope
         */
        this.triggerEvent = (key, data = {}, scope = null) => {
            (scope || document).dispatchEvent(new CustomEvent($.opts.events[key], {
                detail: data,
                bubbles: true,
                cancelable: false
            }));
        };

        /**
         * Copies the given text to the clipboard
         *
         * @param {string} text
         * @returns {boolean}
         */
        this.copyToClipboard = (text) => {
            const textarea = $("<textarea></textarea>").text(text).appendTo(ext.elm.iframeBody);
            textarea[0].select();

            let success = false;
            try {
                success = ext.elm.iframe[0].contentDocument.execCommand("copy");
            } catch (err) {
                //
            }

            textarea.remove();
            return success;
        };

        /**
         * Returns true if the given url matches the list of blacklisted urls,
         * this is useful to prevent checking the existence of non existing urls or trying to retrieve thumbnails for them
         *
         * @param {string} url
         * @returns {boolean}
         */
        this.isUrlOnBlacklist = (url) => {
            if (!url || url.trim().length === 0) {
                return true;
            }

            let ret = false;

            [
                "about:",
                "https?://192\.168\.",
                "192\.168\.",
                "https?://localhost",
                "localhost",
                "https?://127\.0\.0\.",
                "127\.0\.0\.",
                "javascript:",
                "file://",
                "chrome://",
                "edge://",
                "extension://",
                "chrome\-extension://",
            ].some((str) => {
                if (url.search(new RegExp(str, "gi")) === 0) {
                    ret = true;
                    return true;
                }
            });

            return ret;
        };

        /**
         * Returns the available sortings
         *
         * @returns {object}
         */
        this.getSortList = () => {
            return {
                default: {
                    dir: "ASC"
                },
                frequency: {
                    dir: "DESC"
                },
                used: {
                    dir: "DESC"
                },
                create: {
                    dir: "DESC"
                }
            };
        };

        /**
         * Capitalizes the first letter of a string
         *
         * @param {string} str
         * @returns {string}
         */
        this.capitalizeFirstLetter = (str) => {
            return str.charAt(0).toUpperCase() + str.slice(1);
        };

        /**
         * Sorts the given bookmarks by the given sorting
         *
         * @param {Array} bookmarks
         * @param {object} sortObj
         */
        this.sortEntries = (bookmarks, sortObj) => {
            
            if (bookmarks.length > 1) {
                
                const collator = ext.helper.i18n.getLocaleSortCollator();
                
                const folderGroup = (entry) => {
                    // Separators are bookmarks. Keep them in the folder run so one
                    // inserted above a folder stays there under the default sort.
                    if (entry.children || ext.helper.entry.looksLikeSeparator(entry)) {
                        return 0;
                    }
                    return 1;
                };

                const doSort = (defaultDir, func) => {
                    
                    bookmarks.sort((a, b) => {
                       
                        if (sortObj.name === "default") {
                            const groupDiff = folderGroup(a) - folderGroup(b);
                            if (groupDiff !== 0) {
                                return groupDiff;
                            }
                        }

                        return (defaultDir === sortObj.dir ? 1 : -1) * func(a, b);
                    });
                };

                switch (sortObj.name) {
                	
                    case "default": {
                        doSort("ASC", (a, b) => {
                            return a.index - b.index;
                        });//按照index来排序，固定
                        break;
                    }
                    case "create": {
                        doSort("DESC", (a, b) => {
                        	
                        	a.dateAdded=a.dateAdded?a.dateAdded:0;
                        	b.dateAdded=b.dateAdded?b.dateAdded:0;

                            return b.dateAdded - a.dateAdded;
                        });//创建时间倒序
                        break;
                    }
                    case "frequency": {
                        const mostViewedPerMonth = ext.helper.dao.getData("u/mostViewedPerMonth");
                        doSort("DESC", (a, b) => {
                            
                            const aData = ext.helper.entry.getDataById(a.id);
                            const bData = ext.helper.entry.getDataById(b.id);
                            
                            let aViews = aData ? aData.views[mostViewedPerMonth ? "perMonth" : "total"]  : 0;
                            let bViews = bData ? bData.views[mostViewedPerMonth ? "perMonth" : "total"] : 0;

                            if (aViews === bViews) {
                                return collator.compare(a.title, b.title);
                            } else {
                                return bViews - aViews;
                            }
                        });//最长使用
                        break;
                    }
                    case "used": {
                        doSort("DESC", (a, b) => {
                            
                            const aData = ext.helper.entry.getDataById(a.id);
                            const bData = ext.helper.entry.getDataById(b.id);

                            let aLastView = aData ? aData.views.lastView : 0;
                            let bLastView = bData ? bData.views.lastView : 0;
                            
                            aLastView=aLastView?aLastView:0;
                            bLastView=bLastView?bLastView:0;
                                                        
                            if (aLastView === bLastView) {
                                return collator.compare(a.title, b.title);
                            } else {
                                return bLastView - aLastView;
                            }
                        });//最近使用
                        break;
                    }
                }
            }
        };

        /**
         * Returns whether the browser is windowed or not
         * returns always true if Chrome/Edge mobile is used (e.g. when viewing a website in mobile view with devtools)
         *
         * @returns {boolean}
         */
        this.isWindowed = () => {
            const limitX = 100;
            const limitY = 50;
            return window.screenX > limitX ||
                window.screenY > limitY ||
                Math.abs(window.screen.availWidth - window.innerWidth) > limitY ||
                (window.navigator && window.navigator && window.navigator.userAgent && window.navigator.userAgent && window.navigator.userAgent.search(/[/\s-_]mobile[/\s-_]/i) > -1);
        };

        /**
         * Returns whether the current tab is running in the browser or as webapp
         *
         * @returns {boolean}
         */
        this.isWebapp = () => {
            return window.matchMedia("(display-mode: standalone)").matches;
        };
        
        
        /**
         * treat some Chrome specific urls differently to make them work in Edge, Opera, ...
         *
         * @param url
         * @returns {string|null}
         */
        this.getParsedUrl = (url) => {
            if (!url) {
                return url;
            }

            if ($.opts.urlAliases[$.browserName] && $.opts.urlAliases[$.browserName][url]) {
                url = $.opts.urlAliases[$.browserName][url];
            }

            return url;
        };
        
        
        /**
         * 初始化召唤球的圈圈
         */
      	this.initCircle = () =>{
        	
        	//构造召唤球
            let circle='<div class="choose"></div>';
            [0,1,2,3].forEach((item)=>{
            	circle+='<div class="'+$.cl.toggle.circle+'" style="animation-delay: '+item+'s"></div>';
            });
            return circle;
        }
      	
      	this.getYYMMDDhhmmss = ()=>{
      		
      		const d = new Date,
    		dformat = [
    		   d.getFullYear(),
    		   d.getMonth()+1,
               d.getDate()
               ].join('-')+' '+
               [d.getHours(),
               d.getMinutes(),
               d.getSeconds()].join(':');
             
            return dformat;
      	}
      	
      	this.printNoticeOnBall = (text,fontSize)=>{
      		
      		if(!!ext.elm && !!ext.elm.indicator && !!ext.elm.indicator.ball){
      			ext.elm.indicator.ball.prepend(ext.helper.ball.insertTextSpan(text,fontSize));
      		}
      	}
      	
      	this.removeNoticeFromBall = ()=>{
      		
      		if(!!ext.elm && !!ext.elm.indicator && !!ext.elm.indicator.ball){
      			ext.elm.indicator.ball.find("span."+$.cl.notification).remove();
      		}
      	}
      	
      	this.getNoticeFromBall = ()=>{
      		
      		if(!!ext.elm && !!ext.elm.indicator && !!ext.elm.indicator.ball){
      			return ext.elm.indicator.ball.find("span."+$.cl.notification).text();
      		}
      		return "";
      	}
      	
      	this.getScrollBarWidth = ()=>{
      		
      		const url = location.href;

      		if (!this._scrollbarResizeBound) {
      			this._scrollbarResizeBound = true;
      			window.addEventListener('resize',()=>{
	      			urlMap={};
	      		});
      		}
      	
      		if(urlMap.hasOwnProperty(url) && !!urlMap[url]){
      			return urlMap[url];
      		}
      		
			// Creating invisible container
			const outer = document.createElement('div');
			outer.style.visibility = 'hidden';
			outer.style.overflow = 'scroll'; // forcing scrollbar to appear
			outer.style.msOverflowStyle = 'scrollbar'; // needed for WinJS apps
			document.body.appendChild(outer);
			// Creating inner element and placing it in the container
			const inner = document.createElement('div');
			outer.appendChild(inner);
			
			// Calculating difference between container's full width and the child width
			let scrollbarW = outer.offsetWidth - inner.offsetWidth;
			let scrollbarH = outer.offsetHeight - inner.offsetHeight;
			
			// Removing temporary elements from the DOM
			document.body.removeChild(outer);
			
      		
      		let hasHorizontalScrollbar = document.documentElement.scrollWidth > window.innerWidth;
			let hasVerticalScrollbar = document.documentElement.scrollHeight > window.innerHeight;
			
			
			//obj
			let wh={'height':hasHorizontalScrollbar>0?scrollbarH:0,'width':hasVerticalScrollbar>0?scrollbarW:0};
			urlMap[url] = wh ;
			
			return wh;
        }
      	
      	this.createToast=(text,time=2.5)=>{

        	const toast=ext.elm.toast;
        	toast.addClass($.cl.active);
        	toast.find("div."+$.cl.confirm.toastText).html(text);

        	let timeout = setTimeout(() => { // if the timeout is not getting cleared by the content script, the sidebar is not working -> show notification
                toast.removeClass($.cl.active);
            }, time*1000);
        }
      	
      	this.toLogin = (text,time=1.5)=>{
      		
      		const toast=ext.elm.toast;
        	toast.addClass($.cl.active);
        	toast.find("div."+$.cl.confirm.toastText).html(text);

        	let timeout = setTimeout(() => { // if the timeout is not getting cleared by the content script, the sidebar is not working -> show notification
                
                toast.removeClass($.cl.active);
                
                //直接跳转登录页面
                ext.helper.dao.call("openLink", {//打开书签火星
                    href: $.opts.website.main.official + $.opts.website.servletMain.exclude.login,
                    newTab: false
                });
                
            }, time*1000);
      	}
      	
      	this.randomIntFromInterval=(min, max) => { // min and max included 
		  
		  return Math.floor(Math.random() * (max - min + 1) + min)
		  
		}
      	
      	// 获得当前窗口的宽高
      	this.getWindowWH=() => {
		  
		  	let vH=this.getScrollBarWidth();
		  	
	        let wW=window.innerWidth-vH.width-1;//-1为小球boderde宽度
	        let hH=window.innerHeight-vH.height-1;//-1为小球boderde宽度
	        
	        return {'wW':wW,'hH':hH};
		}
      	
      	/**
         * 开启覆盖
         *
         * @param {bool} val
         */
        this.setAsNewtab = (val,href=null) => {
        	
        	
        	return new Promise((resolve) => {
            
	            $.api.storage.sync.get(["newtab"], (obj) => {
	                
	                const config = obj.newtab || {};
	                config.override = val;
	                
	                $.api.storage.sync.set({newtab: config}, () => {
	                	
	                	resolve();//确保数据存储
	                    
	                    ext.helper.dao.call("reinitialize").then(()=>{
	                    	
	                    	if(href){
	                    		ext.helper.dao.call("openLink", {//打开美化页
		                    		href:href,
				                    newTab: false
				                });
	                    	}
	                    	
	                    });
	                });
	            });
	        });
        };
        
        /**
         * Returns the type of the current url
         *
         * @returns {string}
         */
        this.getPageType = () => {
            
            const url = location.href;
            let ret = "other";
            let found = false;

            Object.entries({
                newtab_default: ["https?://www\\.google\\..+/_/chrome/newtab"],
                newtab_fallback: [$.api.runtime.getURL("html/newtab.html") + ".*[?&]type=\\w+"],
                newtab_replacement: [$.api.runtime.getURL("html/newtab.html")],
                sidepanel: [$.api.runtime.getURL("html/sidepanel.html")],
                newtab_website: [".*[?&]bs_nt=1(&|#|$)"],
                website: ["https?://"],
                onboarding: ["chrome\\-extension://.*/intro.html", "extension://.*/intro.html"],
                chrome: ["chrome://", "edge://"],
                extension: ["chrome\\-extension://", "extension://"],
                local: ["file://"]
            }).some(([key, patterns]) => {
                patterns.some((str) => {
                    if (url.search(new RegExp(str, "gi")) === 0) {
                        ret = key;
                        found = true;
                        return true;
                    }
                });
                if (found) {
                    return true;
                }
            });

            return ret;
        };
    };

})(jsu);