($ => {
    "use strict";

    /**
     * @param {object} ext
     * @constructor
     */
    $.HelperEventsHelper = function (ext) {

        let isRestoring = false;
        let sidebarPos = null;
        let sidepanelLeaveTimeout = null;

        /**
         * Initializes the helper
         *
         * @returns {Promise}
         */
        this.init = async () => {
           
           	sidebarPos = ext.helper.dao.getData("b/sidebarPosition");
            initBookmarkEntriesEvents();//书签相关事件
            initGeneralEvents(); 
            initHeaderEvents();//头部事件监听
            initSortEvent();
            
            //pageType
            const pageType=ext.helper.util.getPageType();
            if (pageType === $.opts.attr.sidepanel) {
                initSidepanelEvents();
            }
        };
        
        

        /**
         * Handles the click on one of the entries in the sidebar,
         * either opens the url, if the clicked entry was a bookmark,
         * or opens/closes the directory
         *
         * @param {jsu} elm
         * @param {object} opts
         * @returns {boolean}
         */
        this.handleEntryClick = (elm, opts) => {
        	
        	const config = ext.helper.dao.getData(["b/newTab", "b/linkAction"]);

        	//远程数据
        	if(elm.attr($.attr.type)){
        		
        		let href=elm.attr($.attr.value);

        		ext.helper.dao.call("openLink", {//打开书签火星
		            href: href,
		            newTab: config.linkAction === "newtab",
		            active: config.linkAction === "newtab"?config.newTab === "foreground":true
		        });
		        
        		return;
        	}

            const data = ext.helper.entry.getDataById(elm.attr($.attr.id));
            if (!data) {
                return false;
            }
            
            if(JSON.stringify(data.children) === '[]'){
            	ext.helper.list.folderIsBare(elm);
            	return false;
            }

            const middleClick = opts.which === 2 || opts.ctrlKey || opts.metaKey;
            if (data.isDir) { // Click on dir
				//middelClik涉及快捷键功能，暂时并没有使用，以下逻辑无用
            	if (middleClick) { // middle click -> open all children
                    const bookmarks = data.children.filter(val => val.url && val.url !== "about:blank");
                    if (bookmarks.length > ext.helper.dao.getData("b/openChildrenWarnLimit")) { // more than x bookmarks -> show confirm dialog
                        ext.helper.confirm.create("openChildren", ext.helper.i18n.get("contextmenu_open_children"), data);
                    } else { // open bookmarks directly without confirmation
                        ext.helper.util.openAllBookmarks(bookmarks);
                    }
                } else { // normal click -> toggle directory
                    ext.helper.list.toggleBookmarkDir(elm);
                }
            } else if (!data.isDir) { // Click on link
                
                data.reopenSidebar = ext.helper.dao.getData("b/reopenSidebar");

                if (middleClick) { // new tab -> middle click
                    const active = opts.shiftKey || (config.newTab === "background" && config.linkAction === "newtab");
                    ext.helper.util.openUrl(data, "newTab", active); // open in foreground when a normal click opens the tab in new tab in the background or while pressing 'shift' always in the foreground
                } else if (config.linkAction === "newtab") { // new tab -> normal click
                    ext.helper.util.openUrl(data, "newTab", config.newTab === "foreground");
                }else { // current tab
                    ext.helper.util.openUrl(data, "default", true);
                }
            }
        };

        /**
         * Selects/Deselects the given entry
         *
         * @param elm
         */
        const selectOrDeselectEntry = (elm) => {
            const id = elm.attr($.attr.id);

            if (elm.hasClass($.cl.selected)) {
                ext.helper.selection.deselect(id);
            } else {
                ext.helper.selection.select(id);
            }
        };

        /**
         * Initializes the eventhandlers for the bookmark entries
         *
         * @returns {Promise}
         */
        const initBookmarkEntriesEvents = async () => {

            Object.values(ext.elm.bookmarkBox).forEach((box, i) => {
                
                const selector = [box];
                
                $(selector).on("click mousedown", "> ul a", (e) => { // click on a bookmark (link or dir)
                    
                    e.preventDefault();
                    const elm = $(e.target);

                    if (
                        !elm.hasClass($.cl.drag.trigger) &&
                        !elm.hasClass($.cl.sidebar.separator) &&
                        ((e.which === 1 && e.type === "click") || (e.which === 2 && e.type === "mousedown") || ext.refreshRun)
                    ) { 
                    	
                    	//所有非编辑框全关闭
                    	if(!elm.hasClass($.cl.edit)){
                    		ext.helper.contextmenu.close();
                    	}

                    	// only left click
                        if (elm.hasClass($.cl.add)) {
                            const id = elm.parent("a").attr($.attr.id);
                            ext.helper.confirm.create("add", ext.helper.i18n.get("contextmenu_add",[""],false), ext.helper.entry.getDataById(id));
                        }
                        else if(elm.hasClass($.cl.refresh)){//刷新
                        	
                        	ext.helper.dao.call("removeCache", {name: "htmlList"}).then(()=>{
                        		ext.helper.dao.call("reload", {type: "Hide"});
                        	})
  
                        }
                        else if(elm.hasClass($.cl.edit)){

                        	 //edit
                        	 let type = "list";
			                 let aTag=$(e.target).parent("a");//直接父亲
			                 if (aTag.hasClass($.cl.sidebar.separator)) {
			                    type = "separator";
			                 }
			                 aTag.removeClass($.cl.sidebar.mark);
			                 
			                 let open=false;
			                 const contextmenus = ext.elm.iframeBody.find("div." + $.cl.contextmenu.wrapper);
				             contextmenus.forEach((contextmenu) => {
				                open=$(contextmenu).hasClass($.cl.visible);
				             });
				             
				             //type
				             if(aTag.attr($.attr.id) < 0){
				             	type="fre_"+type;
				             }

				             //toggle
				             if(open){
				             	ext.helper.contextmenu.close();
				             }else{
				             	ext.helper.contextmenu.create(type,aTag);
				             }
                        }
                        else {
                            this.handleEntryClick($(e.currentTarget), e);
                        }
                    }

                }).on("contextmenu", "> ul a", (e) => { //preven pop up of sys
                    e.preventDefault();
                })
                
                ext.elm.header.on("click mousedown",(e) => {
                	ext.helper.contextmenu.close();
                });
                
            });
        };

        /**
         * Initializes general events for the sidebar
         *
         * @returns {Promise}
         */
        const initGeneralEvents = async () => {

            //监听后台事件
            $.api.runtime.onMessage.removeListener(handleBackgroundMessage);
            $.api.runtime.onMessage.addListener(handleBackgroundMessage);
        };
        
        const initHeaderEvents = async () => {
        	 ext.elm.header.on("click", "div." + $.cl.sidebar.toolBox, (e) => { // click on a link in toolbox
                
                e.preventDefault();
                
                let href=null;
                let name =$(e.target).attr($.attr.name) || $(e.target).parent("a").attr($.attr.name);

                switch (name) {
                    case "official": {
                        href = $.opts.website.main.official;
                        break;
                    }
                    case "setting": {
                        href = "html/manage.html#setting";
                        break;
                    }
                    case "tool": {
                        href = "html/manage.html#tool";
                        break;
                    }
                    case "ucenter": {
                        href = "html/manage.html#ucenter";
                        break;
                    }
                }
                
                if (href) {
                    ext.helper.dao.call("openLink", {
                        href: href.startsWith("http")?href:$.api.runtime.getURL(href),
                        newTab: true
                    });
                }
            });
        }
        
        /**
         * Initializes the eventhandlers for the sidepanel
         */
        const initSidepanelEvents = () => {
        	
            //$(window).on("resize.be", async () => {
            //   	const wH=ext.helper.util.getWindowWH();
            //});

            $(document).on("mouseenter.be", () => {
                if (sidepanelLeaveTimeout) {
                    clearTimeout(sidepanelLeaveTimeout);
                }
            });

            $(document).on("mouseleave.be", () => {
                sidepanelLeaveTimeout = setTimeout(() => {
                    ext.helper.contextmenu.close();
                }, 1000);
            });
        };
        
        const initSortEvent= ()=>{
        	
        	ext.elm.sortBox.find("div."+$.cl.sidebar.filter).on("click","label", (e) => { 
	            ext.helper.list.updateSort("default");//恢复默认
        	});
        	
        	ext.elm.sortBox.find("select[data-type='field']").on("change", (e) => { //sort
                
                const options=$(e.target).find("option");
               	
               	options.forEach(option=>{
               		
               		if($(option).attr("selected")){
                	
	                	const name = $(option).attr($.attr.value);
	                    ext.helper.list.updateSort(name);//用默认情况
	                }
               	})
            });
            
            ext.elm.sortBox.find("select[data-type='order']").on("change", (e) => { //sort
                
                const options=$(e.target).find("option");
               	
               	options.forEach(option=>{
               		
               		if($(option).attr("selected")){
                	
	                	const direction = $(option).attr($.attr.value);
	                	
	                	let name=null;
	                	const fileds=ext.elm.sortBox.find("select[data-type='field'] > option");
	                	fileds.forEach(field=>{
	                		if($(field).attr("selected")){
		                		name=$(field).attr($.attr.value);
		                	}
	                	});

	                    ext.helper.list.updateSort(name,direction);
	                }
               	})
            });
        }

        /**
         * Handles the received message from the background script
         *
         * @param {object} message
         */
        const handleBackgroundMessage = (message, sender, sendResponse) => {
        	
            if (message && message.action && (message.reinitialized === null || ext.initialized > message.reinitialized)) { // background is not reinitialized after the creation of this instance of the script -> perform the action
                
                if (message.action === "reload" || message.action === "reinitialize") { // reload the current instance of the extension
                    
                    let performReload = true;
                    if (message.type === "Removed" || (message.type === "Created" && isRestoring === true)) { // removed or created from undo -> prevent reload when it was performed on this browser tab
                        const box = ext.helper.list.getActiveBookmarkBox();
                        if (box.find("a." + $.cl.sidebar.restored).length() > 0) { // prevent reloading the sidebar on the tab where the entry got removed or restored
                            performReload = false;
                        }
                    }

                    if (performReload) {
                        let delay = 0;
                        if (message.scrollTop) {
                            ext.helper.scroll.setScrollPos(ext.elm.bookmarkBox.all, 0);
                            delay = 100;
                        }

                        ext.needsReload = true;
                        $.delay(delay).then(ext.reload);
                    }
                } else if (message.action === $.opts.events.toggleSidebar) { // click on the icon in the chrome menu
                    
                    ext.helper.dao.call("clearNotWorkingTimeout");

                    if (ext.elm.iframe.hasClass($.cl.sidebar.extLoaded)) {
                       ext.helper.ball.closeSidebar();
                    } else {
                       ext.helper.ball.openSidebar();
                    }
                }else if(message.action === $.opts.events.resetBallPosition){//重置召唤球位置
                	
                	if("reset"===message.type){
                		ext.helper.ball.refreshBallPosition();
                	}
                	else if("temp_hide"===message.type){//短暂影藏
                		ext.helper.ball.hideBallTemporarily();
                	}
                	
                }
                else if(message.action === "autoBackupSuccess"){
                	ext.helper.util.createToast(ext.helper.i18n.get("backup_success_notice"));
                }
            }
        };
    };

})(jsu);