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

                    showClearButton(val && val.length > 0);

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
           	
                ext.elm.bookmarkBox.all.removeClass($.cl.active).removeClass($.cl.scrollBox.scrolled);
                ext.elm.bookmarkBox.search.addClass($.cl.active);
                ext.helper.scroll.focus();

                this.searchVal = val;

                if (val !== searchField.data("lastVal")) { // search value is not the same
                    
                    ext.startLoading();
                    searchField.data("lastVal", val);
                    
                    ext.helper.entry.initOnce().then(() => {
                        ext.helper.scroll.setScrollPos(ext.elm.bookmarkBox.search, 0);
                        return getLocalSearchResults(val);
                    }).then((result) => {
                    	
                        ext.elm.bookmarkBox.search.children("p").remove();

                        let hasResults = false;
                        const list = ext.elm.bookmarkBox.search.children("ul");
                        list.html("");

                        if (result && result.length > 0) { // results for your search value
                        	hasResults = ext.helper.list.addBookmarkDir(result, list, false);
                        }

                        if (hasResults === false) { // no results
                            $("<p></p>").addClass($.cl.sidebar.searchResultBare).attr($.attr.title,ext.helper.i18n.get("sidebar_search_no_results")).appendTo(ext.elm.bookmarkBox.search);
                        }

                        ext.endLoading(100);
                        resolve();
                    });
                } else {
                    resolve();
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
        
        /**
         * Shows the clear mark while the field has text, and the search mark when it does not
         *
         * @param {boolean} visible
         */
        const showClearButton = (visible) => {
            const button = ext.elm.header.searchBox && ext.elm.header.searchBox.children("a");
            if (!button || button.length() === 0) {
                return;
            }
            if (visible) {
                button.removeClass($.cl.sidebar.searchButton).addClass($.cl.sidebar.searchClear);
            } else {
                button.removeClass($.cl.sidebar.searchClear).addClass($.cl.sidebar.searchButton);
            }
        };

        /**
         * Resets the search results and shows the normal bookmark list again
         *
         * @param {jsu} searchField
         * @returns {Promise}
         */
        const reset = (searchField) => {
            return new Promise((resolve) => {
            	
                showClearButton(false);

                searchField.removeData("lastVal");
                
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
            
            ext.elm.header.on("keyup", "div." + $.cl.sidebar.searchBox + " > input[type='text']", (e) => {
                e.preventDefault();
                const typed = e.currentTarget && e.currentTarget.value ? e.currentTarget.value : "";
                showClearButton(typed.length > 0);
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