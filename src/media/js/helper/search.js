($ => {
    "use strict";

    /**
     * @param {object} ext
     * @constructor
     */
    $.SearchHelper = function (ext) {

        let searchTimeout = null;
        this.searchVal = "";

        /**
         * Initializes the helper
         */
        this.init = async () => {

            initEvents();
        };

        /**
         * Returns whether the search results are currently displayed or not
         *
         * @returns {bool}
         */
        this.isResultsVisible = () => {
            return ext.elm.bookmarkBox.search.hasClass($.cl.active);
        };

        /**
         * Clears the search field and shows the normal bookmark list again
         *
         * @returns {Promise}
         */
        this.clearSearch = () => {
            return new Promise((resolve) => {
                this.update("").then(resolve);
            });
        };
        
        this.refreshSearch = () =>{
        	
        	const searchField = ext.elm.header.find("div." + $.cl.sidebar.searchBox + " > input[type='text']");
        	reset(searchField)
        	.then(()=>{
        		this.update();
        	});
        }

        /**
         * Handles the view of the search result list
         *
         * @param {string} val
         * @returns {Promise}
         */
        this.update = (val = null) => {
            return new Promise((resolve) => {
                
                const searchField = ext.elm.header.find("div." + $.cl.sidebar.searchBox + " > input[type='text']");

                if (searchField && searchField.length() > 0) { // search field may be missing when the sidebar is in selection mode
                    if (val === null) {
                        val = searchField[0].value;
                    } else {
                        searchField[0].value = val;
                    }

                    if (val && val.length > 0) { // search field is not empty
                        handleSearch(searchField, val).then(resolve);
                    } else { // empty search field -> reset list
                        reset(searchField).then(resolve);
                    }
                } else {
                    resolve();
                }
            });
        };

        /**
         * Updates the search results if search value is not the same as currently visible
         *
         * @param {jsu} searchField
         * @param {string} val
         * @returns {Promise}
         */
        const handleSearch = (searchField, val) => {
           
           return new Promise((resolve) => {
           	
                //展示删除按钮
        	    ext.elm.header.searchBox
        			.find("a." + $.cl.sidebar.searchButton +"")
        			.removeClass($.cl.sidebar.searchButton)
        			.addClass($.cl.sidebar.searchClear);
                
                ext.elm.bookmarkBox.all.removeClass($.cl.active).removeClass($.cl.scrollBox.scrolled);
                ext.elm.bookmarkBox.search.addClass($.cl.active);
                ext.helper.scroll.focus();

                this.searchVal = val;
                
                //which=0 本地、which=1 远程 
                let which=ext.elm.header.searchBox.find("select." + $.cl.header.choose+" > option[value='0']").attr("selected")?0:1;
                
                //换了搜索源且搜索词不空，或者变动了搜索词
                if (val !== searchField.data("lastVal") || (which !== searchField.data("lastWhich") && !!val)) { // search value is not the same
                    
                    ext.startLoading();
                    searchField.data("lastVal", val);
                    searchField.data("lastWhich",which);
                    
                    ext.helper.entry.initOnce().then(() => {
                        ext.helper.scroll.setScrollPos(ext.elm.bookmarkBox.search, 0);
                        return which==0? getLocalSearchResults(val): getRemoteSearchResults(val);
                    }).then((result) => {
                    	
                        ext.elm.bookmarkBox.search.children("p").remove();

                        let hasResults = false;
                        const list = ext.elm.bookmarkBox.search.children("ul");
                        list.html("");

                        if (result.length > 0) { // results for your search value
                        	if(which==0){
                        		hasResults = ext.helper.list.addBookmarkDir(result, list, false);//处理本地
                        	}
                        	else{
                        		hasResults = ext.helper.list.addBookmarkRemote(result, list);//处理远程
                        	}
                        }

                        if (hasResults === false) { // no results
                            $("<p></p>").addClass($.cl.sidebar.searchResultBare).attr($.attr.title,ext.helper.i18n.get("sidebar_search_no_results")).appendTo(ext.elm.bookmarkBox.search);
                        }

                        ext.endLoading(100);
                        resolve();
                    });
                }
            });
        };

        /**
         * Returns all elements matching the given search value,
         * includes bookmarks, directories and elements with matching additional information
         *
         * @param {string} val
         * @returns {Promise}
         */
        const getLocalSearchResults = (val) => {
            return new Promise((resolve) => {
                const valLC = val.toLowerCase();
                const idList = [];

                ext.helper.dao.call("searchBookmarks", {searchVal: val}).then((response) => {
                    
                    //match 书签
                    const result = response.bookmarks || [];
                    result.forEach((entry) => {
                        idList.push(entry.id);
                    });

					//match 文件夹
                    const directories = ext.helper.entry.getAllDataByType("directories");
                    directories.forEach((directory, idx) => {
                        if (directory.title.toLowerCase().indexOf(valLC) > -1) {
                            directory.index = -1000 + idx;
                            result.push(directory);
                            idList.push(directory.id);
                        }
                    });

                    resolve(result);
                });
            });
        };
        
        const getRemoteSearchResults = (val) => {

           return new Promise((resolve) => {
           	
                ext.helper.dao.call("searchBookmarkServer", {q : val}).then((res) => {
                    
                    let results=[];

                    if(res.codeMsg !== "undefined" && res.codeMsg ==="networkFail"){
						ext.helper.util.createToast(ext.helper.i18n.get("network_error"));
					}else{
						results=res.list;
					}
                    resolve(results);
                });
            });
        };

        /**
         * Resets the search results and shows the normal bookmark list again
         *
         * @param {jsu} searchField
         * @returns {Promise}
         */
        const reset = (searchField) => {
            return new Promise((resolve) => {
            	
		        //展示搜索按钮
	        	ext.elm.header.searchBox
	        		.find("a." + $.cl.sidebar.searchClear +"")
	        		.removeClass($.cl.sidebar.searchClear)
	        		.addClass($.cl.sidebar.searchButton);

                searchField.removeData("lastVal");
                searchField.removeData("lastWhich");
                
                this.searchVal = "";

                if (this.isResultsVisible()) {
                    ext.startLoading();
                    ext.elm.bookmarkBox.all.addClass($.cl.active);
                    ext.elm.bookmarkBox.search.removeClass([$.cl.active, $.cl.scrollBox.scrolled]);
                    ext.elm.bookmarkBox.search.removeAttr($.attr.direction);
                    ext.helper.scroll.restoreScrollPos(ext.elm.bookmarkBox.all);
                    ext.helper.scroll.focus();
                    ext.endLoading();
                }
                
                resolve();
            });
        };


        /**
         * Initializes the events for the search field
         */
        const initEvents = () => {


 			ext.elm.header.on("click", "a." + $.cl.sidebar.searchClear, (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.clearSearch();
            });
            
            //change 事件
            ext.elm.header.on("change","div." + $.cl.sidebar.searchBox + " > select." + $.cl.header.choose,(e)=>{
            	
            	//which=0 本地、which=1 远程 
                const which=ext.elm.header.searchBox.find("select." + $.cl.header.choose+" > option[value='0']").attr("selected")?0:1;
            	const searchField = ext.elm.header.find("div." + $.cl.sidebar.searchBox + " > input[type='text']");

            	if(which==1){
            		searchField.attr("placeholder",ext.helper.i18n.get("header_search_box_remote_search"));//set new
            	}
            	
            	if(which==0){
            		const bookmarkAmount = ext.helper.entry.getAmount("bookmarks");
            		searchField.attr("placeholder",ext.helper.i18n.get("sidebar_search_placeholder", [bookmarkAmount], false));//set old
            	}

            	this.update();
            });

            ext.elm.header.on("keyup", "div." + $.cl.sidebar.searchBox + " > input[type='text']", (e) => {
                e.preventDefault();
                if (searchTimeout) {
                    clearTimeout(searchTimeout);
                    searchTimeout = null;
                }

                searchTimeout = setTimeout(() => {
                    this.update();
                }, 100);
            }).on("keydown", "div." + $.cl.sidebar.searchBox + " > input[type='text']", (e) => { // if there is only one search result, 'enter' will perform a click on this entry
                if (e.key && e.key.toUpperCase() === "ENTER") {
                    const searchResults = ext.elm.bookmarkBox.search.find("> ul > li");//只要一个结果，当click处理

                    if (searchResults.length() === 1) {
                        ext.helper.helperEvents.handleEntryClick(searchResults.eq(0).children("a"), {
                            ctrlKey: (e.ctrlKey || e.metaKey)
                        });
                    }
                }
            });
        };
    };

})(jsu);