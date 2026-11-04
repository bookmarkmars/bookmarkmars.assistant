($ => {
    
    "use strict";

    /**
     * @param {object} ext
     * @constructor
     */
    $.ConfirmHelper = function (ext) {

        /**
         *
         * @type {object}
         */
        let elements = {};
        let closing = false;

        const popupFrames = () => {
            const id = $.opts.ids.page.overlay;
            const list = [];
            if (ext.elm && ext.elm.shadow) {
                ext.elm.shadow.querySelectorAll("iframe#" + id).forEach((node) => list.push(node));
            }
            document.querySelectorAll("iframe#" + id).forEach((node) => {
                if (list.indexOf(node) === -1) {
                    list.push(node);
                }
            });
            return list;
        };

        const removePopupFrames = () => {
            popupFrames().forEach((node) => {
                if (node.parentNode) {
                    node.parentNode.removeChild(node);
                }
            });
        };

        /**
         * Creates a new overlay for the given bookmark
         *
         * @param {string} type
         * @param {string} title
         * @param {object} data
         */
        this.create = (type, title, data) => {
            const openFrame = elements.overlay && elements.overlay[0];
            if (!closing && openFrame && openFrame.isConnected) {
                return;
            }
            removePopupFrames();
            closing = false;
            elements = ext.helper.template.overlay(type, title);
            elements.overlay.data("info", data || {});
            
            this.setCloseButtonLabel(type === "infos" ? "close" : "cancel");

            switch (type) {
                case "delete": {
                    handleDeleteHtml(data);
                    break;
                }
                case "edit": {
                    if (ext.helper.entry.isSeparator(data.id)) {
                        handleEditSeparatorHtml(data);
                    } else {
                        handleEditHtml(data);
                    }
                    break;
                }
                case "add": {
                    handleAddHtml(data);
                    break;
                }
                case "collect": {
                    handleCollectHtml(data);
                    break;
                }
            }

            if (elements.modal.find("input").length() > 0) {
                elements.modal.find("input")[0].focus();
            }

            initEvents();
        };

        /**
         * Performs the action of the current overlay
         */
        this.performAction = () => {
            
            const data = elements.overlay.data("info");
            
            switch (elements.modal.attr($.attr.type)) {
                case "delete": {
                    deleteEntry(data);
                    break;
                }
                case "edit": {
                    if (ext.helper.entry.isSeparator(data.id)) {
                        editSeparator(data);
                    } else {
                        editEntry(data);
                    }
                    break;
                }
                case "add": {
                    addEntry(data);
                    break;
                }
                case "collect": {
                    collectPage(data);
                    break;
                }
            }
        };
        
        /**
         * Closes the overlay
         */
        this.closeOverlay = () => {
            if (closing) {
                return;
            }
            closing = true;

            popupFrames().forEach((node) => {
                node.classList.remove($.cl.visible);
                node.style.setProperty("opacity", "0", "important");
                node.style.setProperty("pointer-events", "none", "important");
            });

            try {
                ext.helper.util.triggerEvent("overlayClosed");

                if (ext.elm && ext.elm.bookmarkBox && ext.elm.bookmarkBox.all) {
                    ext.elm.bookmarkBox.all.find("li." + $.cl.drag.isDragged).remove();
                }
                if (ext.helper.scroll) {
                    ext.helper.scroll.focus();
                }

                const search = ext.elm && ext.elm.bookmarkBox && ext.elm.bookmarkBox.search;
                if (search && search.hasClass && search.hasClass($.cl.active)) {
                    ext.helper.entry.init();
                    ext.helper.search.refreshSearch();
                }
            } catch (err) {
            }

            $.delay(400).then(() => {
                removePopupFrames();
                closing = false;
                elements = {};
            });
        };

        /**
         * Sets the text for the close button
         *
         * @param {string} type
         */
        this.setCloseButtonLabel = (type = "close") => {
            elements.buttonWrapper.children("a." + $.cl.close).text(ext.helper.i18n.get("overlay_" + type));
        };

        /**
         * Returns true if the overlay iframe is in the DOM
         *
         * @returns {boolean}
         */
        this.isOpened = () => {
            if (ext.elm && ext.elm.shadow) {
                return !!ext.elm.shadow.querySelector("iframe#" + $.opts.ids.page.overlay);
            }
            return $("iframe#" + $.opts.ids.page.overlay).length() > 0;
        };

        /**
         * Appends the additional information for the given entry
         *
         * @param {object} data
         */
        const appendAdditionalInfo = (data) => {
            if (data.additionalInfo && data.additionalInfo.desc) {
                const container = $("<div></div>").addClass($.cl.info).appendTo(elements.modal);

                $("<h3></h3>").text(ext.helper.i18n.get("overlay_bookmark_additional_info")).appendTo(container);
                $("<p></p>").text(data.additionalInfo.desc).appendTo(container);
            }
        };

        /**
         * Appends the bookmark preview to the current overlay
         *
         * @param {object} data
         * @param {boolean} addUrl
         */
        const appendPreviewLink = (data, addUrl) => {
            
            const preview = $("<" + (data.isDir ? "span" : "a") + "></" + (data.isDir ? "span" : "a") + ">")
                .attr("title", data.title)
                .addClass($.cl.confirm.preview)
                .text(data.title)
                .appendTo(elements.modal);

			//添加图标，favicon暂时没法用
            if (data.isDir) {
                preview.prepend("<span class='" + $.cl.sidebar.dirIcon + "'></span>");
            }else {

                ext.helper.dao.call("getFavicon",{url: data.url,icon:{size:32,title:data.title}}).then((response) => {
                    if (response && response.img) {
                       preview.prepend("<img src='" + response.img + "' />");
                    }
                });
            }

            if (addUrl && addUrl === true && data.isDir !== true) {
                $("<a></a>")
                    .addClass($.cl.confirm.previewUrl)
                    .attr("title", data.url)
                    .text(data.url)
                    .insertAfter(preview);
            }
        };


        /**
         * Extends the overlay html for the delete operation of the selected entries
         *
         * @param selectedElements
         */
        const handleDeleteSelectedHtml = (selectedElements) => {
            $("<p></p>").text(ext.helper.i18n.get("overlay_delete_selected_confirm")).appendTo(elements.modal);

            $("<p></p>")
                .addClass($.cl.selected)
                .html("<strong>" + selectedElements.length + "</strong> <span>" + ext.helper.i18n.get("header_selected_entries") + "</span>")
                .appendTo(elements.modal);

            $("<a></a>").addClass($.cl.confirm.action).text(ext.helper.i18n.get("overlay_delete")).appendTo(elements.buttonWrapper);
        };

        /**
         * Extends the overlay html for the delete operation
         *
         * @param {object} data
         */
        const handleDeleteHtml = (data) => {
            $("<p></p>").text(ext.helper.i18n.get("overlay_delete_" + (data.isDir ? "dir" : "bookmark") + "_confirm")).appendTo(elements.modal);
            appendPreviewLink(data);
            appendAdditionalInfo(data);
            $("<a></a>").addClass($.cl.confirm.action).text(ext.helper.i18n.get("overlay_delete")).appendTo(elements.buttonWrapper);
        };

        /**
         * Extends the overlay html for the edit operation of a separator
         *
         * @param {object} data
         */
        const handleEditSeparatorHtml = (data) => {
            
            const list = $("<ul></ul>").appendTo(elements.modal);
            const title = data.title.replace(/'/g, "&#x27;").replace(/(^[-_]+|[-_]+$)/g, "").trim();

            $("<li></li>")
            	.css("margin-top","30px")
                .append("<label>" + ext.helper.i18n.get("overlay_bookmark_title") + "</label>")
                .append("<input type='text' name='title' value='" + title + "' />")
                .appendTo(list);

            $("<a></a>").addClass($.cl.confirm.action).text(ext.helper.i18n.get("overlay_save")).appendTo(elements.buttonWrapper);
        };

        /**
         * Extends the overlay html for the edit operation
         *
         * @param {object} data
         */
        const handleEditHtml = (data) => {
            appendPreviewLink(data);
            const list = $("<ul></ul>").appendTo(elements.modal);

            $("<li></li>")
                .append("<label>" + ext.helper.i18n.get("overlay_bookmark_title") + "</label>")
                .append("<input type='text' name='title' value='" + data.title.replace(/'/g, "&#x27;") + "' />")
                .appendTo(list);

            if (!data.isDir) {
                $("<li></li>")
                    .append("<label>" + ext.helper.i18n.get("overlay_bookmark_url") + "</label>")
                    .append("<input type='text' name='url' value='" + data.url.replace(/'/g, "&#x27;") + "' />")
                    .appendTo(list);
            }
            
            $("<a></a>").addClass($.cl.confirm.action).text(ext.helper.i18n.get("overlay_save")).appendTo(elements.buttonWrapper);
        };

        /**
         * Extends the overlay html for showing the confirm dialog for opening all the subfolder bookmarks of the clicked directory
         *
         * @param {object} data
         */
        const handleOpenChildrenHtml = (data) => {
            const bookmarks = data.children.filter(val => val.url && val.url !== "about:blank");
            const text = ext.helper.i18n.get("overlay_confirm_open_children", [bookmarks.length]);

            $("<p></p>").text(text).appendTo(elements.modal);
            appendPreviewLink(data);
            $("<a></a>").addClass($.cl.confirm.action).text(ext.helper.i18n.get("overlay_open_children")).appendTo(elements.buttonWrapper);
        };

        /**
         * Extends the overlay html for showing the confirm dialog for opening all of the selected bookmarks (and subfolder bookmarks of the selected directories)
         *
         * @param {object} data
         */
        const handleOpenSelectedHtml = (bookmarks) => {
            const text = ext.helper.i18n.get("overlay_confirm_open_selected", [bookmarks.length]);

            $("<p></p>").text(text).appendTo(elements.modal);
            $("<a></a>").addClass($.cl.confirm.action).text(ext.helper.i18n.get("overlay_open_children")).appendTo(elements.buttonWrapper);
        };

        /**
         * Extends the overlay html for showing the confirm dialog for hiding bookmarks from the sidebar
         *
         * @param {object} data
         */
        const handleHideHtml = (data) => {
            $("<p></p>").text(ext.helper.i18n.get("overlay_hide_" + (data.isDir ? "dir" : "bookmark") + "_confirm")).appendTo(elements.modal);
            appendPreviewLink(data);
            appendAdditionalInfo(data);
            $("<a></a>").addClass($.cl.confirm.action).text(ext.helper.i18n.get("overlay_hide_from_sidebar")).appendTo(elements.buttonWrapper);
        };
        
        const collectPage = (data)=>{
        	
        	if(elements.modal.find("ul."+$.cl.confirm.collect).find(">li."+$.cl.confirm.folder).length()<1){
        		ext.helper.util.createToast(ext.helper.i18n.get("collect_create_folder_first"),1);
        		return;
        	}
        	
        	let title=elements.modal.find("input[name='title']")[0].value.trim();
        	let url=location.href;
        	let folderId = null;
        	elements.modal.find("li."+$.cl.confirm.folder+" > div[data-type='radio']").forEach((elm) => {
            	if($(elm).hasClass($.cl.active)){
            		folderId=$(elm).find("input").attr($.attr.value);
            	}
            });
            
            if(folderId==null){
            	ext.helper.util.createToast(ext.helper.i18n.get("collect_choose_folder_please"),1);
        		return;
            }
            
            ext.helper.dao.call("submitCollect",{title:title,url:url,folderId:folderId}).then((res)=>{
        		
        		if(res.codeMsg !== "undefined" && res.codeMsg==="networkFail"){
						
					ext.helper.util.createToast(ext.helper.i18n.get("network_error"),1);
					return;
				}
            	
            	if(res.code==="not_login"){
            		ext.helper.util.createToast(ext.helper.i18n.get("collect_need_login"),1.3);
					return;
            	}
            	
            	if(res.code==="ok"){

            		ext.helper.util.createToast(ext.helper.i18n.get("collect_successfully"),0.7);
            		
            		this.closeOverlay();
            	}
            });
        }
        
         /**
         * Extends the overlay html for adding a bookmark or directory
         *
         * @param {object} data
         */
        const handleCollectHtml = (data) => {
            
            const submit = $("<a></a>").addClass($.cl.confirm.action).text(ext.helper.i18n.get("overlay_collect_confirm")).appendTo(elements.buttonWrapper);

			let titleValue = document.title || ""
            const list = $("<ul></ul>")
            	.addClass($.cl.confirm.collect)
            	.insertBefore(elements.buttonWrapper);
            	
            list.append("<li><label>" + ext.helper.i18n.get("overlay_collect_title") + "</label><input type='text' name='title' value='" + titleValue.replace(/'/g, "&#x27;") + "' /></li>");

            //文件夹
            const folder= $("<ul></ul>")
            	.addClass([$.cl.confirm.folder,$.cl.hidden])
            	.insertBefore(elements.buttonWrapper);
            	
            folder.append("<li><label>" + ext.helper.i18n.get("overlay_collect_folder_title") + "</label><input type='text' name='folderName' /></li>");
            folder.append("<li><label>" + ext.helper.i18n.get("overlay_collect_folder_description") + "</label><textarea name='folderDescription' rows='5'></textarea></li>");
            
            //1为公开，0为私有
            [1,0].forEach(item =>{
            	
            	let pp=ext.helper.i18n.get("overlay_collect_folder_private");
            	if(item>0){
            		pp=ext.helper.i18n.get("overlay_collect_folder_public");
            	}
            
	            const entry = $("<li></li>")
                .append(ext.helper.checkbox.get(elements.overlay.find("body"), {
                    [$.attr.name]: "state",
                    [$.attr.value]: item
                }, "radio"))
                .append("<a class='"+$.cl.name+"'>" + pp + "</a>")
                .appendTo(folder);
                
                if (item > 0) {
                    entry.find("input[" + $.attr.name + "='state'][" + $.attr.value + "='" + item + "']").parent("div." + $.cl.checkbox.box).trigger("click");
                }
	        });
	         
	        folder.append(
            	"<li>" +
            		"<button class='"+$.cl.close+"'>" + ext.helper.i18n.get("overlay_add_folder_finished") +"</button>" +
            		"<button class='"+$.cl.back+"'>" + ext.helper.i18n.get("overlay_add_folder_return") +"</button>" +
            	"</li>"
            );
            
            const clearAllInputs = () =>{
            	
            	//输入框数据复原
            	folder.find("input[name='folderName']").attr("value","");
        		folder.find("textarea[name='folderDescription']").attr("value","");
        		folder.find("input[" + $.attr.name + "='state'][" + $.attr.value + "='" + 1 + "']").parent("div." + $.cl.checkbox.box).trigger("click");
        		folder.find("li > button").removeAttr($.attr.id);

            	//错误提示全部清除
            	elements.modal.find("li > label.error-tip-info").forEach(elm=>{
            		$(elm).remove();
            	});
            }
            
            const refreshAllFolders = () =>{
            	
            	clearAllInputs();

            	//提取所有的收藏夹
	            ext.helper.dao.call("getAllCollectFolders").then((res)=>{
	            	
	            	if(res.codeMsg !== "undefined" && res.codeMsg==="networkFail"){
							
						ext.helper.util.createToast(ext.helper.i18n.get("network_error"));
						return;
					}
	            	
	            	if(res.code==="not_login"){
	            		ext.helper.util.createToast(ext.helper.i18n.get("collect_need_login"));
						return;
	            	}
	            	
	            	//先清空
	            	list.find("> li."+$.cl.confirm.folder).forEach(elm=>{
	            		$(elm).remove();
	            	});
	            	
	            	const datas=res.data;
	            	datas.forEach(item =>{
	            	
		           	 	const entry = $("<li class='"+$.cl.confirm.folder+"'></li>")
		                    .append(ext.helper.checkbox.get(elements.overlay.find("body"), {
		                        [$.attr.name]: "collect",
		                        [$.attr.value]: item.id
		                    }, "radio"))
		                    .append("<a class='"+$.cl.name+"'>" + item.name +"("+item.urlNums+")"+"</a>")
		                    .append("<button class='"+$.cl.edit+"' data-id='"+item.id+"'>" + ext.helper.i18n.get("overlay_collect_folder_edit") + "</button>")
		                    .appendTo(list);
		
		                entry.children("a").addClass(item.state>0?"unlock":"lock");
		            })
	            	
	            });
            }
            
            refreshAllFolders();

            list.append(
            	"<li>" +
            		"<button class='"+$.cl.confirm.addFolder+"'>" + ext.helper.i18n.get("overlay_add_collect_folder") +"</button>" +
            	"</li>"
            );
            
            
            list.on("click","li > button."+$.cl.confirm.addFolder,(e)=>{
            	
            	list.addClass($.cl.hidden);
            	folder.removeClass($.cl.hidden);
            	elements.buttonWrapper.addClass($.cl.hidden);

				//清除这个属性
				folder.find("li > button").removeAttr($.attr.id);

            	//错误提示全部清除
            	elements.modal.find("li > label.error-tip-info").forEach(elm=>{
            		$(elm).remove();
            	});
            	
            	//错误提示清除
            	elements.modal.find("input[name='folderName']").removeClass($.cl.error);
            	elements.modal.find("textarea[name='folderDescription']").removeClass($.cl.error);
            	
            	//直接修改标题
                elements.modal.find("h1").html(ext.helper.i18n.get("contextmenu_add_folder"));
            });
            
            //点击编辑
            list.on("click","li > button."+$.cl.edit,(e)=>{

            	//请求数据
            	const id = $(e.target).attr("data-id");
            	
            	ext.helper.dao.call("getCollectFolder",{id:id}).then((res)=>{
            		
            		if(res.codeMsg !== "undefined" && res.codeMsg==="networkFail"){
						
						ext.helper.util.createToast(ext.helper.i18n.get("network_error"));
						return;
					}
	            	
	            	if(res.code==="not_login"){
	            		ext.helper.util.createToast(ext.helper.i18n.get("collect_need_login"));
						return;
	            	}
	            	
	            	const data= res.data;
	            	if(!!data){
	            		
	            		folder.find("input[name='folderName']").attr("value",data.name);
	            		folder.find("textarea[name='folderDescription']").attr("value",data.description);
	            		folder.find("input[" + $.attr.name + "='state'][" + $.attr.value + "='" + data.state + "']").parent("div." + $.cl.checkbox.box).trigger("click");
	            		folder.find("li > button").attr($.attr.id,data.id);
	            		
	            		//先取数据再操作界面
		            	list.addClass($.cl.hidden);
		            	folder.removeClass($.cl.hidden);
		            	elements.buttonWrapper.addClass($.cl.hidden);
	           	
		            	//直接修改标题
		                elements.modal.find("h1").html(ext.helper.i18n.get("contextmenu_edit_folder"));
	            	}
            	});
            });
            
            //直接返回的情况
            folder.on("click","li > button."+$.cl.back,(e)=>{
            			
        		list.removeClass($.cl.hidden);
            	elements.buttonWrapper.removeClass($.cl.hidden);
            	folder.addClass($.cl.hidden);
            	
            	//直接修改标题
                elements.modal.find("h1").html(ext.helper.i18n.get("contextmenu_add_website"));
            });
            
            folder.on("click","li > button."+$.cl.close,(e)=>{
            	
            	const folderName = elements.modal.find("input[name='folderName']").removeClass($.cl.error);
            	const folderDescription = elements.modal.find("textarea[name='folderDescription']").removeClass($.cl.error);
            	
            	//错误提示全部清除
            	elements.modal.find("li > label.error-tip-info").forEach(elm=>{
            		$(elm).remove();
            	});
            	
            	const name = folderName[0].value.trim();
            	const description = folderDescription[0].value.trim();
            	let state = 0;//私有默认
            	elements.modal.find("li > div[data-type='radio']").forEach((elm) => {
	            	if($(elm).hasClass($.cl.active)){
	            		state=$(elm).find("input").attr($.attr.value);
	            	}
	            });
	            const id = $(e.target).attr($.attr.id);
	            
	            //console.log({id:id,name:name,description:description,state:state});

            	ext.helper.dao.call("addEditCollectFolder",{id:id,name:name,description:description,state:state}).then((res)=>{
            		
            		if(res.codeMsg !== "undefined" && res.codeMsg==="networkFail"){
						
						ext.helper.util.createToast(ext.helper.i18n.get("network_error"));
						return;
					}
	            	
	            	if(res.code==="not_login"){
	            		ext.helper.util.createToast(ext.helper.i18n.get("collect_need_login"));
						return;
	            	}
	            	
	            	if(res.code === "folder_name_illegal"){
	            		
	            		$("<label></label>")
                    		.addClass("error-tip-info")
                    		.text(ext.helper.i18n.get("collect_folder_name_len_limit",[res.data.nameMaxLen],false))
                    		.insertBefore(elements.modal.find("input[name='folderName']"));
	            		
	            		elements.modal.find("input[name='folderName']").addClass($.cl.error);
	            		
	            		return;
	            	}
	            	
	            	if(res.code === "folder_desc_illegal"){
	            		
	            		$("<label></label>")
                    		.addClass("error-tip-info")
                    		.text(ext.helper.i18n.get("collect_folder_desc_len_limit",[res.data.descMaxLen],false))
                    		.insertBefore(elements.modal.find("textarea[name='folderDescription']"));

	            		elements.modal.find("textarea[name='folderDescription']").addClass($.cl.error);
	            		
	            		return;
	            	}
	            	
	            	if(res.code === "ok"){
	            		
	            		refreshAllFolders();//刷新数据
	            		
	            		list.removeClass($.cl.hidden);
		            	elements.buttonWrapper.removeClass($.cl.hidden);
		            	folder.addClass($.cl.hidden);
		            	
		            	//直接修改标题
		                elements.modal.find("h1").html(ext.helper.i18n.get("contextmenu_add_website"));
	            	}
            	});
            });
        };

        /**
         * Extends the overlay html for adding a bookmark or directory
         *
         * @param {object} data
         */
        const handleAddHtml = (data) => {
            
            const submit = $("<a></a>").addClass($.cl.confirm.action).text(ext.helper.i18n.get("overlay_save")).appendTo(elements.buttonWrapper);
            const menu = $("<menu></menu>").attr($.attr.name, "select").appendTo(elements.modal);

            const links = {
                bookmark: $("<a></a>").attr($.attr.type, "bookmark").attr("title", ext.helper.i18n.get("overlay_label_bookmark")).appendTo(menu),
                dir: $("<a></a>").attr($.attr.type, "dir").attr("title", ext.helper.i18n.get("overlay_label_dir")).appendTo(menu),
                separator: $("<a></a>").attr($.attr.type, "separator").attr("title", ext.helper.i18n.get("overlay_label_separator")).appendTo(menu)
            };

            menu.children("a").on("click", (e) => {
                
                e.preventDefault();
                const type = $(e.currentTarget).attr($.attr.type);
                const list = $("<ul></ul>").attr($.attr.type, type).appendTo(elements.modal);

                let titleValue = "";
                let urlValue = "";

                if (type === "bookmark") { // default bookmark values -> current page information
                    titleValue = document.title || "";
                    urlValue = location.href;
                }

                if (data && data.values) { // fill fields with given values
                    titleValue = (data.values.title || "").trim();
                    urlValue = (data.values.url || "").trim();
                }

                //直接修改标题
                elements.modal.find("h1").html(ext.helper.i18n.get("contextmenu_add",[$(e.currentTarget).attr("title")],false));

                list.append("<li><label>" + ext.helper.i18n.get("overlay_bookmark_title") + "</label><input type='text' name='title' value='" + titleValue.replace(/'/g, "&#x27;") + "' /></li>");

                if (type === "bookmark") {
                    list.append("<li><label>" + ext.helper.i18n.get("overlay_bookmark_url") + "</label><input type='text' name='url' value='" + urlValue.replace(/'/g, "&#x27;") + "'  /></li>");
                }

				//插入位置
                const sort = ext.helper.dao.getData("u/sort");
                if (sort.name === "default" && (!data.values || typeof data.values.index === "undefined")) { // only show positioning option when there is not already a given index (like when dragging an url into the sidebar)
                    list.append("<li>" +
                        "<label>" + ext.helper.i18n.get("overlay_add_position") + "</label>" +
                        "<select name='position'>" +
                        " <option value='append'>" + ext.helper.i18n.get("overlay_add_position_append") + "</option>" +
                        " <option value='prepend'>" + ext.helper.i18n.get("overlay_add_position_prepend") + "</option>" +
                        "</select>" +
                        "</li>");

                    const defaultPos = ext.helper.dao.getData("b/newEntryPosition");
                    if (list.find("select[name='position'] > option[value='" + defaultPos + "']").length() > 0) {
                        list.find("select[name='position']")[0].value = defaultPos;
                    }
                }

                menu.addClass($.cl.hidden);
                
                $.delay(data && data.values ? 0 : 100).then(() => {
                    list.addClass($.cl.visible);
                    list.find("input")[0].focus();
                    submit.addClass($.cl.visible);
                });
            });
            
			//触发事件
            if (data.overlayType && links[data.overlayType]) { //跳过选择创建什么的时候执行
                links[data.overlayType].trigger("click");
            } else if (data && data.values) { // add bookmark with existing data (e.g. after dragging url into sidebar)
                links.bookmark.trigger("click");//触发click事件，比如拖拽进入等
            }
        };

        /**
         * Opens all the given bookmarks in new tab
         *
         * @param {object} data
         */
        const openSelected = (bookmarks) => {

            ext.helper.util.openAllBookmarks(bookmarks);
            
            this.closeOverlay();
        };

        /**
         * Hides the given bookmark or directory from the sidebar
         *
         * @param {object} data
         */
        const hideEntry = (data) => {
            ext.startLoading();
            const hiddenEntries = ext.helper.dao.getData("u/hiddenEntries");
            hiddenEntries[data.id] = true;

            ext.helper.dao.setData({"u/hiddenEntries": hiddenEntries}).then(() => {
                return Promise.all([
                    ext.helper.dao.call("removeCache", {name: "htmlList"})
                ]);
            }).then(() => {
                ext.helper.dao.call("reload", {type: "Hide"});
            });
            
            this.closeOverlay();
        };

        /**
         * Deletes the given bookmarks or directories
         *
         * @param data
         */
        const deleteSelectedEntries = async (selectedEntries) => {
            ext.startLoading();
            for (const entry of selectedEntries) {
                ext.elm.bookmarkBox.all.find("a[" + $.attr.id + "='" + entry.id + "']").parent("li").remove();
                await ext.helper.bookmark.performDeletion(entry.id, true);
            }

            ext.helper.dao.call("reload", {type: "Hide"});
            this.closeOverlay();
        };

        /**
         * Deletes the given bookmark or directory
         *
         * @param {object} data
         */
        const deleteEntry = (data) => {

            //如果是搜索框
            if(ext.elm.bookmarkBox.search.hasClass($.cl.active)){
            	ext.elm.bookmarkBox.search.find("a[" + $.attr.id + "='" + data.id + "']").parent("li").remove();
            }else{
            	ext.elm.bookmarkBox.all.find("a[" + $.attr.id + "='" + data.id + "']").parent("li").remove();
            }
            
            ext.helper.bookmark.performDeletion(data.id);
            
            this.closeOverlay();
        };

        /**
         * Validates the modal form for editing or adding entries,
         * returns the content of the fields and whether the form is filled properly
         *
         * @param {boolean} isDir
         * @returns {Object}
         */
        const getFormValues = (isDir) => {
           
            const titleInput = elements.modal.find("input[name='title']").removeClass($.cl.error);
            const urlInput = elements.modal.find("input[name='url']").removeClass($.cl.error);
            const positionSelect = elements.modal.find("select[name='position']");
            const infoField = elements.modal.find("textarea[name='info']");
            
            const ret = {
                errors: false,
                values: {
                    title: titleInput[0].value.trim(),
                    url: isDir ? null : urlInput[0].value.trim(),
                    position: positionSelect.length() > 0 ? positionSelect[0].value : ext.helper.dao.getData("b/newEntryPosition"),
                    additionalInfo: infoField.length() > 0 ? (infoField[0].value || null) : null
                }
            };
            
            if (ret.values.title.length === 0) {
                titleInput.addClass($.cl.error);
                ret.errors = true;
            }

            if (!isDir && ret.values.url.length === 0) {
                urlInput.addClass($.cl.error);
                ret.errors = true;
            }

            if (ret.values.url !== null && ret.values.url.search(/^[\w-]+\:/) !== 0) { // prepend http if no protocol specified
                ret.values.url = "http://" + ret.values.url;
            }
            
            return ret;
        };

        /**
         * Updates the title of the given separator
         *
         * @param {object} data
         */
        const editSeparator = (data) => {
            const title = elements.modal.find("input[name='title']")[0].value.trim();

            ext.helper.bookmark.editEntry({
                id: data.id,
                title: title.length > 0 ? "---- " + title + " ----" : "----------",
                url: "about:blank",
            }).then(() => {
                ext.helper.dao.call("reload", {type: "Edit"});
                this.closeOverlay();
            });
        };
        
        const notSupportTip = () => {
        	
        	//头部
			const tElement=elements.modal.find("input[name='title']");
			const li=tElement.parent("li");
			li.find(".error-tip-info").remove();
	    	
	    	$("<label></label>")
			.addClass("error-tip-info")
			.text(ext.helper.i18n.get("overlay_browser_dont_allow_eperate",[$.vName]))
			.insertBefore(tElement);
			
			tElement.addClass($.cl.error);
        }

        /**
         * Updates the given bookmark or directory (title, url and additional info)
         *
         * @param {object} data
         */
        const editEntry = (data) => {
            const formValues = getFormValues(data.isDir);

            if (formValues.errors === false) {
                ext.helper.bookmark.editEntry({
                    id: data.id,
                    title: formValues.values.title,
                    url: formValues.values.url,
                    additionalInfo: formValues.values.additionalInfo
                }).then(([result]) => {
                    if (result.error) {
                    	if(result.error.toLowerCase().indexOf("invalid")){//部分浏览器不允许读取操作书签栏
                    		
                    		notSupportTip();
                    	}
                        
                    } else {
                        ext.helper.dao.call("reload", {type: "Edit"});
                        this.closeOverlay();
                    }
                });
            }
        };

        /**
         * Returns the index which the newly created element should be positioned at, depending on the given 'position' parameter
         *
         * @param {int} parentId
         * @param {string} position
         * @returns {*}
         */
        const getIndexOfNewEntry = (parentId, position) => {
            if (position === "prepend") { // prepend -> index = 0
                return 0;
            } else { // append to directory -> determine index based on the amount of existing bookmarks in the parent directory
                const parentList = ext.elm.bookmarkBox.all.find("ul > li > a[" + $.attr.id + "='" + parentId + "'] + ul");
                return parentList.children("li").length();//长度，也就是最后一个的id
            }
        };

        /**
         * Adds a separator to the given directory
         *
         * @param {object} data
         */
        const addSeparator = (data) => {
            const title = elements.modal.find("input[name='title']")[0].value.trim();
            const position = elements.modal.find("select[name='position'")[0].value;
            const parentId = data.id || null;

            ext.helper.dao.call("createBookmark", {
                title: title.length > 0 ? "---- " + title + " ----" : "----------",
                url: "about:blank",
                parentId: data.id || null,
                index: getIndexOfNewEntry(parentId, position)
            }).then((result) => {
            	
            	if (result.error) {
            		
            		notSupportTip();
            		
                } else {
                	
                    this.closeOverlay();
                }
            });
        };

        /**
         * Adds a bookmark or directory to the given directory
         *
         * @param {object} data
         */
        const addEntry = (data) => {
            if (elements.modal.children("ul").attr($.attr.type) === "separator") {
                addSeparator(data);
            } else {
                const formValues = getFormValues(elements.modal.find("input[name='url']").length() === 0);

                if (formValues.errors === false) {
                    const obj = {
                        title: formValues.values.title,
                        url: formValues.values.url,
                        parentId: data.id || null,
                        index: 0
                    };

                    if (data && data.values) { // use given data (available e.g. after dragging a url into the sidebar)
                        if (data.values.index) {
                            obj.index = data.values.index;
                        }

                        if (data.values.parentId) {
                            obj.parentId = data.values.parentId;
                        }
                    } else {
                        obj.index = getIndexOfNewEntry(obj.parentId, formValues.values.position);
                    }

                    ext.helper.dao.call("createBookmark", obj).then((result) => {
                        if (result.error) {
                        	
                        	notSupportTip();
                    		
                        } else {
                            this.closeOverlay();
                        }
                    });
                }
            }
        };

        /**
         * Initializes the events for the currently displayed overlay
         */
        const initEvents = () => {
            
            const overlayBody = elements.overlay.find("body");
            
            let clickstart = null;
            
            overlayBody.on("mousedown", (e) => {
                clickstart = e.target;
            }).on("click", (e) => { // close overlay when click outside the modal
                if (e.target.tagName === "BODY" && clickstart.tagName === "BODY") {
                    this.closeOverlay();
                }
            });

            elements.modal.find("a." + $.cl.close).on("click", (e) => { // close overlay by close button
                e.preventDefault();
                this.closeOverlay();
            });

            elements.modal.on("click", "a." + $.cl.confirm.action, (e) => { // perform the action
                e.preventDefault();
                this.performAction();
            });

            elements.modal.on("focus", "input", (e) => { // remove error class from input fields
                $(e.currentTarget).removeClass($.cl.error);
            });

            elements.modal.find("a." + $.cl.confirm.preview + ", a." + $.cl.confirm.previewUrl).on("click", (e) => { // open bookmark
                e.preventDefault();
                ext.helper.util.openUrl(elements.overlay.data("info"), "newTab");
            });
        };
    };

})(jsu);