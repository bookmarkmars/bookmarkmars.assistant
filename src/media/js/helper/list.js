($ => {
    "use strict";

    /**
     * @param {object} ext
     * @constructor
     */
    $.ListHelper = function (ext) {
    	
    	let restoreOpenStateRunning = 0;
    	
    	let dirOpenDuration = 1;//延时
    	
    	let sort = {};
    	
        /**
         *
         * @returns {Promise}
         */
        this.init = async () => {
        	
        	//激活
        	ext.elm.bookmarkBox.all.addClass($.cl.active);
        	
        	//文件夹打开延时
        	const dirOpenDurationRaw = ext.helper.dao.getData("b/dirOpenDuration");
        	dirOpenDuration = +dirOpenDurationRaw * 1000;
            
            //更新书签列表
            this.updateBookmarkBox();

        }
        
         /**
         * Updates the sidebar with the newest set of bookmarks
         *
         * @returns {Promise}
         */
        this.updateBookmarkBox = () => {
            
            return new Promise((resolve) => {
                
                ext.startLoading();
                
                //sort
				sort = ext.helper.dao.getData("u/sort") || {};
				sort.dir = sort.name === "default" ? "ASC" : sort.dir;
				
				ext.elm.sortBox.find("select[data-type='field'] option[data-value='"+sort.name+"']").attr("selected","selected");
	            ext.elm.sortBox.find("select[data-type='order'] option[data-value='"+sort.dir+"']").attr("selected","selected");
                
                //剔除所有add类
                ext.elm.bookmarkBox.all.children("a[" + $.attr.name + "='add']").remove();

                const list = ext.elm.bookmarkBox.all.children("ul");
                
                ext.updateBookmarkBoxStart = +new Date();

				let promiseObj = sort.name === "default" 
			    ? ext.helper.dao.call("getCache", { name: "htmlList" }).then((cache) => [cache])
			    : Promise.resolve([]);

                //ext.helper.scroll.focus();
                promiseObj
			    .then((result) => {
			        if (result[0]?.val) {
			            return updateFromCache(list, result[0].val);
			        } else {
			            return updateFromObject(list);
			        }
			    })
			    .then(() => resolve())
			    .catch((error) => {
			        ext.log("Error updating bookmark box:", error);
			        resolve(); // Ensure the promise resolves even on error
			    });

            });
        };
        
         /**
         * Removes specific classes from the children of the given element
         *
         * @param {jsu} elm
         */
        const cleanCachedHtml = (elm) => {
            elm.find("div." + $.cl.checkbox.box).removeClass($.cl.active);
            elm.find("a." + $.cl.sidebar.mark).removeClass($.cl.sidebar.mark);
            elm.find("a." + $.cl.hover).removeClass($.cl.hover);
            elm.find("li." + $.cl.drag.dragHover).removeClass($.cl.drag.dragHover);
            elm.find("a." + $.cl.drag.dragHover).removeClass($.cl.drag.dragHover);
            elm.find("a." + $.cl.sidebar.lastHover).removeClass($.cl.sidebar.lastHover);
            elm.find("li." + $.cl.drag.dragInitial).removeClass($.cl.drag.dragInitial);
            elm.find("li." + $.cl.drag.isDragged).remove();
        };
        
        /**
         * Updates the list by setting the content from the cache
         *
         * @param {jsu} list
         * @param {string} cachedHtml
         * @returns {Promise}
         */
        const updateFromCache = (list, cachedHtml) => {
            return new Promise((resolve) => {
            	
                //load from cache
                list.html(cachedHtml);

				//清除没用标签
                cleanCachedHtml(list);

				//找回favicon
                loadMissingFavicons(list, true);
                
                //加cache标志
                ext.elm.bookmarkBox.all.addClass($.cl.sidebar.cached);

				this.updateSidebarHeader();

                if (list.children("li").length() === 1) { // hide root directory if it's the only one -> show the content of this directory
                    
                    list.addClass($.cl.sidebar.hideRoot);//影藏文件夹

                    $("<p></p>")
                    .addClass($.cl.sidebar.searchResultBare)
                    .attr($.attr.title,ext.helper.i18n.get("sidebar_no_bookmarks"))
                    .insertAfter(list);
                }
                
                $.delay(100).then(() => {
                    restoreScrollPos();
                    resolve();
                });
            });
        };
        
        /**
         * Loads the missing favicons of the entries in the given wrapper element
         *
         * @param {jsu} wrapper
         * @param {boolean} cache whether to cache the html when at least one favicon was missing
         * @returns {Promise}
         */
        const loadMissingFavicons = (wrapper, cache = false) => {
            return new Promise((resolve) => {
                const promises = [];
                wrapper.find("a." + $.cl.sidebar.bookmarkLink + " > img[" + $.attr.value + "]").forEach((img) => {
                    const entry = $(img).parent("a");
                    const url = $(img).attr($.attr.value);
                    promises.push(addFavicon(entry, url));
                });

                if (promises.length > 0) {
                    ext.log("Detected: Missing bookmark favicons");

                    Promise.all(promises).then(() => {
                        if (cache) {
                            this.cacheList().then(resolve);
                        } else {
                            resolve();
                        }
                    });
                } else {
                    resolve();
                }
            });
        };
        
       

        /**
         * Updates the list by building the content from the bookmark tree
         *
         * @param {jsu} list
         * @returns {Promise}
         */
        const updateFromObject = (list) => {
            
            return new Promise((resolve) => {
                
                let entries = [];
                
                //踢出所有cache标记
                ext.elm.bookmarkBox.all.removeClass($.cl.sidebar.cached);

				//请求书签
                ext.helper.dao.call("bookmarks", {id: 0}).then((response) => {
                    ext.refreshRun = true;
                    list.removeClass($.cl.sidebar.hideRoot).html("");
                    
                    if (response.bookmarks && response.bookmarks[0] && response.bookmarks[0].children) { // children are existing
                        entries = response.bookmarks[0].children;
                    }
                    
                    return ext.helper.entry.init(entries);
                    
                }).then(()=>{
                	
                	return ext.helper.freUsed.init(list);//添加常用
                })
                .then(() => {

					this.updateSidebarHeader();

                    this.addBookmarkDir(entries, list, true);

                    this.restoreOpenStates(list, true);//恢复打开状态

					ext.helper.freUsed.addRecommend(entries).then(resolve);
                })
                .catch((error) => {
			        resolve(); // Ensure the promise resolves even on error
			    });
            });
        };

 		/**
         * Adds the given bookmarks to the given list
         *
         * @param {Array} bookmarks
         * @param {jsu} list
         * @param {boolean} asTree one dimensional list or with directories
         * @param {boolean} sorting whether the bookmarks need to be sorted or not
         * @returns {boolean} returns false if nothing has been added
         */
        this.addBookmarkDir = (bookmarks, list, asTree = true, sorting = true) => {
            
            let hasEntries = false;
            const showSeparators = true;
            
            //延时打开
            list.css("transition", "height " + dirOpenDuration + "ms");

			//计数、清除标识
            let bookmarkCounter = 0;
            
            if (sorting) {
                ext.helper.util.sortEntries(bookmarks, sort);
            }
            
			//只展示树状结构，不展示平面图
            bookmarks.some((bookmark, idx) => {

                if (bookmark.children || bookmark.url) { // is dir or link -> fix for search results (chrome returns dirs without children and without url)

                    if (ext.helper.entry.isSeparator(bookmark.id) === false || showSeparators) { // entry is no separator or separators should be displayed
                        
                        this.addEntryToList(bookmark, list, {
                            asTree: asTree
                        });
                    }

                    if (bookmark.url) { // link
                        bookmarkCounter++;
                    }
                    hasEntries = true;
                }
            });

            return hasEntries;
        };
        
        /**
         * Adds the given remote bookmarks to the given list
         *
         * @param {Array} bookmarks
         * @param {jsu} list
         */
        this.addBookmarkRemote = (bookmarks, list) => {
            
            let hasEntries = false;

			//只展示树状结构，不展示平面图
            bookmarks.some((bookmark) => {

                if (bookmark.url) { //带链接

                    this.addEntryToList(bookmark, list, {
                        asTree: true
                    });

                    hasEntries = true;
                }
            });
            
            return hasEntries;
        };
        
         /**
         * Adds the given bookmark to the list
         *
         * @param {object} bookmark
         * @param {jsu} list
         * @param {object} opts
         * @returns {jsu}
         */
        this.addEntryToList = (bookmark, list, opts) => {
        	
            const entry = $("<li></li>").appendTo(list);
            const label = bookmark.title && bookmark.title.trim().length ? bookmark.title : "";
            const entryContent = $("<a></a>").appendTo(entry);
            
            const labelElm = $("<span></span>")
            .addClass($.cl.sidebar.bookmarkLabel)
            .text(label.trim())
            .appendTo(entryContent);
 			
 			let dragElm = null;
 			let editElm = null;
 			let searchBox=list.parents("div#"+$.opts.ids.sidebar.bookmarkBox.search).hasClass($.cl.active);
 			if(typeof searchBox==="undefined"){searchBox=false;}
 			let remote = bookmark && bookmark.remote==1?true:false;

			//顶层文件夹不允许拖拽
			if(!remote && (entry.parent("ul").parent("li").length()!==0 || searchBox)){

				dragElm = $("<span></span>")
				.addClass($.cl.drag.trigger)
				.attr($.attr.title,ext.helper.i18n.get("sidebar_opreate_drag"))
				.appendTo(entryContent);//拖动块

				editElm = $("<span></span>")
				.addClass($.cl.edit)
				.attr($.attr.title,ext.helper.i18n.get("sidebar_opreate_edit"))
				.insertBefore(dragElm);
			}
			
            if (bookmark.id) {
                entryContent.attr($.attr.id, bookmark.id);
                entryContent.attr($.attr.title,label.trim());
            }
            
            const separatorTitle = bookmark.title || "";
            if (!remote && (ext.helper.entry.looksLikeSeparator(bookmark) || ext.helper.entry.isSeparator(bookmark.id))) { // separator
                entryContent.addClass($.cl.sidebar.separator);
                const label = separatorTitle.replace(/(^[-_]+|[-_]+$)/g, "").trim();
                if (label.length > 0) { // named separator (e.g. '---- Social ----')
                    labelElm.attr($.attr.name, label);
                }
                labelElm.text("");
            } else if (bookmark.children) { // dir

                //文件夹样式强制定义
                entryContent.addClass($.cl.sidebar.bookmarkDir);

                if(!!editElm){

                	$("<span></span>")
                	.attr($.attr.title,ext.helper.i18n.get("sidebar_opreate_add"))
                	.addClass($.cl.add)
                	.insertBefore(editElm);//添加书签

                }else{
                	
                	$("<span></span>")
                	.css("right","45px")
                	.addClass($.cl.add)
                	.attr($.attr.title,ext.helper.i18n.get("sidebar_opreate_add"))
                	.appendTo(entryContent);//添加书签
                	
                	if(!opts.freUsed && !searchBox){//刷新书签
                		$("<span></span>")
	                	.attr($.attr.title,ext.helper.i18n.get("sidebar_opreate_refresh"))
	                	.addClass($.cl.refresh)
	                	.appendTo(entryContent);
                	}	
                }

				entryContent.prepend("<span class='" + $.cl.sidebar.dirIcon + "'></span>");
 				entryContent.addClass($.cl.sidebar.dirArrow);
 				
 				//常用文件夹
                if(opts.freUsed&&opts.freUsed===true){
	                entry.addClass($.cl.sidebar.freUsed);//添加
	                entryContent.find("span."+$.cl.add).remove();//取消掉
	                entryContent.find("span."+$.cl.sidebar.dirIcon).addClass($.cl.sidebar.star);
	            }

            } else if (bookmark.url) { // link
               
               entryContent.addClass($.cl.sidebar.bookmarkLink);
               entryContent.attr($.attr.value,bookmark.url);
                
                if(opts.freUsed&&opts.freUsed===true){
                	entryContent.addClass($.cl.sidebar.pinned);
                }
                
                if(remote){
                	
					entryContent.attr($.attr.value,bookmark.url);
					entryContent.attr($.attr.title,label.trim());
					entryContent.attr($.attr.type,remote);
					
					entryContent.children("img").remove();
            		$("<img />")
            		.attr("src",bookmark.icon)
            		.prependTo(entryContent);
				}
                
                if(!remote){

                	addFavicon(entryContent, bookmark.url);//添加favicon,接口限制，必须本地书签才能获得icon
                }
            }
            
            if(searchBox){
				entryContent.find("span."+$.cl.drag.trigger).remove();//取消拖拽
				entryContent.find("span."+$.cl.edit).css("right","20px")
				entryContent.find("span."+$.cl.add).css("right","50px")
			}
            
            return entry;
        };
        
        /**
         * Changes the sort direction and updates the bookmark list
         *
         * @param {string} direction 'ASC' or 'DESC'
         */
        this.updateDirection = (direction) => {
            this.updateSort(sort.name, direction);
        };
        
        /**
         * Changes the sorting and updates the bookmark list
         *
         * @param {string} name
         * @param {string} direction 'ASC' or 'DESC'
         */
        this.updateSort = (name, direction) => {
            
            const sortList = ext.helper.util.getSortList();
            
            if (sortList[name]) {
               
                if (typeof direction === "undefined" || direction===null) {
                    direction = sortList[name].dir;
                }

                sort = {
                    name: name,
                    dir: direction === "ASC" ? "ASC" : "DESC"
                };

                ext.startLoading();

                Promise.all([
                    ext.helper.dao.call("removeCache", {name: "htmlList"}),
                    ext.helper.dao.setData({"u/sort": sort})
                ]).then(() => {
                    ext.helper.dao.call("reload", {scrollTop: true, type: "Sort"});
                });
            }
        };

 		/**
         * Adds the favicon to the given element
         *
         * @param {jsu} elm
         * @param {string} url
         * @returns {Promise}
         */
        const addFavicon = (elm, url) => {
        	
            elm.children("img").remove();
            
            const title=elm.attr($.attr.title);
            const favicon = $("<img />").prependTo(elm);

            return new Promise((resolve) => {
                ext.helper.dao.call("getFavicon",{url: url,icon:{size:32,title:title}}).then((response) => {
                    if (response && response.img) { // favicon found -> add to entry
                        const sidebarOpen = ext.elm.iframe.hasClass($.cl.sidebar.extLoaded);
                        favicon.attr(sidebarOpen ? "src" : $.attr.src, response.img);
                    }
                    resolve();
                });
            });
        };
           

        /**
         * Updates the html for the sidebar header
         */
        this.updateSidebarHeader = () => {
            
            let searchVal = "";
            const searchField = ext.elm.header.find("div." +  $.cl.sidebar.searchBox + " > input[type='text']");
            if (searchField.length() > 0 && searchField[0] && searchField[0].value) { // restore the search value before reinitializing the header content
                searchVal = searchField[0].value;
            }

            ext.elm.header.html("");
            const bookmarkAmount = ext.helper.entry.getAmount("bookmarks");
			
            //添加搜索条
            const searchButtonClass = searchVal ? $.cl.sidebar.searchClear : $.cl.sidebar.searchButton;
            ext.elm.header.searchBox = $("<div></div>")
                .addClass( $.cl.sidebar.searchBox)
                .append("<input type='text' value='" + searchVal.replace(/'/g, "&#x27;") + "' placeholder='" + ext.helper.i18n.get("sidebar_search_placeholder", [bookmarkAmount], false) + "' />")
                .append("<a class='" + searchButtonClass + "'></a>")
                .appendTo(ext.elm.header);

            ext.elm.header.toolBox = $("<div></div>")
                .addClass($.cl.sidebar.toolBox)
                .appendTo(ext.elm.header);
                
	        const headerName=["official","setting","tool","ucenter"];
            headerName.forEach((icon)=>{
            	var title=ext.helper.i18n.get("header_toolbox_" + icon)
            	$("<a></a>")
            	.attr($.attr.title,title)
            	.attr($.attr.name,icon)
            	.append('<img src="'+$.api.runtime.getURL("media/img/icon/header/"+icon+".png")+'" />')
            	.appendTo(ext.elm.header.toolBox);
            });
            
            const input = ext.elm.header.searchBox.find("input[type='text']")[0];
            input.focus();
            const caret = input.value.length;
            input.setSelectionRange(caret, caret);
        };

         /**
         * Decides whether to open or to close the subordinate bookmarks of the given directory,
         * loads the subordinate bookmarks if they are not yet loaded,
         * calls the expandCollapseDir method to perform the toggle operation
         *
         * @param {jsu} elm
         * @param {boolean} instant
         * @param {boolean} cache
         * @returns {Promise}
         */
        this.toggleBookmarkDir = (elm, instant, cache = true) => {
            return new Promise((resolve) => {
                
                //动画
                elm.addClass($.cl.sidebar.dirAnimated);
                
                const dirId = elm.attr($.attr.id);
                let childrenList = elm.next("ul");
                const childrenLoaded = childrenList.length() > 0;

                //正在刷新或者说还没初始化成功
                const initial = ext.refreshRun === true || ext.elm.iframe.hasClass($.cl.sidebar.extLoaded) === false;
                const close = elm.hasClass($.cl.sidebar.dirOpened) && childrenLoaded;
                
                const rememberState = ext.helper.dao.getData("b/rememberState");
                const rememberSubs = ext.helper.dao.getData("b/rememberOpenStatesSubDirectories") === true;
                if (typeof instant === "undefined") {
                    instant = initial || ext.helper.dao.getData("b/animations") === false;
                }

                const preResolve = () => {

                    // 记住子目录展开状态时，打开文件夹后恢复上次展开的子文件夹
                    if (initial === false && close === false && rememberSubs) {
                        this.restoreOpenStates(childrenList);
                    }

					//要开启cache、已经初始化、无搜索结果，则do cache
                    let doCaching = cache && !initial && !ext.helper.search.isResultsVisible();
                    
                    if (rememberState === "nothing") {
                        doCaching = false;
                    } else if (rememberState === "openStatesRoot" && elm.parents("ul:not(." + $.cl.sidebar.hideRoot + ")").length() !== 1) {
                        doCaching = false;
                    }
                    if (doCaching) {
                        this.cacheList().then(resolve);
                    } else {
                        resolve();
                    }

 					resolve();
                };
                
                if (close) { // close children
                    this.expandCollapseDir(elm, childrenList, false, instant).then(preResolve);
                } else { // open children

                    const showOneLevel = (list) => {
                        this.expandCollapseDir(elm, list, true, instant).then(preResolve);
                    };

                    if (!childrenLoaded) { // not yet loaded -> load and expand afterwards
                        ext.helper.dao.call("bookmarks", {id: dirId}).then((response) => {
                            if (response.bookmarks && response.bookmarks[0] && response.bookmarks[0].children) {

                                childrenList = $("<ul></ul>").insertAfter(elm);
                                this.addBookmarkDir(response.bookmarks[0].children, childrenList);
                                showOneLevel(childrenList);
                            }
                        });
                    } else { // already loaded -> just expand
                        showOneLevel(childrenList);
                    }
                }
            });
        };

        
        this.folderIsBare= (elm)=>{
   		
    		//清除历史
      		elm.children("span." + $.cl.sidebar.dirBare).remove();
            const bareNotice = $("<span></span>").addClass($.cl.sidebar.dirBare).html(ext.helper.i18n.get("sidebar_folder_is_bare")).appendTo(elm);

            $.delay(100).then(() => {
                elm.addClass($.cl.sidebar.dirBare);
                return $.delay(1500);
            }).then(() => {
                elm.removeClass($.cl.sidebar.dirBare);
                return $.delay(200);
            }).then(() => {
                bareNotice.remove();
            });
        }
        
         /**
         * Expands/Collapses the bookmarks under the given bookmark node
         *
         * @param {jsu} elm
         * @param {jsu} list
         * @param {boolean} open
         * @param {boolean} instant
         * @returns {Promise}
         */
        this.expandCollapseDir = (elm, list, open, instant) => {
            
            return new Promise((resolve) => {

                const rememberSubs = ext.helper.dao.getData("b/rememberOpenStatesSubDirectories") === true;
                // Close nested folders before reading the height, or the list
                // opens to their full size and then snaps shut.
                if (open && !rememberSubs) {
                    collapseChildDirs(list);
                }

                list.css("height", list[0].scrollHeight + "px");

                if (open === false) { // parameter false -> close list
                    $.delay(50).then(() => {
                        list.css("height", 0);
                    });
                }

                if (ext.refreshRun === true) { //有刷新，恢复打开状态
                    this.restoreOpenStates(list, true);
                } else {
                    
                    //开合状态
                    const openStates = ext.helper.dao.getData("u/openStates");
                    openStates[elm.attr($.attr.id)] = open;

					//配置了记住开合状态，要关一起关
                    if (open === false && ext.helper.dao.getData("b/rememberOpenStatesSubDirectories") === false) {
                        closeAllChildDirs(elm, openStates);
                    } else if (ext.helper.search.isResultsVisible() === false) {//记住打开状态
                        ext.helper.dao.setData({
                            "u/openStates": openStates
                        });
                    }
                }

                $.delay(instant ? 20 : dirOpenDuration).then(() => { // unset changes in css, so opening of children in child list works properly
                    if (open === false) {
                        elm.removeClass($.cl.sidebar.dirOpened);
                    } else {
                    	elm.addClass($.cl.sidebar.dirOpened);
                    }
                    list.css("height", "");
                    elm.removeClass($.cl.sidebar.dirAnimated);

                    resolve();
                });
            });
        };

        /**
         * closes all children of the given bookmark node
         *
         * @param {jsu} elm
         * @param {object} openStates
         */
        const collapseChildDirs = (list) => {
            if (!list || list.length() === 0) {
                return;
            }
            const openStates = ext.helper.dao.getData("u/openStates") || {};
            let changed = false;
            list.find("a." + $.cl.sidebar.bookmarkDir).forEach((node) => {
                const child = $(node);
                child.removeClass($.cl.sidebar.dirOpened);
                const sub = child.next("ul");
                if (sub[0]) {
                    sub[0].style.transition = "none";
                    sub[0].style.height = "0px";
                }
                const id = child.attr($.attr.id);
                if (id && openStates[id]) {
                    openStates[id] = false;
                    changed = true;
                }
            });
            if (changed && ext.helper.search.isResultsVisible() === false) {
                ext.helper.dao.setData({"u/openStates": openStates});
            }
        };

        const closeAllChildDirs = (elm, openStates) => {
            elm.next("ul").find("a." + $.cl.sidebar.bookmarkDir).forEach((node) => {
                openStates[$(node).attr($.attr.id)] = false;
                $.delay(500).then(() => {
                    $(node).removeClass($.cl.sidebar.dirOpened);
                });
            });

            if (ext.helper.search.isResultsVisible() === false) {
                ext.helper.dao.setData({
                    "u/openStates": openStates
                });
            }
        };
        
        /**
         * Restores the open states of the directories in your bookmarks,
         * optionally calls the restoreScrollPos-Method when all open states have been restored
         *
         * @param {jsu} list
         * @param {boolean} initial
         */
        this.restoreOpenStates = (list, initial = false) => {
            
            let restore = false;
            const data = ext.helper.dao.getData(["b/rememberState", "u/openStates"]);

            const checkAllRestored = () => {
                if (!restore && initial && restoreOpenStateRunning === 0) { // all open states restored -> restore scroll position
                    $.delay(100).then(() => {
                        restoreScrollPos();
                    });
                }
            };

            if (data.rememberState === "all" || data.rememberState === "openStatesAndPos" || data.rememberState === "openStates" || data.rememberState === "openStatesRoot") {
                Object.entries(data.openStates).forEach(([node, val]) => {
                    if (val === true) {
                        const entry = list.find("> li > a." + $.cl.sidebar.bookmarkDir + "[" + $.attr.id + "='" + node + "']:not(." + $.cl.sidebar.dirOpened + ")");

                        if (entry.length() > 0) {
                            if (data.rememberState !== "openStatesRoot" || entry.parents("ul").length() === 1 || initial === false) { // if rememberState = openStatesRoot -> initially only open top level directories
                                restore = true;
                                restoreOpenStateRunning++;

                                this.toggleBookmarkDir(entry).then(() => {
                                    restoreOpenStateRunning--;
                                    restore = false;
                                    checkAllRestored();
                                });
                            }
                        }
                    }
                });
            }

            checkAllRestored();
        };
        
        /**
         * Returns the active bookmark box
         *
         * @returns {elm}
         */
        this.getActiveBookmarkBox = () => {
            let bookmarkBox = null;
            Object.values(ext.elm.bookmarkBox).some((box) => {
                if (box.hasClass($.cl.active)) {
                    bookmarkBox = box;
                    return true;
                }
            });
            return bookmarkBox;
        };
        
         /**
         * Restores the scroll position and finishes loading
         */
        const restoreScrollPos = () => {
            
            ext.helper.scroll.restoreScrollPos(ext.elm.bookmarkBox.all).then(() => {
                
                //图像重新处理
                ext.initImages();
                
                ext.endLoading(500);//结束loading
                
                ext.refreshRun = false;

				//缓存数据，条件是按照树结构预览并且在没有缓存的情况下
                if (!ext.elm.bookmarkBox.all.hasClass($.cl.sidebar.cached)) {
                    this.cacheList();
                }

                ext.loaded();//书签加载完毕
            });
        };
        
        /**
         * Caches the sidebar html
         *
         * @returns {Promise}
         */
        this.cacheList = () => {
            
            ext.log("Cache ul html data.");
            return Promise.all([
                ext.helper.dao.call("setCache", {
                    name: "htmlList",
                    val: ext.elm.bookmarkBox.all.children("ul").html()
                })
            ]);
        };
    }
    
})(jsu);