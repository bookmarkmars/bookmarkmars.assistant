($ => {
    "use strict";

    $.ActionHelper = function (b) {

		const ballState={hide:false};
		
		let sidepanelLastReload = 0;
        
        let timeout = null;
        let reason = null;
        let toggleMenusId=null;

        /**
         *
         * @returns {Promise}
         */
        this.init = () => {
            
            return new Promise((resolve) => {
                
                initEvents();
                
                //如果开启了sidePanel，则执行sidepanel唤起
                if (!!$.api.sidePanel) {
	                
	                // click on extension icon shall toggle the sidebar
	                $.api.sidePanel.setPanelBehavior({openPanelOnActionClick: true});
					
					$.api.storage.sync.get(["behaviour"], (config) => {
						if (config && config.behaviour && config.behaviour.iconAction && config.behaviour.iconAction !== "sidepanel") {
		                    $.api.sidePanel.setPanelBehavior({openPanelOnActionClick: false});
		                }
					});
	            }
                
                this.initContextmenus();
                resolve();
            });
        };
        
        this.getBallState = () => {
        	
        	return new Promise((resolve) => {
        		resolve(ballState);
        	});
        }
        
        this.setBallState = (opts) =>{
        	
        	return new Promise((resolve) => {
        		
        		ballState.hide=opts.hide;
        		
        		resolve();
        	});
        }
        
        /**
         * Reloads the sidebar in the sidepanel by updating the url with an uid query string
         *
         * @returns {Promise<void>}
         */
        this.reloadSidepanel = async () => {
            const now = +new Date();
            if (now - sidepanelLastReload > 1000 && $.api.sidePanel) {
                sidepanelLastReload = now;
                await $.api.sidePanel.setOptions({
                    path: "html/sidepanel.html?uid=" + Math.random().toString(36).substring(2, 14),
                });
            }
        };

        /**
         * 在插件icon下面添加官网+隐私条款
         *
         * @returns {Promise}
         */
        this.initContextmenus = async () => {
            return new Promise((resolve) => {
                b.helper.language.getLangVars().then((lang) => {
                    
                    $.api.contextMenus.removeAll(() => {
                        
                        const uid = Math.random().toString(36).substr(2, 12);

                        $.api.contextMenus.create({
                            id: "be_upgrade_" + uid,
                            title: lang.vars.extension_upgrade_address.message,
                            contexts: ["action"]
                        });

                        $.api.contextMenus.create({
                            id: "be_privacy_" + uid,
                            title: lang.vars.extension_privacy.message,
                            contexts: ["action"]
                        });
                        
                        //加一条下划线
                        $.api.contextMenus.create({
	                    	id: "be_seperator_" + uid,
	                    	contexts:["action"],
	                    	type: "separator"
	                    });
                        
                        //搜索放到第一位
                        $.api.contextMenus.create({
                        	id: "be_search_" + uid,
                        	title: lang.vars.search_context_menus_title.message,
                        	contexts:["selection"]
                        });
                        
                        //开合书签火星助手
                        $.api.contextMenus.create({
	                    	id: "be_open_close" + uid,
	                    	title: lang.vars.contextmenu_open_close_helper.message,
	                    	contexts:["all"]
	                    });
	                    
	                    //召唤球复位
                        $.api.contextMenus.create({
	                    	id: "be_ball_reset" + uid,
	                    	title: lang.vars.extension_ball_reset.message,
	                    	contexts:["all"]
	                    });
	                    
	                    //暂时影藏召唤球
                        $.api.contextMenus.create({
	                    	id: "be_ball_temporary_hide" + uid,
	                    	title: lang.vars.extension_ball_temporary_hide.message,
	                    	contexts:["all"]
	                    });
                        
                        $.api.contextMenus.onClicked.addListener((obj) => {
                            
                            if (obj.menuItemId === "be_official_" + uid) {
                                b.helper.util.openLink({
                                    href: $.opts.website.main.official,
                                    newTab: true
                                });
                            } else if (obj.menuItemId === "be_privacy_" + uid) {
                                b.helper.util.openLink({
                                    href:$.opts.website.main.official + $.opts.website.scope + $.opts.website.servletMain.privacy,
                                    newTab: true,
                                });
                            }
                            else if (obj.menuItemId === "be_upgrade_" + uid) {
                                b.helper.util.openLink({
                                    href:$.opts.website.main.official + $.opts.website.scope + $.opts.website.servletMain.download,
                                    newTab: true,
                                });
                            }
                            else if (obj.menuItemId === "be_open_close" + uid) {
                                 toggleSidebar();
                            }
                            else if (obj.menuItemId === "be_ball_reset" + uid) {
                                 
                                 //召唤球复位
                                 resetBallPosition("reset");
                                 
                            }else if(obj.menuItemId == "be_ball_temporary_hide"+uid){
                            	 
                            	 //暂时影藏
                            	 resetBallPosition("temp_hide");
                            }
                            else if(obj.menuItemId === "be_search_" + uid){
                            	 
                            	 let href=$.opts.website.main.official + $.opts.website.servletMain.exclude.search;
                            	 href=href+"?q="+obj.selectionText
                            	
                            	 b.helper.util.openLink({
                                    href:href,
                                    newTab: true,
                                 });
                            }
                        });

                        resolve();
                    });
                });
            });
        };
        
         this.setSidebarState= (opts)=>{
        	
        	return new Promise((resolve) => {
        		if(opts){
        			//createContextMenus(opts.state);
        		}
                resolve();
            });
        }
        
        const createContextMenus = (state) =>{
        	
        	if(state==null){return;}
        	
        	b.helper.language.getLangVars().then((lang) => {
        		
        		const uid = Math.random().toString(36).substr(2, 12);
        		
        		const toggleTitle={
		        	open:lang.vars.contextmenu_close_helper.message,
		        	close:lang.vars.contextmenu_open_helper.message,
		        }
        		
        		//创建开合按钮
        		if(toggleMenusId==null){
    			 	
    			 	toggleMenusId="be_toggle_" + uid;

    			 	$.api.contextMenus.create({
                    	id: toggleMenusId,
                    	title: toggleTitle[state],
                    	contexts:["all"]
                    });
                    
                    $.api.contextMenus.onClicked.addListener((obj) => {
                    	if (obj.menuItemId === toggleMenusId) {
                            toggleSidebar();
                        }
                    });
        		}
        		else{
        			updateContextMenus(toggleMenusId,{title:toggleTitle[state]});
        		}
        	});
        }
        
        
        const updateContextMenus= (id,opts) =>{
        	$.api.contextMenus.update(id,opts);
        }
        

        /**
         * Sets the state of the sidebar (blacklisted or notWhitelisted),
         * this is important to know, because the reason why the sidebar is not working are the user defined url rules
         *
         * @param {object} opts
         * @returns {Promise}
         */
        this.setReason = (opts) => {
            return new Promise((resolve) => {
                if (opts.reason) {
                    reason = opts.reason;
                    
                }
                resolve();
            });
        };

        /**
         * Clears the timeout
         *
         * @returns {Promise}
         */
        this.clearTimeout = () => {
            return new Promise((resolve) => {
                if (timeout) {
                    clearTimeout(timeout);
                    timeout = null;
                }
                resolve();
            });
        };

        /**
         * Checks the given url and returns the type if the page, if it's an url where the sidebar is not being loaded, otherwise NULL
         *
         * @param url
         * @returns {*}
         */
        const getNotWorkingPageInfo = (url) => {
            let ret = null;
            let found = false;
            const types = {
                new_tab: [b.helper.util.getParsedUrl("chrome://newtab/")],
                system: ["chrome://", "edge://","se://","about:blank"],
                extension_page: ["chrome\-extension://", "://extensions/","extension://"],
                webstore: ["https?://chrome\.google\.com/webstore/","https?://ext\.se\.360\.cn/"]
            };

            Object.keys(types).some((key) => {
                types[key].some((str) => {
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

        /**
         * Opens the new tab page with a parameter to tell the page, why the sidebar could not be loaded on the actual tab
         *
         * @param {object} tab
         */
        const showFallbackPage = (tab) => {
            
            let cat = "error";

            if (reason) { // the content script set a reason why the sidebar is not opening (e.g. blacklisted/not whitelisted url)
                cat = reason;
                reason = null;
            } else if (tab && tab.url) { // check whether the user tries to open the sidebar on urls where the sidebar is not working
                const pageType = getNotWorkingPageInfo(tab.url);

                if (pageType) {
                    cat = pageType;
                }
            }
            
            //检查授权情况
            b.helper.newtab.updateConfig()
            .then(()=>{
            	
            	const config=b.helper.newtab.getConfig();
            	if (typeof config.override !== "undefined" && config.override === true) {
            		b.helper.util.openLink({
		                href: $.api.runtime.getURL("html/new_tab.html"),
		                newTab: false
		            });
            	}else{
            		b.helper.util.openLink({
		                href: $.api.runtime.getURL("html/not_found.html"),
		                newTab: false,
		                params: {cat: cat}
		            });
            	}
            })
        };

        /**
         * 点击小图标，打开助手
         *
         * @returns {Promise}
         */
        const initEvents = async () => {
            $.api.action.onClicked.removeListener(toggleSidebar);
            $.api.action.onClicked.addListener(toggleSidebar); // click on extension icon shall toggle the sidebar
        };
        
        const resetBallPosition = (type) =>{
        	
        	$.api.tabs.query({active: true, currentWindow: true}, (tabs) => {
				$.api.tabs.sendMessage(tabs[0].id, {
                    action: $.opts.events.resetBallPosition,
                    reinitialized:null,
                    type:type,
                },(resp) => {
                	const lastError = $.api.runtime.lastError;
                    if (typeof lastError === "undefined") {
                    	;//do nothing
                    };
                });
			});
        };

        /**
         * Sends a message to the currently active tab and tell it to toggle the sidebar
         */
        const toggleSidebar = () => {
        	
        	$.api.tabs.query({active: true, currentWindow: true}, (tabs) => {
				
				$.api.tabs.sendMessage(tabs[0].id, {
                    action: $.opts.events.toggleSidebar,
                    reinitialized: b.reinitialized
                },(resp) => {
                	const lastError = $.api.runtime.lastError;
                    if (typeof lastError === "undefined") {
                    	;//do nothing
                    };
                });
                
                //对于部分打不开的页面处理
                let delay = 1500;
                if (tabs[0] && tabs[0].url) { // don't delay if the page is a known url where the sidebar is not being loaded
                    const pageType = getNotWorkingPageInfo(tabs[0].url);
                    if (pageType) {
                        delay = 0;
                    }
                }

                timeout = setTimeout(() => { // if the timeout is not getting cleared by the content script, the sidebar is not working -> show notification
                    showFallbackPage(tabs[0]);
                }, delay);
			});
        };
    };

})(jsu);