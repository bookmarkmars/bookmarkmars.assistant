($ => {
    "use strict";

    /**
     * @param {object} n
     * @constructor
     */
    $.PopupHelper = function (n) {

        let elements = {};

        /**
         * Creates a new overlay for the given type
         *
         * @param {string} type
         * @param {string} title
         */
        this.create = (type, title) => {
            elements = n.helper.template.overlay(type, title);
            elements.buttonWrapper.children("a." + $.cl.close).text(n.helper.i18n.get("overlay_close"));

            switch (type) {
 
 
                case "searchEngine": {
                    handleSearchEngineHtml();
                    break;
                }
                
                case "link": {
                    handleGridHtml();
                    break;
                }
            }

            initEvents();
        };

        /**
         * Performs the action of the current overlay
         */
        const performAction = () => {
            switch (elements.modal.attr($.attr.type)) {
                
                case "searchEngine": {
                    updateSearchEngine();
                    break;
                }
                
                case "link":{
                	updateLinks();
                    break;
                }
            }
        };
        
        /**
         * Initialises the drag&drop functionality for the given link list
         *
         * @param wrapper
         * @param linkSelector
         */
        const initDraggableLinks = (wrapper, linkSelector) => {
            
            let draggedElm = null;

            wrapper.find(linkSelector).attr("draggable", "draggable");
            wrapper.off("dragstart").on("dragstart", linkSelector, (e) => {

                draggedElm = e.currentTarget;
            });

            wrapper.off("dragenter").on("dragenter", linkSelector, (e) => {
                $(e.currentTarget).addClass($.cl.drag.dragHover);
            });

            wrapper.off("dragover").on("dragover", linkSelector, (e) => { // allow dropping
                e.preventDefault();
            });

            wrapper.off("dragleave").on("dragleave", linkSelector, (e) => {
                $(e.currentTarget).removeClass($.cl.drag.dragHover);
            });

            wrapper.off("dragend").on("dragend", linkSelector, () => {
                wrapper.find(linkSelector).removeClass($.cl.drag.dragHover);
                $.delay().then(() => {
                    draggedElm = null;
                });
            });

            wrapper.off("drop").on("drop", linkSelector, (e) => {
                
                e.preventDefault();
                wrapper.find(linkSelector).removeClass($.cl.drag.dragHover);

                if (draggedElm === e.currentTarget || $(draggedElm).hasClass($.cl.lock) || $(e.currentTarget).hasClass($.cl.lock)) {
                    return;
                }

                const afterNode2 = e.currentTarget.nextElementSibling;
                const parent = e.currentTarget.parentNode;

                if (draggedElm === afterNode2) {
                    parent.insertBefore(draggedElm, e.currentTarget);
                } else {
                    draggedElm.replaceWith(e.currentTarget);
                    parent.insertBefore(draggedElm, afterNode2);
                }
            });
        };

        /**
         * Closes the overlay
         */
        const closeOverlay = () => {
            n.helper.util.triggerEvent("overlayClosed");
            elements.overlay.removeClass($.cl.page.visible);

            $.delay(100).then(() => {
                elements.overlay.remove();
            });
        };


        /**
         * 搜索引擎处理
         */
        const handleSearchEngineHtml = () => {
            
            const scrollBox = $("<div></div>").addClass($.cl.scrollBox.wrapper).appendTo(elements.modal);

			//搜索提示
            const searchSuggestionWrapper = $("<div></div>").attr($.attr.name, "searchSuggest").appendTo(scrollBox);

            ["queries", "bookmarks", "history"].forEach((name) => {
                const fieldName = "searchSuggest" + n.helper.util.capitalizeFirstLetter(name);
                const checkbox = n.helper.checkbox.get(elements.overlay.find("body"), {
                    [$.attr.name]: fieldName
                }, "checkbox").appendTo(searchSuggestionWrapper);

                $("<span></span>").html(n.helper.i18n.get("new_tab_search_suggest_" + name)).insertAfter(checkbox);

                if (n.helper.dao.getData("n/" + fieldName)) {
                    checkbox.trigger("click");
                }

                checkbox.children("input[type='checkbox']").on("change", (e) => {

                    n.helper.search.setSearchSuggestion(name, e.currentTarget.checked);
                });
            });

            const list = $("<ul></ul>").addClass($.cl.result).appendTo(scrollBox);
            const searchEngines = n.helper.search.getSearchEngineList();
            const currentSearchEngine = n.helper.search.getCurrentSearchEngine();

            Object.entries(searchEngines).forEach(([value, info]) => {
                const entry = $("<li></li>")
                    .append(n.helper.checkbox.get(elements.overlay.find("body"), {
                        [$.attr.name]: "searchEngine",
                        [$.attr.value]: value
                    }, "radio"))
                    .append("<a>" + info.name + "</a>")
                    .appendTo(list);

                if (info.favicon) {
                    $("<img />").attr("src", info.favicon).prependTo(entry.children("a"));
                }

                if (currentSearchEngine.name === value) {
                    entry.find("input[" + $.attr.name + "='searchEngine'][" + $.attr.value + "='" + value + "']").parent("div." + $.cl.checkbox.box).trigger("click");
                }
            });

            const customWrapper = $("<ul></ul>").attr($.attr.type, "custom").appendTo(scrollBox);

            if (currentSearchEngine.name === "custom") {
                customWrapper.addClass($.cl.visible);
            }

            $("<li></li>")
                .append("<label>" + n.helper.i18n.get("new_tab_search_engine_custom_title") + "</label>")
                .append("<input type='text' name='title' value='" + currentSearchEngine.title.replace(/'/g, "&#x27;") + "' />")
                .appendTo(customWrapper);
            $("<li></li>")
                .append("<label>" + n.helper.i18n.get("new_tab_search_engine_custom_url_homepage") + "</label>")
                .append("<input type='text' name='homepage' value='" + currentSearchEngine.homepage.replace(/'/g, "&#x27;") + "' placeholder='https://example.com' />")
                .appendTo(customWrapper);
            $("<li></li>")
                .append("<label>" + n.helper.i18n.get("new_tab_search_engine_custom_url_results") + "</label>")
                .append("<input type='text' name='queryUrl' value='" + currentSearchEngine.queryUrl.replace(/'/g, "&#x27;") + "' placeholder='https://example.com/?q={1}' />")
                .appendTo(customWrapper);

            $("<a></a>").addClass($.cl.confirm.action).text(n.helper.i18n.get("overlay_save")).appendTo(elements.buttonWrapper);
        };
        
        const addEntry = (item,list)=>{
        	 
        	const entry = $("<li></li>")
                .append(n.helper.checkbox.get(elements.overlay.find("body"), {
                    [$.attr.title]:item.title,
                    [$.attr.href]: item.url,
                    checked: item.selected?"checked":false
                }, "checkbox"))
                .append("<a>" + item.title + "</a>")
                .appendTo(list);
            
            //指明来源
            entry.attr($.attr.origin,item.origin);
            
            //部分内容锁死
            if(item.fixed){
            	
            	const lock=$("<img />")
            	.attr("src", $.api.runtime.getURL("media/img/icon/newtab/icon-lock.png"));
            	
            	entry.find("div[data-type='checkbox']").remove();
            	
            	entry
            	.attr({
            		[$.attr.title]:item.title,
                    [$.attr.href]: item.url,
            	})
            	.addClass($.cl.lock)
            	.prepend(
            		$("<div></div>")
            		.append(lock)
            	);
            }
            
            //===0 或者 兼容过往用户添加的，没有origin的快捷方式
            if(item.origin===0 || !item.hasOwnProperty('origin')){
            	
            	const rm=$("<img />")
            	.attr("src", $.api.runtime.getURL("media/img/icon/newtab/icon-remove.png"))
            	
            	entry
            	.addClass($.cl.remove)
            	.append($("<span></span>")
            	.append(rm));
            	
            }
            
            if(item.icon && item.icon!="undefined" && (item.icon.startsWith("http") || item.icon.startsWith("data:image"))){
            	const favicon = $("<img />")
            		.attr("src", n.helper.util.normalizeRemoteIconUrl(item.icon));
                favicon.prependTo(entry.children("a"));
                favicon[0].onerror = () => {
                	// Broken http icon → first character of title
                	n.helper.dao.call("getFavicon", {
                		url: item.url,
                		icon: {size: 32, title: item.title || item.url},
                		query: true
                	}).then((response) => {
                		if (response && response.img) {
                			favicon.attr("src", response.img);
                			favicon[0].onerror = null;
                		}
                	});
                };
            }else{
            	n.helper.dao.call("getFavicon", {
            		url: item.url,
            		icon: {size: 32, title: item.title || item.url},
            		query: true
            	}).then((response) => {
	                if (response && response.img) {
	                    const favicon = $("<img />")
	                    	.attr("src", response.img);
	                    favicon.prependTo(entry.children("a"));
	                }
	            });
            }
        }
        
        
        /**
         * 快捷方式处理
         */
        const handleGridHtml = () => {
            
            const scrollBox = $("<div></div>").addClass($.cl.scrollBox.wrapper).appendTo(elements.modal);
            const disclaimer = $("<div></div>").addClass($.cl.newtab.disclaimer).text(n.helper.i18n.get("overlay_confirm_disclaimer")).appendTo(elements.modal);
            
            $("<span></span>")
            .addClass($.cl.newtab.suggestions)
            .text(n.helper.i18n.get("new_tab_drag_suggestions"))
            .appendTo(scrollBox);
            const list = $("<ul></ul>").addClass($.cl.result).appendTo(scrollBox);
            
            const currentSearchEngine = n.helper.search.getCurrentSearchEngine();
            
            //自定义添加
            
            $("<span></span>")
            .addClass($.cl.add)
            .text(n.helper.i18n.get("new_tab_add_new_navigation"))
            .prepend($("<img />").attr("src",$.api.runtime.getURL("media/img/icon/newtab/icon-add.png")))
            .appendTo(scrollBox);
            
            const customWrapper = $("<ul></ul>")
            .attr($.attr.type, "custom")
            .appendTo(scrollBox);

            const addShortcutLabel = () => {
                return n.helper.i18n.get("new_tab_add_navigation_url")
                    || n.helper.i18n.get("overlay_save")
                    || "Add";
            };
            
            $("<li></li>")
                .append("<label>" + (n.helper.i18n.get("new_tab_navigation_title") || "Title") + "</label>")
                .append("<input type='text' name='title' value='" + currentSearchEngine.title.replace(/'/g, "&#x27;") + "' />")
                .appendTo(customWrapper);
            
            $("<li></li>")
                .append("<label>" + (n.helper.i18n.get("new_tab_navigation_url") || "Link") + "</label>")
                .append("<input type='text' name='url' value='" + currentSearchEngine.homepage.replace(/'/g, "&#x27;") + "' placeholder='https://example.com' />")
                .appendTo(customWrapper);

            // Build button without type= in HTML string (jsu clones via innerHTML; keep label resilient)
            const addButton = $("<button></button>")
                .addClass("add-shortcut")
                .attr({
                    type: "button",
                    "data-role": "add-shortcut"
                })
                .text(addShortcutLabel());
                
            $("<li></li>")
                .addClass("favicon-preview")
                .append($("<img />").attr({
                    "src": $.api.runtime.getURL("media/img/icon/newtab/icon-custom.png"),
                    "alt": ""
                }))
                .append(addButton)
                .appendTo(customWrapper);
            
            //pages — unlock duplicate fixed rows before painting the editor
            const pages = n.helper.util.sanitizeShortcutLocks(n.helper.dao.getData("n/links") || []);
            n.helper.dao.setData({"n/links": pages});
            pages.forEach((item) => {
                addEntry(item,list);
            });

			initDraggableLinks(scrollBox, "> ul."+$.cl.result+" > li");

            $("<a></a>").addClass($.cl.confirm.action).text(n.helper.i18n.get("overlay_save")).appendTo(elements.buttonWrapper);
        };

        /**
         * Returns the currently selectes search engine from the list
         *
         * @returns {string}
         */
        const getSelectedSearchEngine = () => {
            let value = null;
            elements.modal.find(" ul."+$.cl.result+" input[type='checkbox']").forEach((elm) => {
                if (elm.checked) {
                    value = $(elm).attr($.attr.value);
                    return false;
                }
            });
            return value;
        };


        /**
         * Sets the selected search engine and closes the overlay
         */
        const updateSearchEngine = () => {
            
            const value = getSelectedSearchEngine();
            let data={};

            if (value) {
            	
            	const searchEngineCustom = {
                    title: elements.modal.find("input[name='title']")[0].value,
                    homepage: elements.modal.find("input[name='homepage']")[0].value,
                    queryUrl: elements.modal.find("input[name='queryUrl']")[0].value
                }
                n.helper.search.updateSearchEngine(value,searchEngineCustom);
				
				data={
                	"n/searchEngine":value,
                	"n/searchEngineCustom":searchEngineCustom,
                }
            }
            
            elements.modal.find("div[data-name='searchSuggest'] > div.checkbox").forEach((elm) => {
            	
            	let name=$(elm).attr($.attr.name);
            	let checked=$(elm).hasClass($.cl.active);
            	data["n/"+name]=checked;
            	
            });

            //存储数据
            n.helper.dao.setData(data).then(()=>{
            	 closeOverlay();
            });
        };
        
        const updateLinks = ()=>{
        	
        	const links=[];
            elements.modal.find(" ul."+$.cl.result+" > li").forEach((elm) => {
                
                const ch=$(elm).find("input[type='checkbox']");
                const img=$(elm).find("a > img");
                const item={}
                
                item['title']=$(elm).attr($.attr.title) || ch.attr($.attr.title);
                item['url']=$(elm).attr($.attr.href) || ch.attr($.attr.href);
                item['selected']=$(elm).hasClass($.cl.lock) || (ch.length() > 0 && ch[0].checked) ? true : false;
                item['fixed']=$(elm).hasClass($.cl.lock)?true:false;
                item['remove']=false;
                // n/links lives in chrome.storage.sync (8KB/item). Never persist data: base64
                // icons there — only http(s) URLs. Favicons are cached via getFavicon/imageCache.
                const iconSrc = img.length() > 0 ? img.attr("src") : null;
                item['icon'] = (iconSrc && iconSrc.indexOf("http") === 0) ? iconSrc : null;
                item['origin']=!!$(elm).attr($.attr.origin) ? parseInt($(elm).attr($.attr.origin)) : 0;
                
                links.push(item);
            });

            n.helper.util.sanitizeShortcutLocks(links);
            
            n.helper.dao.setData({"n/links":links}).then(()=>{
            	return n.helper.dao.call("saveShortcuts", {links: links}).catch(() => null);
            }).then((res)=>{
            	// Only stamp after a real cloud save — Date.now() here used to block restore forever
            	if (res && res.code === "ok" && res.data && res.data.updateTime) {
            		return n.helper.dao.setData({
            			"u/shortcutsSyncTime": res.data.updateTime,
            			"u/shortcutsLastCheck": Date.now()
            		});
            	}
            	return null;
            }).then(()=>{
            	closeOverlay();
	        	location.reload(true);
            });
        }

        /**
         * Initializes the events for the currently displayed overlay
         */
        const initEvents = () => {
            
            let clickstart = null;
            
            //close
            elements.overlay.find("body").on("mousedown", (e) => {
                clickstart = e.target;
            }).on("click", (e) => { // close overlay when click outside the modal
                if (e.target.tagName === "BODY" && clickstart.tagName === "BODY") {
                    closeOverlay();
                }
            });

			//close
            elements.modal.find("a." + $.cl.close).on("click", (e) => { // close overlay by close button
                e.preventDefault();
                closeOverlay();
            });

			//choose
            elements.modal.on("click", "a", (e) => {
                e.preventDefault();
                const elmObj = $(e.currentTarget);
                const checkbox = elmObj.prev("div." + $.cl.checkbox.box);

                if (checkbox.length() > 0) {
                    checkbox.trigger("click");
                }

                if (elmObj.hasClass($.cl.confirm.action)) { // perform the action
                    performAction();
                }
            });

			//change listen
            elements.modal.find(" ul."+$.cl.result+" input[type='checkbox']").on("change", () => {
                $.delay().then(() => {
                    const customList = elements.modal.find("ul[" + $.attr.type + "='custom']");
                    if (getSelectedSearchEngine() === "custom") {
                        customList.addClass($.cl.visible);
                    } else {
                        customList.removeClass($.cl.visible);
                    }
                });
            });
            
            //click listen — toggle custom form; always re-apply Add label when shown
            elements.modal.on("click","span."+$.cl.add,() => {
                $.delay().then(() => {
                    const customList = elements.modal.find("ul[" + $.attr.type + "='custom']");
                    if (!customList.hasClass($.cl.visible)) {
                        customList.addClass($.cl.visible);
                        const btn = customList.find("button.add-shortcut, button[data-role='add-shortcut']");
                        if (btn.length() > 0) {
                            const label = n.helper.i18n.get("new_tab_add_navigation_url")
                                || n.helper.i18n.get("overlay_save")
                                || "Add";
                            btn.text(label);
                            if (btn[0]) {
                                btn[0].removeAttribute("disabled");
                            }
                        }
                        scheduleFaviconPreview();
                    } else {
                        customList.removeClass($.cl.visible);
                    }
                });
            });
            
            elements.modal.on("click"," ul > li."+$.cl.remove +" > span",(e) => {
            	
            	$(e.target).parents("li."+$.cl.remove).remove();
            	
            });
            
            //click listen
            elements.modal.on("click","ul[data-type=\"custom\"] > li.favicon-preview > button.add-shortcut",(e) => {
                e.preventDefault();
                e.stopPropagation();

                const btn = e.currentTarget;
                btn.setAttribute("disabled", "disabled");
                
                const titleInput = elements.modal.find("ul[data-type=\"custom\"] > li > input[name='title']")[0];
                const urlInput = elements.modal.find("ul[data-type=\"custom\"] > li > input[name='url']")[0];
                const previewImg = elements.modal.find("ul[data-type=\"custom\"] > li.favicon-preview > img");
                const defaultPreview = $.api.runtime.getURL("media/img/icon/newtab/icon-custom.png");
                
                const customNavigation = {
                    title: titleInput ? titleInput.value : "",
                    url: urlInput ? urlInput.value : "",
                    fixed:false,
                    selected:true,
                    remove:false,
                    origin:0,//本地用户添加
                    // Do not attach data: icons here — sync storage cannot hold base64 payloads.
                    icon: null
                }
                
                if(customNavigation.title && customNavigation.url){
                	addEntry(customNavigation,elements.modal.find("ul."+$.cl.result));
                }

                if (titleInput) {
                    titleInput.value="";
                }
                if (urlInput) {
                    urlInput.value="";
                }
                if (previewImg.length() > 0) {
                    previewImg.attr("src", defaultPreview);
                }

                const label = n.helper.i18n.get("new_tab_add_navigation_url")
                    || n.helper.i18n.get("overlay_save")
                    || "Add";
                btn.textContent = label;
                btn.removeAttribute("disabled");
                
                initDraggableLinks(elements.modal.find("div."+$.cl.scrollBox.wrapper), "> ul."+$.cl.result+" > li");//刷新drag
            });

            // Live favicon preview — debounce input so it updates while typing
            let previewTimer = null;
            let previewReq = 0;
            const refreshFaviconPreview = () => {
                const urlInput = elements.modal.find("ul[data-type=\"custom\"] > li > input[name='url']")[0];
                const titleInput = elements.modal.find("ul[data-type=\"custom\"] > li > input[name='title']")[0];
                const previewImg = elements.modal.find("ul[data-type=\"custom\"] > li.favicon-preview > img");
                if (!urlInput || previewImg.length() === 0) {
                    return;
                }
                const url = (urlInput.value || "").trim();
                const title = (titleInput && titleInput.value) || url;
                const fallbackTitle = title || url || "N";
                const reqId = ++previewReq;

                if (!/^https?:\/\//i.test(url)) {
                    n.helper.dao.call("getFavicon", {
                    	url: url || "https://local.invalid/",
                    	icon: {size: 32, title: fallbackTitle},
                    	query: true
                    }).then((response) => {
                    	if (reqId !== previewReq) {
                    		return;
                    	}
                    	if (response && response.img) {
                    		previewImg.attr("src", response.img);
                    	}
                    });
                    return;
                }

                n.helper.dao.call("getFavicon", {url: url, icon: {size: 32, title: fallbackTitle}, query: true}).then((response) => {
                    if (reqId !== previewReq) {
                        return;
                    }
                    if (response && response.img) {
                        previewImg.attr("src", response.img);
                    }
                });
            };

            const scheduleFaviconPreview = () => {
                if (previewTimer) {
                    clearTimeout(previewTimer);
                }
                previewTimer = setTimeout(refreshFaviconPreview, 400);
            };

            elements.modal.on("input change blur", "ul[data-type=\"custom\"] > li > input[name='url']", () => {
                scheduleFaviconPreview();
            });
            elements.modal.on("blur", "ul[data-type=\"custom\"] > li > input[name='title']", () => {
                scheduleFaviconPreview();
            });
        };
    };

})(jsu);