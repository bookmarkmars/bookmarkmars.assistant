($ => {
    "use strict";

    const background = function () {
        
        this.importRunning = false;
        this.preventReload = false;
        this.reinitialized = null;

        /**
         * Sends a message to all tabs, so they are reloading the sidebar
         *
         * @param {object} opts
         * @returns {Promise}
         */
        this.reload = (opts) => {
            
            return new Promise((resolve) => {
                Promise.all([
                    this.helper.cache.remove({name: "htmlList"}),//踢出缓存
                    this.helper.action.reloadSidepanel()
                ]).then(() => {
                    $.api.tabs.query({}, (tabs) => {
                       
                       tabs.forEach((tab, i) => {
                            
                            const delay = tab.active ? 0 : (i * 100); // stagger the reload event for all tabs which are not currently visible
                           
                            $.delay(delay).then(() => {
                                $.api.tabs.sendMessage(tab.id, {
                                    action: "reload",
                                    scrollTop: opts.scrollTop || false,
                                    reinitialized: this.reinitialized,
                                    type: opts.type
                                },(resp) => {
				                	const lastError = $.api.runtime.lastError;
				                    if (typeof lastError === "undefined") {
				                    	;//do nothing
				                    };
				                });//不允许发消息
                            });
                            
                            //替换
                            this.helper.newtab.openNewTab(tab);
                        });

                        resolve();
                    });
                });
            });
        };

        /**
         * 重新初始化content script，这里处理js代码
         *
         * @param {object} opts
         * @returns {Promise}
         */
        this.reinitialize = (opts = {}) => {
            
            return new Promise((resolve) => {
               
               this.reinitialized = +new Date();

                const types = {
                    css: "insertCSS",
                    js: "executeScript"
                };

                Promise.all([
                    this.helper.language.init(),
                    this.helper.newtab.updateConfig(),//更新配置
                    this.helper.cache.remove({name: "htmlList"}),//去除书签缓存
                    this.helper.action.reloadSidepanel()
                ]).then(() => {
                    
                    let type = null;

                    if (opts && opts.type) {
                        type = opts.type;
                    }

                    $.api.tabs.query({}, (tabs) => {
                        
                        tabs.forEach((tab, i) => {
                        	
                            if (tab.url && (tab.url.startsWith("http://") || tab.url.startsWith("https://") || tab.url.startsWith("file://"))) {
                                const delay = tab.active ? 0 : (i * 100); // stagger script injection for all tabs which are not currently visible

                                $.delay(delay).then(() => {
                                    Object.entries(types).forEach(([type, func]) => {
                                  
                                        const files = $.opts.manifest.content_scripts[0][type];
                                        $.api.scripting[func]({
				                            target: {tabId: tab.id},
				                            files: files
				                        })["catch"](() => { // send a notification instead to let the page deal with it
				                            notifyReinitialization(tab.id, type);
				                        });
														
                                    });
                                });
                            }else { // send a notification instead of loading the scripts to let the page deal with the reinitialization
			                    //notifyReinitialization(tab.id, type);
			                }
                        });
                        
                        resolve();
                    });
                });
            });
        };
        
         /**
         * Sends a message to the given tab to notify it that a reinitialization needs to be performed,
         * will be called if script injection failed (like on the newtab replacement page)
         *
         * @param {int} tabId
         * @param {string} type
         */
        const notifyReinitialization = (tabId, type) => {
        	
        	this.helper.action.reloadSidepanel();
        	
            $.api.tabs.sendMessage(tabId, {
                action: "reinitialize",
                type: type
            })["catch"](() => {
                $.api.runtime.lastError;
            });
        };

        /**
         * Initialises the eventhandlers
         *
         * @returns {Promise}
         */
        const initEvents = async () => {
        	
            $.api.bookmarks.onImportBegan.addListener(() => { // indicate that the import process started
                this.importRunning = true;
            });

            $.api.bookmarks.onImportEnded.addListener(() => { // indicate that the import process finished
                this.importRunning = false;
            });

			//书签创建、删除、概念的监听事件
            ["Changed", "Created", "Removed"].forEach((eventName) => { // trigger an event in all tabs after changing/creating/removing a bookmark
                $.api.bookmarks["on" + eventName].addListener(() => {
   
                    if (this.importRunning === false && this.preventReload === false) { // don't reload sidebar while import in running
                        this.reload({type: eventName});
                    }
                });
            });

			//书签的移动、文件夹记录的监听事件
            ["Moved", "ChildrenReordered"].forEach((eventName) => { // deleted the html cache after moving a bookmark
                $.api.bookmarks["on" + eventName].addListener(() => {
                    Promise.all([
                        this.helper.cache.remove({name: "htmlList"}),
                    ]);
                });
            });
        };

        /**
         * Initialises the helper objects
         */
        const initHelpers = () => {
            this.helper = {
                dao: new $.DaoHelper(this),
                connect: new $.ConnectHelper(this),
                bookmarks: new $.Bookmarks(this),
                language: new $.LanguageHelper(this),
                cache: new $.CacheHelper(this),
                image: new $.ImageHelper(this),
                viewAmount: new $.ViewAmountHelper(this),
                util: new $.UtilHelper(this),
                action: new $.ActionHelper(this),
                upgrade: new $.UpgradeHelper(this),
                linkchecker : new $.LinkCheckerHelper(this),
                serverExchange : new $.ServerExchangeHelper(this),
                statistics: new $.StatisticsHelper(this),
                bookmarkHtml:new $.BookmarkHtmlHelper(this),
                icon: new $.IconHelper(this),
                newtab: new $.NewtabHelper(this),
            };
        };

        /**
         * Calls the according method of the upgrade helper after installing or updating the extension,
         * waits 500ms if the helper is not initialized yet and calls itself again
         *
         * @param {object} details
         * @param {int} i
         */
        const callOnInstalledCallback = (details, i = 0) => {
        	
            if (this.helper && this.helper.upgrade && this.helper.upgrade.loaded) {

                if (details.reason === "install") { // extension was installed
                    this.helper.upgrade.onInstalled(details);
                } else if (details.reason === "update") { // extension was updated
                    this.helper.upgrade.onUpdated(details);
                }
            } else if (i < 100) {
                $.delay(500).then(() => {
                    callOnInstalledCallback(details, i + 1);
                });
            }
        };

        /**
         *
         */
        this.run = () => {
            
            const start = +new Date();

			//有限处理安装的问题
            $.api.runtime.onInstalled.addListener((details) => {

                callOnInstalledCallback(details);//多次循环查找，upgrade是否初始化
            });

			//卸载后的跳转链接
            $.api.runtime.setUninstallURL($.opts.website.main.official + $.opts.website.scope + $.opts.website.servletMain.uninstall,()=>{
            	this.helper.statistics.track({
            		name:"action",
            		value: {name: "uninstall", value:true}
            	}).then(()=>{
            		this.helper.statistics.sendStackToServer();
            	})
            	
            });

            initHelpers();
            
            this.helper.connect.init()
            .then(()=>{
            	return Promise.all([
	                this.helper.dao.init(),//统一数据模型
	                this.helper.language.init(),
	                this.helper.statistics.init(),
	                this.helper.bookmarks.init()
	            ]);
            	
            }).then(() => {
                return this.helper.icon.init();
            }).then(() => {
                return Promise.all([
                    initEvents(),
                    this.helper.action.init(),
                    this.helper.serverExchange.init(),//同步服务器数据
                    this.helper.newtab.init(),//美化页初始化
                    this.helper.image.init(),
                    this.helper.upgrade.init(),
                    this.helper.bookmarkHtml.init(),
                    
                ]);
            }).then(() => {
                return this.helper.statistics.trackUserData();//记录用户信息，启动插件的时候
            }).then(() => {
            	this.helper.newtab.reload();
                return this.reinitialize();
            }).then(() => {
                this.log("Finished bg script loading ", +new Date() - start);
            });
        };
        
        //正式版不要日志
        this.log=(msg)=>{
        	if($.isDev){
        		console.info(msg);
        	}
	    }
    };

    new background().run();
})(jsu);