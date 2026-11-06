($ => {
    "use strict";
	
    /**
	 * @param {Object} s
	 * 书签管理
	 */
    $.LinkCheckerHelper = function (s) {
    	
        /**
         * How many links are checked at once. Each check now stops on its own timeout,
         * so a few more can stay in flight without one slow site holding the rest.
         *
         * @type {number}
         */
        const POOL_SIZE = 8;

        /**
         * Per-request limit passed to the background checker (HEAD, then one GET if needed).
         *
         * @type {number}
         */
        const CHECK_TIMEOUT = 4500;
    	
    	/**
         *
         * @type {Object}
        */
        let elements = {};
        
        /**
         *
         * @type {boolean}
         */
        let updated = false;
		
        /**
         * Initialises the behaviour settings
         *
         * @returns {Promise}
         */
        this.init = async () => {
        	showAllFolder();
        	initEvent();
        };
        
        /**
         *
         * @param {object }entries
         */
        const initOverlay = (entries) => {
            
            
            const entryObj = getFlatEntryList(entries);//获得目录+和url
            
            elements.buttonWrapper = elements.modal.find("menu." + $.cl.confirm.buttonWrapper);
            let bold=" <b>"+entryObj.bookmarks.length.toLocaleString()+"</b> ";
            elements.desc = $("<p></p>").html(s.helper.i18n.get("manage_check_bookmarks_loading",[bold],false)).appendTo(elements.modal);
            elements.progressBar = $("<div></div>").addClass($.cl.confirm.progressBar).html("<div></div>").appendTo(elements.modal);
            elements.progressLabel = $("<span></span>").addClass($.cl.confirm.checkUrlProgressLabel).html("<span>0</span>").appendTo(elements.modal);

            $.delay(200).then(() => {
                elements.modal.addClass($.cl.confirm.urlCheckLoading);
            });

            initGeneralEvents();

            const results = {
                count: 0,
                broken: [],
                duplicate: [],
                changed: [],
                empty: []
            };

            checkDirectories(entryObj.directories, results).then(() => {//检测文件夹
              return checkListOfBookmarks(entryObj.bookmarks, results);
            }).then(() => {
                displayResultPage(results);
            });

        };
                
         /**
         * Shows the results of the url checker
         *
         * @param {object} results
         */
        const displayResultPage = (results) => {
            const hasResults = results.count > 0;
            delete results.count;

            elements.desc.remove();
            elements.progressBar.remove();
            elements.progressLabel.remove();

            if (hasResults) { // results available -> increase modal size
                elements.modal.addClass($.cl.confirm.urlCheckResults);
            }

            $.delay(hasResults ? 500 : 0).then(() => {
                
                elements.modal.removeClass($.cl.confirm.urlCheckLoading);
                elements.buttonWrapper.children("a." + $.cl.close).text(s.helper.i18n.get("overlay_close"));

                if (hasResults === false) {
                    showAllResolvedMessage();
                } else {
                    elements.menu = $("<menu></menu>").addClass($.cl.confirm.urlCheckCategories).appendTo(elements.modal);
                    elements.results = {};
                    elements.actions = {};

                    let initialOpenedMenuEntry = null;

                    Object.entries(results).forEach(([key, result]) => { // create a menu entry and result list for each type (broken, changed, duplicate)
                        const menuEntry = $("<li></li>")
                            .html("<a>" + s.helper.i18n.get("manage_check_bookmarks_menu_" + key) + "<span></span></a>")
                            .attr($.attr.name, key)
                            .appendTo(elements.menu);

                        if (result.length > 0 && initialOpenedMenuEntry === null) { // menupoint has entries and no other menu entry is set to be opened initially yet
                            initialOpenedMenuEntry = menuEntry.children("a");
                        }

                        if (key !== "duplicate") { // show button to update all urls from the currently displayed list, except for the list with duplicates
                            let langVarPrefix = "manage_check_bookmarks_update";
                            if (key === "broken" || key === "empty") {
                                langVarPrefix = "manage_check_bookmarks_remove";
                            }

                            elements.actions[key] = $("<a></a>")
                                .addClass($.cl.confirm.urlCheckAction)
                                .attr($.attr.name, key)
                                .text(s.helper.i18n.get(langVarPrefix + "_selected"))
                                .appendTo(elements.buttonWrapper);
                        }

                        elements.results[key] = s.helper.scroll.add($.opts.ids.confirm.urlCheckResult + "_" + key, $("<ul></ul>").appendTo(elements.modal));

                        result.forEach((entry) => { // fill result list
                            const resultEntry = $("<li></li>").data("entry", entry).appendTo(elements.results[key].children("ul"));

                            switch (key) {
                                case "broken":
                                case "changed": {
                                    displayChangedOrBrokenUrl(entry, resultEntry);
                                    break;
                                }
                                case "duplicate": {
                                    displayDuplicateUrls(entry, resultEntry);
                                    break;
                                }
                                case "empty": {
                                    displayEmptyDirectory(entry, resultEntry);
                                    break;
                                }
                            }
                        });
                    });

                    updateResultPage();
                    initResultPageEvents();

                    if (initialOpenedMenuEntry) { // open the first menu entry with results initially
                        initialOpenedMenuEntry.trigger("click");
                    }
                }
            });
        };
        
         /**
         * Initialises the eventhandlers for the result age
         */
        const initResultPageEvents = () => {
            
            elements.menu.find("a").on("click", (e) => { // click on menu element -> change view
                e.preventDefault();

                const entry = $(e.currentTarget).parent("li");
                const name = entry.attr($.attr.name);

                if (elements.results && elements.results[name]) {
                    elements.menu.children("li").removeClass($.cl.active);
                    entry.addClass($.cl.active);

                    ["results", "actions"].forEach((elmName) => {
                        if (elements[elmName]) {
                            Object.entries(elements[elmName]).forEach(([key, elm]) => {
                                if (name === key) {
                                    elm.addClass($.cl.visible);
                                } else {
                                    elm.removeClass($.cl.visible);
                                }
                            });
                        }
                    });
                }
            });

			//删除
            Object.entries(elements.results).forEach(([key, elm]) => {
                elm.find("a." + $.cl.confirm.urlCheckAction).on("click", (e) => { // click on specific action button next to an entry in the list -> update only this entry
                    e.preventDefault();
                    const entry = $(e.currentTarget).parent("li");
                    const data = entry.data("entry");
                    entry.css("height", entry[0].offsetHeight + "px");

                    $.delay().then(() => {
                        entry.addClass($.cl.hidden);
                        return Promise.all([
                            updateEntry(data),
                            $.delay(500)
                        ]);
                    }).then(() => {
                        entry.remove();
                        updateResultPage();
                    });
                });

				//影藏
                elm.find("a." + $.cl.confirm.urlCheckHide).on("click", (e) => { // hide result from the list to never show again
                    e.preventDefault();
                    const entry = $(e.currentTarget).parent("li");
                    const data = entry.data("entry");
                    entry.css("height", entry[0].offsetHeight + "px");

                    $.delay().then(() => {
                        entry.addClass($.cl.hidden);
                        ignoreEntry(data);
                        return $.delay(500);
                    }).then(() => {
                        entry.remove();
                        updateResultPage();
                    });
                });
            });

			//按钮
            elements.buttonWrapper.find("a." + $.cl.confirm.urlCheckAction).on("click", (e) => { // click on action button in the footer -> update all urls from the currently displayed list
                e.preventDefault();
                const name = $(e.currentTarget).attr($.attr.name);

                if (elements.results && elements.results[name]) {
                    const entries = [];

                    elements.results[name].find("> ul > li").forEach((elm) => {
                        if ($(elm).find("input[type='checkbox']")[0].checked) {
                            entries.push($(elm).data("entry"));
                            $(elm).remove();
                        }
                    });

                    updateMultipleBookmarks(entries).then(() => {
                        updateResultPage();
                    });
                }
            });
        };
        
        /**
         * Updates the list of entries, by calling the updateEntry method one after each other
         *
         * @param {Array} entries
         * @returns {Promise}
         */
        const updateMultipleBookmarks = async (entries) => {
            for (const entry of entries) {
                await updateEntry(entry);
            }
        };
        
         /**
         * Updates the url of the given entry if it has changed or removes the entry, if the status code of the url checker is 404
         *
         * @param {object} entry
         * @returns {Promise}
         */
        const updateEntry = (entry) => {
            return new Promise((resolve) => {
                updated = true;

                if (entry.broken || entry.duplicate || (entry.children && entry.children.length === 0)) {
                    s.helper.bookmark.performDeletion(entry.id, true).then(resolve);
                } else if (entry.url !== entry.newUrl) {
                    const additionalInfo = entry.additionalInfo && entry.additionalInfo.desc ? entry.additionalInfo.desc : null;

                    s.helper.bookmark.editEntry({
                        id: entry.id,
                        title: entry.title,
                        url: entry.newUrl,
                        additionalInfo: additionalInfo
                    }).then(resolve);
                } else {
                    resolve();
                }
            });
        };
        
         /**
         * Adds the given entry to the ignore list to not show it in any linkchecker results again
         *
         * @param {object} entry
         */
        const ignoreEntry = (entry) => {
            const ignoreList = ext.helper.dao.getData("u/linkcheckerIgnored");
            let key = entry.id;
            const data = {type: "unknown"};

            if (entry.broken) {
                key = entry.url;
                data.type = "broken";
            } else if (entry.duplicates) {
                key = entry.label;
                data.type = "duplicate";
            } else if (entry.url !== entry.newUrl) {
                key = entry.url;
                data.type = "outdated";
                data.newUrl = entry.newUrl;
            }

            ignoreList[key] = data;
            ext.helper.dao.setData({"u/linkcheckerIgnored": ignoreList});
        };
        
         /**
         * Updates the result page,
         * will be called everytime an entry in the result list has been updated or removed
         */
        const updateResultPage = () => {
            let allResolved = true;

            Object.entries(elements.results).forEach(([key, elm]) => {
                let count = elm.find("> ul > li").length();

                if (key === "duplicate") {
                    elm.find("> ul > li").forEach((listEntry) => {
                        const duplicateCount = $(listEntry).find("> ul > li").length();

                        if (duplicateCount === 0) {
                            $(listEntry).remove();
                            count--;
                        } else if (duplicateCount === 1) {
                            count--;
                        }
                    });
                }
                
                elements.menu.find("li[" + $.attr.name + "='" + key + "'] > a > span").text("‹" + count + "›");

                if (count === 0) { // tab is empty -> show info text
                    elm.children("ul,p").remove();
                    
                    $("<p></p>")
                    .append($("<span></span").attr($.attr.title,s.helper.i18n.get("manage_check_bookmarks_no_results")))
                    .appendTo(elm);

                    if (elements.actions && elements.actions[key]) {
                        elements.actions[key].remove();
                    }
                } else {
                    allResolved = false;
                }
            });

            if (allResolved) { // all tabs are empty -> show success text
                showAllResolvedMessage();
            }
        };

        /**
         * Shows a message when all url check results have been resolved (or the result was already empty),
         * removes the menu and result lists from the overlay and shows the message instead
         */
        const showAllResolvedMessage = () => {
            elements.modal.addClass($.cl.confirm.urlCheckLoading);

            $.delay().then(() => {
                elements.modal.removeClass($.cl.confirm.urlCheckResults);
                elements.modal.find("menu." + $.cl.confirm.urlCheckCategories).remove();

                ["results", "actions"].forEach((elmName) => {
                    if (elements[elmName]) {
                        Object.values(elements[elmName]).forEach((elm) => {
                            elm.remove();
                        });
                    }
                });

                $("<p></p>").addClass($.cl.success).text(s.helper.i18n.get("manage_check_bookmarks_no_results")).appendTo(elements.modal);

                return $.delay(500);
            }).then(() => {
                elements.modal.removeClass($.cl.confirm.urlCheckLoading);
            });
        };

        
         /**
         * Displays the entry in the result list for the empty directory
         *
         * @param {object} entry
         * @param {jsu} resultEntry
         */
        const displayEmptyDirectory = (entry, resultEntry) => {
        	
            const parentInfos = s.helper.entry.getParentsById(entry.id);
            
            if (parentInfos.length > 0) {
                s.helper.checkbox.get(elements.body, {checked: "checked"}).appendTo(resultEntry);

                const breadcrumb = $("<ul></ul>").addClass($.cl.sidebar.breadcrumb).appendTo(resultEntry);

                parentInfos.forEach((parentInfo) => {
                    $("<li></li>").text(parentInfo.title).prependTo(breadcrumb);
                });

                $("<li></li>").text(entry.title).appendTo(breadcrumb);
            } else {
                resultEntry.remove();
            }

            $("<a></a>").addClass($.cl.confirm.urlCheckAction).appendTo(resultEntry);
        };

        /**
         * Displays the entry in the result list for duplicate urls
         *
         * @param {object} entry
         * @param {jsu} resultEntry
         */
        const displayDuplicateUrls = (entry, resultEntry) => {
            const title = $("<a></a>").addClass($.cl.info).attr({
                href: entry.url,
                title: entry.label,
                target: "_blank"
            }).html(entry.label).appendTo(resultEntry);
            const list = $("<ul></ul>").attr($.attr.type, "duplicates").appendTo(resultEntry);

            entry.duplicates.forEach((duplicate) => {
                duplicate.duplicate = true;
                const elm = $("<li></li>").data("entry", duplicate).appendTo(list);
                $("<strong></strong>").html(duplicate.title).appendTo(elm);

                const parentInfos = s.helper.entry.getParentsById(duplicate.id);

                if (parentInfos.length > 0) {
                    const breadcrumb = $("<ul></ul>").addClass($.cl.sidebar.breadcrumb).appendTo(elm);
                    parentInfos.forEach((parentInfo) => {
                        $("<li></li>").text(parentInfo.title).prependTo(breadcrumb);
                    });
                }

                $("<a></a>").addClass($.cl.confirm.urlCheckAction).appendTo(elm);
            });
            
            //$("<a></a>").addClass($.cl.confirm.urlCheckHide).appendTo(resultEntry);
            
            s.helper.dao.call("getFavicon",{url: entry.url,icon:{size:32,title:entry.label}}).then((response) => {
                if (response && response.img) {
                    $("<img src='" + response.img + "' />").insertBefore(title);
                }
            });
        };

        /**
         * Displays the entry in the result list for the broken and changed urls
         *
         * @param {object} entry
         * @param {jsu} resultEntry
         */
        const displayChangedOrBrokenUrl = (entry, resultEntry) => {
            s.helper.checkbox.get(elements.body, {checked: "checked"}).appendTo(resultEntry);

            $("<strong></strong>").text(entry.title).appendTo(resultEntry);
            const list = $("<ul></ul>").attr($.attr.type, "urls").appendTo(resultEntry);

            ["url", "newUrl"].forEach((attr) => {
                if (entry[attr]) {
                    const elm = $("<li></li>").appendTo(list);
                    $("<a></a>").attr({
                        href: entry[attr],
                        title: entry[attr],
                        target: "_blank"
                    }).html(entry[attr]).appendTo(elm);
                }
            });

			//不要hidden，直接删除
            $("<a></a>").addClass($.cl.confirm.urlCheckAction).appendTo(resultEntry);

            s.helper.dao.call("getFavicon",{url: entry.url,icon:{size:32,title:entry.title}}).then((response) => {
                if (response && response.img) { // favicon found -> add to entry
                    $("<img src='" + response.img + "' />").insertAfter(resultEntry.children("div." + $.cl.checkbox.box));
                }
            });
            
        };
        
        
         /**
         * Initialises the general eventhandlers
         */
        const initGeneralEvents = () => {
            $(document).on($.opts.events.overlayClosed, () => { // reload sidebar if the overlay is getting closed and URLs got changed
                if (updated) {
                    updated = false;
                    s.helper.dao.call("reload", {type: "Update"}).then(()=>{
                    	//刷新tree
                    	showAllFolder();
                    });
                }
            });
            
            elements.modal.find("a." + $.cl.close).on("click", (e) => { // close overlay by close button
                e.preventDefault();
                this.closeOverlay();
            });
        };
        
       this.closeOverlay = () => {
            
            s.helper.util.triggerEvent("overlayClosed");//触发事件
            elements.overlay.removeClass($.cl.visible);
            $.delay(400).then(() => {
                elements.overlay.remove();
            });
        };
        
        /**
         * Checks the directories and adds all empty directories to the results
         *
         * @param {Array} directories
         * @param {object} results
         * @returns {Promise}
         */
        const checkDirectories = async (directories, results) => {
            directories.forEach((directory) => {
                if (JSON.stringify(directory.children) === '[]') {
                    results.empty.push(directory);
                    results.count++;
                }
            });
        };
        
        /**
         * 比较用的地址：去掉锚点、末尾斜杠和跟踪参数。loose 为 true 时连协议也忽略，用来认重复书签。
         */
        const trackingParam = {
            "utm_source": 1, "utm_medium": 1, "utm_campaign": 1, "utm_term": 1, "utm_content": 1,
            "utm_id": 1, "utm_name": 1, "fbclid": 1, "gclid": 1, "gclsrc": 1, "dclid": 1,
            "msclkid": 1, "mc_cid": 1, "mc_eid": 1, "igshid": 1, "spm": 1, "si": 1,
            "yclid": 1, "twclid": 1, "gbraid": 1, "wbraid": 1, "_ga": 1, "_gl": 1, "cmpid": 1
        };

        const searchParam = {
            "bookmarkmars.com": ["q"],
            "google.com": ["q"],
            "google.de": ["q"],
            "baidu.com": ["q"],
            "bing.com": ["q"],
            "so.com": ["q"],
            "toutiao.com": ["keyword"],
            "sogou.com": ["query"],
            "zhihu.com": ["q"],
            "bilibili.com": ["keyword"],
            "youtube.com": ["search_query", "v", "list"]
        };

        const urlKey = (raw, loose) => {
            try {
                const url = new URL(raw);
                const host = url.hostname.replace(/^www\./i, "").toLowerCase();
                const path = url.pathname.replace(/\/+$/, "");
                const keep = searchParam[host];
                const params = [];

                url.searchParams.forEach((val, key) => {
                    const name = key.toLowerCase();
                    if (!val || trackingParam[name]) {
                        return;
                    }
                    if (keep && keep.indexOf(name) === -1 && keep.indexOf(key) === -1) {
                        return;
                    }
                    params.push(name + "=" + val);
                });
                params.sort();

                const tail = host + path + (params.length ? "?" + params.join("&") : "");
                if (loose) {
                    return tail;
                }
                return (url.protocol === "http:" ? "http" : "https") + "://" + tail;
            } catch (e) {
                return String(raw || "");
            }
        };

        /**
         * Checks the urls of the given bookmarks and returns the check results
         *
         * @param {Array} bookmarks
         * @param {object} results
         * @returns {Promise}
         */
        const checkListOfBookmarks = (allBookmarks, results) => {
            return new Promise((resolve) => {
                let finished = 0;
                let cursor = 0;
                let openJobs = 0;
                const totalBookmarks = allBookmarks.length;
                const httpCache = new Map();
                const networkBroken = [];
                const checkedIds = {};

                allBookmarks.forEach((bookmark) => {
                    checkedIds[bookmark.id] = true;
                });

                const bump = () => {
                    finished++;
                    if (totalBookmarks > 0) {
                        elements.progressBar.children("div").css("width", (finished / totalBookmarks * 100) + "%");
                    }
                    elements.progressLabel.children("span").eq(0).text(finished.toLocaleString());
                };

                const hostUp = (url) => {
                    const controller = new AbortController();
                    const timer = setTimeout(() => controller.abort(), 4000);
                    return fetch(url, {method: "HEAD", cache: "no-store", signal: controller.signal}).then((res) => {
                        clearTimeout(timer);
                        try {
                            if (res.body && res.body.cancel) {
                                res.body.cancel().catch(() => {});
                            }
                        } catch (e) {
                            //
                        }
                        return res.status > 0 && res.status < 500;
                    }).catch(() => {
                        clearTimeout(timer);
                        return false;
                    });
                };

                // 两个都失败才认为当前网络不可用，避免把整库都标成失效。
                const networkUp = Promise.all([
                    hostUp("https://www.gstatic.com/generate_204"),
                    hostUp("https://www.baidu.com/")
                ]).then((flags) => flags.some(Boolean));

                const classify = (bookmark, response) => {
                    const httpInfo = response && response.httpInfo;
                    if (!httpInfo) {
                        return;
                    }

                    if (httpInfo.ok === false) {
                        const entry = {
                            id: bookmark.id,
                            title: bookmark.title,
                            url: bookmark.url,
                            broken: true
                        };
                        if (httpInfo.status) {
                            results.broken.push(entry);
                            results.count++;
                        } else {
                            networkBroken.push(entry);
                        }
                        return;
                    }

                    const status = httpInfo.status;
                    const nextUrl = httpInfo.url;
                    if (status >= 200 && status < 400 && nextUrl && urlKey(bookmark.url, false) !== urlKey(nextUrl, false)) {
                        results.changed.push({
                            id: bookmark.id,
                            title: bookmark.title,
                            url: bookmark.url,
                            newUrl: nextUrl,
                            additionalInfo: bookmark.additionalInfo
                        });
                        results.count++;
                    }
                };

                const checkOne = (bookmark) => {
                    let job = httpCache.get(bookmark.url);
                    if (!job) {
                        job = s.helper.dao.call("checkUrl", {url: bookmark.url, all: false, timeout: CHECK_TIMEOUT}).catch(() => {
                            return {httpInfo: null};
                        });
                        httpCache.set(bookmark.url, job);
                    }

                    return new Promise((resolveJob) => {
                        let released = false;
                        const release = () => {
                            if (released) {
                                return;
                            }
                            released = true;
                            bump();
                            resolveJob();
                        };
                        const timer = setTimeout(release, 16000);
                        openJobs++;
                        job.then((response) => {
                            classify(bookmark, response);
                        }).finally(() => {
                            clearTimeout(timer);
                            openJobs--;
                            release();
                        });
                    });
                };

                const collect = (nodes, out) => {
                    (nodes || []).forEach((node) => {
                        if (node.url && s.helper.util.isUrlOnBlacklist(node.url) === false) {
                            out.push(node);
                        }
                        if (node.children) {
                            collect(node.children, out);
                        }
                    });
                };

                const duplicatePromise = s.helper.dao.call("bookmarks", {id: 0}).then((data) => {
                    const all = [];
                    collect(data && data.bookmarks, all);
                    return all.length ? all : allBookmarks;
                }).catch(() => {
                    return allBookmarks;
                }).then((nodes) => {
                    const groups = new Map();
                    nodes.forEach((node) => {
                        const key = urlKey(node.url, true);
                        if (!key) {
                            return;
                        }
                        let list = groups.get(key);
                        if (!list) {
                            list = [];
                            groups.set(key, list);
                        }
                        if (!list.some((item) => item.id === node.id)) {
                            list.push(node);
                        }
                    });
                    groups.forEach((list, key) => {
                        if (list.length < 2 || !list.some((item) => checkedIds[item.id])) {
                            return;
                        }
                        results.duplicate.push({
                            label: key,
                            url: list[0].url,
                            duplicates: list
                        });
                        results.count++;
                    });
                });

                const worker = async () => {
                    while (cursor < allBookmarks.length) {
                        const bookmark = allBookmarks[cursor++];
                        await checkOne(bookmark);
                    }
                };

                const workers = [];
                const pool = Math.min(POOL_SIZE, totalBookmarks);
                for (let i = 0; i < pool; i++) {
                    workers.push(worker());
                }

                Promise.all(workers).then(() => {
                    if (openJobs === 0) {
                        return null;
                    }
                    return new Promise((done) => {
                        const watch = setInterval(() => {
                            if (openJobs === 0) {
                                clearInterval(watch);
                                done();
                            }
                        }, 200);
                        setTimeout(() => {
                            clearInterval(watch);
                            done();
                        }, 20000);
                    });
                }).then(() => networkUp).then((up) => {
                    if (up) {
                        networkBroken.forEach((entry) => {
                            results.broken.push(entry);
                            results.count++;
                        });
                    }
                }).then(() => duplicatePromise).then(() => {
                    $.delay(500).then(() => {
                        resolve(results);
                    });
                });
            });
        };
        
        
        /**
         * Extracts the bookmarks and directories from the given tree and returns them as a flat list
         *
         * @param {object} entries
         * @returns {object}
         */
        const getFlatEntryList = (entries) => {
            const ret = {
                bookmarks: [],
                directories: []
            };

            const process = (entries) => { // check all subordinate bookmarks of the given directory
                entries.forEach((entry) => {
                    if (entry.url && s.helper.util.isUrlOnBlacklist(entry.url) === false) {
                        ret.bookmarks.push(entry);
                    } else if (entry.children) {
                        ret.directories.push(entry);
                        process(entry.children);
                    }
                });
            };
            process(entries);
            return ret;
        };
		
        /**
		 * 添加所有书签的预览
		 */
        const showAllFolder = () => {
        	return new Promise((resolve) => {
	            s.helper.dao.call("bookmarks", {id: 0}).then((data) => {
	            	
	            	const folderBox=s.elm.check.folderBox;
	            	folderBox.html("");
	            	getTree(folderBox,data.bookmarks[0].children);
	            });
	        });
        };

  	    const addDirIcon = (color="") =>{
  	    	let svg='<svg t="1662274332781" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="10195" width="48" height="48"><path d="M885.333333 168.533333h-448L341.333333 110.933333c-6.4-4.266667-14.933333-6.4-21.333333-6.4H134.4c-51.2 0-93.866667 42.666667-93.866667 93.866667v622.933333c0 51.2 42.666667 93.866667 93.866667 93.866667h750.933333c51.2 0 93.866667-42.666667 93.866667-93.866667V262.4c0-51.2-40.533333-93.866667-93.866667-93.866667z m-738.133333 21.333334h160l96 57.6c6.4 4.266667 14.933333 6.4 21.333333 6.4h445.866667c12.8 0 21.333333 8.533333 21.333333 21.333333V298.666667c0 12.8-8.533333 21.333333-21.333333 21.333333h-725.333333c-12.8 0-21.333333-8.533333-21.333334-21.333333V211.2c2.133333-10.666667 12.8-21.333333 23.466667-21.333333z" fill="${color}" p-id="10196"></path></svg>';
  	    	return svg.replace("${color}",color);
  	    }
  	    
  	    const getTree = (show,childrens) =>{//返回一定是个promise
  	    	
  	    	if(typeof childrens === "undefined" ){return;}
	
        	let ul=$('<ul></ul>');
        	let li;
        	
        	for (const item of childrens) {
				   
    			if(item.children){
    				
    				li =$("<li></li>").attr($.attr.id,item.id);
    				
    				li.attr($.attr.type,"dir");
    				let icon=addDirIcon();
    				
    				li.addClass($.cl.manage.bookmarksManage.open);
    				let title="<span>"+item.title+"</span>"
    				li.html(icon+title);
    				
    				getTree(li,item.children);
    			}
               	ul.append(li);
			}
        	ul.appendTo(show);
        }
  	    
  	    const createOverlay = (type,title, data)=>{
  	    	
  	    	$("#"+$.opts.ids.confirm.linkCheckModal).remove();
  	    	elements = s.helper.template.overlay(type, title,$.opts.ids.confirm.linkCheckModal);
            elements.overlay.data("info", data || {});
            
			//modal
            elements.body = elements.modal.parents("body");
            
            initOverlay(data);
  	    }
  	    
  	    
  	    const beginCheck = (e)=>{
  	    	
	    	// VIP temporarily disabled — allow link check for all users
    		
    		let li=$(e.currentTarget).parent("li");
    		const opts={
    			id:li.attr($.attr.id),
    			title:li.find(">span").text(),
    		}
    		
    		s.helper.dao.call("bookmarks", {id: opts.id}).then((data) => {
    			createOverlay("check", s.helper.i18n.get("manage_check_modal_name",[opts.title],false),data.bookmarks[0].children);
    		});
		}
  	    
  	    const initEvent = () => {
  	     	
  	     	const folderBox=s.elm.check.folderBox;
  	     	const checkBox = s.elm.check.content;
  	     	
  	     	folderBox.on("click","ul li[" + $.attr.type + "='dir'] > span",(e)=>{
    			beginCheck(e);
    		});
    		
    		folderBox.on("click","ul li[" + $.attr.type + "='dir'] > svg",(e)=>{
    			beginCheck(e);
    		});
    		
    		//开合状态
    		const powerfulCheck=s.helper.dao.getData("b/powerfulCheck");
    		const check=checkBox.find("div."+$.cl.manage.linkchecker.powerfulCheck+">div[" + $.attr.type + "='checkbox']");
    		if(powerfulCheck){
    			check.addClass([$.cl.active,$.cl.checkbox.focus]);
    		}else{
    			check.removeClass([$.cl.active,$.cl.checkbox.focus]);
    		}
    		
  	    };
    };
})(jsu);