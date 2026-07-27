($ => {
    "use strict";

    $.SearchHelper = function (n) {

        let suggestionCache = {};
        let searchEngine = {};
        let searchEngineList = {};
        let searchAlreadyFocussed = false;

        const searchSuggestion = {
            queries: true,
            bookmarks: true,
            history: true
        };

        /**
         * Resolve conf lang overrides the same way as before:
         * exact match → short code → mx/cl→es (no silent en overwrite)
         */
        const resolveLangOverride = (langMap, lang) => {
            if (!langMap || !lang) {
                return null;
            }
            if (langMap[lang]) {
                return langMap[lang];
            }
            if (lang.indexOf("_") > -1) {
                const short = lang.replace(/_.*$/, "");
                if (langMap[short]) {
                    return langMap[short];
                }
            }
            if ((lang === "mx" || lang === "cl") && langMap.es) {
                return langMap.es;
            }
            return null;
        };

        /**
         * Map legacy / removed engine ids onto the current conf list
         *
         * @param {string} name
         * @returns {string}
         */
        const resolveEngineName = (name) => {
            if (!name) {
                return "google";
            }
            if (name === "bookmarkearth") {
                name = "bookmarkmars";
            }
            // Engines removed in the international conf still stored in user settings
            if (!searchEngineList[name]) {
                if (name === "bookmarkmars" || name === "zhihu" || name === "bilibili" || name === "toutiao") {
                    name = searchEngineList.google ? "google" : name;
                }
            }
            if (!searchEngineList[name]) {
                if (searchEngineList.google) {
                    return "google";
                }
                const fallback = Object.keys(searchEngineList).find((key) => key !== "custom");
                return fallback || "custom";
            }
            return name;
        };

        /**
         *
         * @returns {Promise}
         */
        this.init = async () => {
            
            initSearchEngineList().then(()=>{
            	 
            	initEvents();

	            this.updateSearchEngine(n.helper.dao.getData("n/searchEngine"), n.helper.dao.getData("n/searchEngineCustom"));
	            
	            this.setVisibility(n.helper.dao.getData("n/searchField"));
	
	            this.setSearchSuggestion("queries", n.helper.dao.getData("n/searchSuggestQueries"));
	            this.setSearchSuggestion("bookmarks", n.helper.dao.getData("n/searchSuggestBookmarks"));
	            this.setSearchSuggestion("history", n.helper.dao.getData("n/searchSuggestHistory"));
            })

        };

        /**
         *
         * @param type
         * @param val
         */
        this.setSearchSuggestion = (type, val) => {
            searchSuggestion[type] = val;
            suggestionCache = {};
        };

        /**
         *
         * @param visibility
         */
        this.setVisibility = (visibility) => {
            if (visibility === "hide") {
                n.elm.search.wrapper.addClass($.cl.hidden);
            } else {
                n.elm.search.wrapper.removeClass($.cl.hidden);
            }
        };

        /**
         * Updates the currently used search engine
         *
         * @param {string} name
         * @param {object} opts
         */
        this.updateSearchEngine = (name, opts = {}) => {
            name = resolveEngineName(name);
            if (searchEngineList[name]) {
            	
            	const entry=searchEngineList[name];
                
                searchEngine = {
                    name: name,
                    title: opts.title || entry.name,
                    homepage: opts.homepage || entry.url,
                    queryUrl: opts.queryUrl || entry.queryUrl
                };

                const label = searchEngine.name === "custom" && searchEngine.title ? searchEngine.title : searchEngineList[name].label;
                n.elm.search.field.attr("placeholder", n.helper.i18n.get("new_tab_search_placeholder", [label]));
                
                const favicon=$("<img />")
                .attr({
                	"src":!!entry.favicon?entry.favicon:$.api.runtime.getURL("media/img/icon/newtab/icon-custom.png"),
                	[$.attr.href]:entry.queryUrl,
                	"title":entry.name
                });

				//先踢出再添加
				n.elm.search.engine.find("img").remove();
				n.elm.search.engine.find("span.angle").remove();
				
            	n.elm.search.engine
            	.append(favicon)
            	.append($("<span></span>").addClass("angle"));
            }
        };

        /**
         * Focus the search field of the website, or the search of the sidebar
         */
        this.focusSearch = () => {
            
            if (n.elm.search.wrapper.hasClass($.cl.hidden) === false) { // Search field is visible
                if (searchAlreadyFocussed === false) { // first time the search field get's focussed -> prefill with already typed keyboard inputs
                    searchAlreadyFocussed = true;
                    n.elm.search.field[0].value = (window.cachedKeys || []).join("");
                }

                n.elm.search.field[0].focus();
            }
        };

        /**
         *
         * @returns {string}
         */
        this.getCurrentSearchEngine = () => searchEngine;

        /**
         *
         * @returns {object}
         */
        this.getSearchEngineList = () => searchEngineList;
        
        
        const pullSearchEngine = ()=>{
        	
        	return new Promise((resolve) => {
				
				n.helper.dao.call("getValue",{key:"search_engine"})
				.then((res)=>{
					if(res){
						resolve(JSON.parse(res.data));
					}else{
						$.fetch($.api.runtime.getURL("media/conf/search_engine.json")).then((obj) => {
			                obj.text().then((data)=>{
			                	resolve(JSON.parse(data));
			                });
			           	})
					}
				});
			});
        }

        /**
         * Initialises the list of search engines depending on the language of the user
         */
        const initSearchEngineList = () => {
            
            return new Promise((resolve) => {
            	
            	pullSearchEngine().
            	then(searchEngineInfo=>{
            		

					const lang = n.helper.i18n.getLanguage();
	                const list = [];
	                
					Object.entries(searchEngineInfo).forEach(([alias, obj]) => {
						
		                if (alias === "custom") {
		                    const customData = n.helper.dao.getData("n/searchEngineCustom");
		                    obj.name = n.helper.i18n.get("new_tab_search_engine_custom");
		                    obj.label = customData.title;
		                    obj.url = customData.homepage;
		                    obj.queryUrl = customData.queryUrl;
		                }
		
		                const entry = {
		                    alias: alias,
		                    name: obj.name,
		                    label: obj.label || obj.name,
		                    favicon: n.helper.util.normalizeRemoteIconUrl(obj.favicon || null),
		                    url: obj.url,
		                    queryUrl: obj.queryUrl,
		                    sorting: obj.sorting
		                };

		                const langOverride = resolveLangOverride(obj.lang, lang);
		                if (langOverride) {
		                    Object.entries(langOverride).forEach(([field, val]) => {
		                        entry[field] = val;
		                    });
		                }
		                
		                if (entry.name) {
		                    list.push(entry);
		                }
		            });
		            
		            list.sort((a, b) => {
		                return (a.sorting || 9999) - (b.sorting || 9999);
		            });
				
		            searchEngineList = {};
		            list.forEach((entry) => {
		                
		                searchEngineList[entry.alias] = entry;
		            });
		            
				}).then(resolve);
			});
        };

        /**
         * 选择搜索词
         *
         * @param {string} dir "next" or "prev"
         */
        const selectSuggestion = (dir) => {
            const activeSuggestion = $("ul." + $.cl.newtab.suggestions + " > li." + $.cl.active);
            let idx = dir === "next" ? 0 : -1;

            if (activeSuggestion.length() > 0) {
                idx = activeSuggestion.prevAll("li").length() + (dir === "next" ? 1 : -1);
                activeSuggestion.removeClass($.cl.active);
            }

            let fromSuggestion = false;

            if (idx >= 0) {
                const suggestion = $("ul." + $.cl.newtab.suggestions + " > li").eq(idx);

                if (suggestion.length() > 0) { // show the suggestion value in the search field
                    fromSuggestion = true;
                    suggestion.addClass($.cl.active);
                    n.elm.search.field[0].value = (suggestion.attr($.attr.src) || suggestion.text()).trim();
                }
            }

            if (fromSuggestion === false) { // no suggestion matches -> show the typed input
                n.elm.search.field[0].value = n.elm.search.field.data("typedVal") || "";
            }
        };

        /**
         * Checks if the given value is an url or not,
         * if it is an url the current tab url will be changed to this,
         * if not the value will be searched with a search engine
         *
         * @param {string} val
         * @param {object} opts
         */
        const handleSearch = (val, opts = {}) => {
            
            if (!val || val.trim().length === 0) {
                return;
            }

            const openLink = (url) => {
                n.helper.dao.call("openLink", {
                    href: url,
                    newTab: opts.newtab || false,
                    position: n.helper.dao.getData("b/newTabPosition"),
                    active: !opts.newtab
                });
            };

            if (val.search(/https?\:\/\//) === 0 || val.search(/s?ftps?\:\/\//) === 0 || val.search(/chrome\:\/\//) === 0) {
                openLink(val);
            } else if (searchEngineList[searchEngine.name]) {
                let url = "";

                if (searchEngine.name === "custom" && searchEngine.queryUrl) {
                    url = searchEngine.queryUrl;
                } else if (searchEngineList[searchEngine.name].queryUrl) {
                    url = searchEngineList[searchEngine.name].queryUrl;
                }

                if (url) {
                    if (url.includes("{1}") === false) { // query url is missing the {1} placeholder -> paste it at the end
                        url += "{1}";
                    }
                    openLink(url.replace("{1}", encodeURIComponent(val)));
                }
            }
        };

        /**
         * Returns suggestions (words, urls, bookmarks) for the given input using the google search api and the according Chrome API for bookmark search
         *
         * @param {string} val
         * @returns {Promise}
         */
        const getSearchSuggestions = (val) => {

            return new Promise((resolve) => {
            	
                if (!val) { // empty input -> no suggestions
                    resolve([]);
                } else if (suggestionCache[val]) { // suggestions for the input already fetched -> return from cached object
                    resolve(suggestionCache[val]);
                } else { // determine suggestions via xhr on the google search api

                    const encodedVal = encodeURIComponent(val);
                    const finishObj = (obj = []) => {
                        suggestionCache[val] = obj;
                        resolve(obj);
                    };

                    const promises = new Array(3).fill({});
                    
                    if (searchSuggestion.queries) {
                        promises[0] = n.helper.dao.call("getKeyword", {q: val});
                    }

                    if (searchSuggestion.bookmarks && val.length >= 1) {
                        promises[1] = n.helper.dao.call("searchBookmarks", {searchVal: val});
                    }

                    if (searchSuggestion.history && val.length >= 1 && $.api.history) {
                        promises[2] = n.helper.dao.call("searchHistory", {searchVal: val});
                    }

                    Promise.all(promises).then(([remoteResults, searchResults, historyResults]) => {
                        
                        const urls = [];
                        const words = [];
                        
                        let historyBookmarkMaxSuggestions = 2;
                        if (!searchSuggestion.queries) {
                            historyBookmarkMaxSuggestions++;
                        }
                        if (!searchSuggestion.bookmarks || !searchSuggestion.history) {
                            historyBookmarkMaxSuggestions++;
                        }

                        try {
                            if (searchResults && searchResults.bookmarks && searchResults.bookmarks.length > 0) { // add bookmarks to the suggestions
                                let i = 0;
                                searchResults.bookmarks.some((bookmark) => {
                                    if (bookmark.url) {
                                        urls.push({type: "bookmark", label: bookmark.title, url: bookmark.url});
                                        i++;
                                        if (i >= historyBookmarkMaxSuggestions) {
                                            return true;
                                        }
                                    }
                                });
                            }
                        } catch (e) {
                            //
                        }

                        try {
                            if (historyResults && historyResults.history && historyResults.history.length > 0) { // add history to the suggestions
                                let i = 0;
                                historyResults.history.some((history) => {
                                    if (history.url) {
                                        urls.push({type: "history", label: history.title, url: history.url});
                                        i++;
                                        if (i >= historyBookmarkMaxSuggestions) {
                                            return true;
                                        }
                                    }
                                });
                            }
                        } catch (e) {
                            //
                        }

                        try {
                            if (remoteResults && remoteResults.length > 1) { // there are suggestions of the google search api
                                
                                remoteResults.forEach((item) => {
                                	words.push({
                                        type: "word",
                                        label: item.text,
                                        url:item.url,
                                        picUrl:item.picUrl,
                                        categoryId:item.categoryId
                                    });
                                });
                            }
                            
                        } catch (e) {
                            //
                        }

                        finishObj([...urls, ...words]); // display urls first and then the words
                    }, () => {
                        finishObj();
                    });
                }
            });
        };

        /**
         * Initialises the eventhandler
         */
        const initEvents = () => {
           
			//提交搜索
            n.elm.search.wrapper.on("submit", (e) => {
                e.preventDefault();
                const val = n.elm.search.field[0].value.trim();

                if (val && val.trim().length > 0) {//直接搜
                    handleSearch(val);
                } else if (searchEngineList[searchEngine.name]) {//跳转首页,搜索内容为空
                    let url = "";

                    if (searchEngine.name === "custom" && searchEngine.homepage) {
                        url = searchEngine.homepage;
                    } else if (searchEngineList[searchEngine.name].url) {
                        url = searchEngineList[searchEngine.name].url;
                    }

                    if (url) {
                        n.helper.dao.call("openLink", {
                            href: url,
                            newTab: false
                        });
                    }
                }
            });

			//搜素提示
            n.elm.search.field.on("keyup click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                const keyCode = event.which || event.keyCode;

                if (keyCode === 40) {
                    selectSuggestion("next");
                } else if (keyCode === 38) {
                    selectSuggestion("prev");
                } else if (keyCode !== 13) {
                    const val = e.currentTarget.value.trim();
                    n.elm.search.field.data("typedVal", val);

                    getSearchSuggestions(val).then((suggestions) => {
                        if (n.elm.search.field.data("typedVal") !== val) { // the search string changed in the meantime (e.g. when the user types fast) -> suggestions are outdated, so not display them
                            return;
                        }

                        $("ul." + $.cl.newtab.suggestions).remove();

                        if (suggestions.length === 0) { // no suggestions -> don't display any box below the search field
                            return;
                        }

                        const list = $("<ul></ul>").addClass($.cl.newtab.suggestions).insertAfter(n.elm.search.field);

                        suggestions.some((suggestion, i) => {
                            const elm = $("<li></li>")
                                .attr($.attr.type, suggestion.type)
                                .text(suggestion.label)
                                .appendTo(list);

                            if (suggestion.url) {
                                elm.attr({
                                    "title": suggestion.url,
                                    [$.attr.src]: suggestion.url
                                }).append("<span>" + suggestion.url + "</span>");
                            }
                            
                            if (suggestion.picUrl) {
                            	elm.prepend(
                            		$("<div></div>")
                            		.addClass($.cl.newtab.thumbnail)
                            		.css("background-image","url("+suggestion.picUrl+")")
                            	)
                            }

                            if (i > 5) {
                                return true;
                            }
                        });

                        list.css({
                            top: "",
                            left: ""
                        });
                    });
                }
            });

            $(document).on("mousemove", "ul." + $.cl.newtab.suggestions + " > li", (e) => {
                $("ul." + $.cl.newtab.suggestions + " > li").removeClass($.cl.active);
                $(e.currentTarget).addClass($.cl.active);
            }).on("click auxclick", "ul." + $.cl.newtab.suggestions + " > li", (e) => {
                e.preventDefault();
                e.stopPropagation();
                const suggestion = ($(e.currentTarget).attr($.attr.src) || $(e.currentTarget).text()).trim();
                handleSearch(suggestion, {newtab: e.type === "auxclick"});
            });

			//取消提示搜索
            $(document).on("click", () => {
                $("ul." + $.cl.newtab.suggestions).remove();
            });

            $(window).on("resize", () => {
                $("ul." + $.cl.newtab.suggestions).remove();
            }, {passive: true});
        };
    };

})(jsu);