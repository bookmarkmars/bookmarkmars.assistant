($ => {
    "use strict";

    const Client = function () {

        const uid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
	        var r = Math.random() * 16 | 0,
	            v = c == 'x' ? r : (r & 0x3 | 0x8);
	        return v.toString(16);
	    }).replaceAll("-","");
        
        //是否初始化
        this.initialized = null;
        
        //存在检查timeout
        let existenceTimeout = null;
        
        const checkExistenceGap = 3;//unit is second
        
        //加载信息
        let loadingInfo = {};
        
        this.elm = {};
        this.needsReload = false;
        this.state = null;
        this.uid= uid;//传给其他元素
        
        let isLoading = false;
        this.refreshRun = true;//正在刷新
        
        let retryCount = 0;

        /**
         * Constructor
         */
        this.run = () => {
        	
        	$("html").attr($.attr.uid, uid);
        	
        	const removedOldInstance = destroyOldInstance();
        	
        	ping();

        	$(document).on("visibilitychange.be", () => { // listen for the document becoming visible/hidden
               
                if (document.hidden !== true) {
                    if (this.initialized === null) { // extension is not initialized yet
                        init();
                    } else if (this.needsReload) { // extension needs a reload
                        this.reload();
                    }
                }
            }, {capture: false});
        	
        	init(removedOldInstance === false);
        	
        };
                
		const ping = () => {
			
			if($.api.runtime.id == undefined) return;
			
		    let port;
            
            const connect = () => {
                if (document.visibilityState === "hidden") {
                    return;
                }
                try {
                    port = $.api.runtime.connect({name: "keepalive"});
                } catch (err) {
                    port = null;
                    return;
                }
                port.onDisconnect.addListener(() => {
                    // The page was frozen into back/forward cache. Reading lastError
                    // clears the unchecked-channel warning, and a new port waits
                    // until the page is visible again.
                    $.api.runtime.lastError;
                    port = null;
                    if (document.visibilityState !== "hidden") {
                        connect();
                    }
                });
                
                const key = "greeting";
                const opts = {
                	type:key,
                	uid:key + "_{}_" + (+new Date()) + Math.random().toString(36).substr(2, 12)
                	
                };
                try{port.postMessage(opts);}catch(err){;}
               
                port.onMessage.addListener(res => {
                    this.log("keepalive message: "+res.result);
                });
            };
            connect();
            document.addEventListener("visibilitychange", () => {
                if (document.visibilityState === "visible" && !port) {
                    connect();
                }
            });
            window.addEventListener("pageshow", () => {
                if (!port) {
                    connect();
                }
            });
		};
        
         /**
         * Initialises the extension,
         * is only running if the current tab is visible and there is no other process running at the moment
         *
         * @param {boolean} force if set to true the sidebar gets initialised regardless of the document visibility state
         */
        const init = (force = false) => {
            
            if (isLoading === false && (force || document.hidden !== true)) { // prevent multiple init attempts -> only proceed if the previous run finished and if the document is visible
                
                isLoading = true;
                
	        	//初始化方法
	        	initHelpers();

	        	this.helper.dao.init()
	        	.then(()=>{
	        		return this.isBlacklistWeb();//是否屏蔽
	        	})
				.then((yes) => {//model初始化，完成和bg的链接
	        		
	        		if(!yes){
	        			
	        			this.helper.i18n.init()
		        		.then(()=>{//语言包初始化
		        			this.helper.fontAdd.init();
		        			return this.helper.styleHelper.addStylesheets(["basic"]);//基本css插入
		        		}).then(()=>{
			        		return initSidebarMarkup();//初始化样式
			        	}).then(() => {
		                    
		                    if (this.elm.iframe && this.elm.iframe[0]) { // prevent errors on pages which instantly redirect and prevent the iframe from loading this way
	
		                    	//开合初始化
		                    	this.helper.ball.init();
		                    	
		                    	//panel 
		                    	this.helper.panel.init();
		                    	
		                    	//初始化list，涉及书签操作
		                        this.helper.list.init();
		                        
		                        this.log("Refresh page..");
		                        
		                        //事件初始化
		                        this.helper.helperEvents.init();
		                        
		                        //搜索初始化
		                        this.helper.search.init();
		                        
		                        //书签拖拽，编辑等
		                        this.helper.dragmove.init();
		                        
		                        //超级链接检查
		                        this.helper.powerfulCheck.init();
		
								//服务器相关
								this.helper.official.init();
								
								//自动备份
								this.helper.autoBackup.init();
								
								let title = document.title || ""
								
		                        this.helper.dao.call("addViewAmount", {url: location.href,title:title,referrer:document.referrer});
		                    }
		               });
	        		}else{
	        			//监听从其他地方过来的，打开助手的请求
	        			$.api.runtime.onMessage.addListener((message) => {
                            if (message && message.action && message.action === $.opts.events.toggleSidebar) { // click on the icon in the chrome menu
                                this.helper.dao.call("setNotWorkingReason", {reason: this.state});
                            }
                        });
                        this.log("Shield website '" + location.href + "'");
	        		}
	        	});
            }
        };
        
        /**
         * Returns whether the sidebar is allowed to be initialized for the current url,
         * Checks the configured patter rules
         *
         * @returns {boolean}
         */
        this.isBlacklistWeb = () => {
        	
        	return new Promise((resolve) => {

	            this.helper.dao.call("getValue",{key:"blacklist"})
	            .then((res)=>{
	            	
	            	let block = false;
	            	
	            	const rules=res.list;

	            	rules.some((rule) => {
	            		
	            		rule = rule.replace(/^https?:\/\//i, "");

		                if (rule.indexOf("*") !==-1){

                    		rule = rule.replace(/([.?&])/g, "\\$1");
                    		rule = rule.replace(/\*/g, ".*");
                    		
                    		//需要正则匹配
		                	const regex = new RegExp(rule);
		                	
		                	if (location.href.search(regex) !== -1) {
			                    block = true;
			                    return true;
			                }
		                }else{//完全匹配
		                	let href=location.href.endsWith("/")?location.href.substring(0,location.href.lastIndexOf("/")):location.href;
		                	if(href.replace(/^https?:\/\//i, "") === rule){
		                		 block = true;
			                     return true;
		                	}
		                }
		            });
		            
		            if(block){
		            	this.state = "forbidden";
		            }

		            resolve(block);
	            }).catch(()=>{
	            	resolve(false);
	            })
	        });
        };
        
        /**
         * Removes the existing instance of the extension
         *
         * @returns {boolean} old instance removed or not
         */
        const destroyOldInstance = () => {
            
            let ret = false;
            const elements = [];

            ["iframe#" + $.opts.ids.page.iframe, "iframe#" + $.opts.ids.page.overlay, "div#" + $.opts.ids.page.indicator,"div#" + $.opts.ids.confirm.toast].forEach((elm) => {
                elements.push($(elm));
            });

            const elmObj = $(elements);

			//消除所有事件
            $(document).off("*.be");
            $(window).off("*.be");

			//删除所有内容
            if (elmObj.length() > 0) {
                elmObj.remove();
                ret = true;
            }
            return ret;
        };
        
        
        /**
	     * Initialises the not yet loaded images in the sidebar
	     */
	    this.initImages = () => {
	        $.delay(0).then(() => {
	            if (this.elm.iframe.hasClass($.cl.sidebar.extLoaded)) {
	            	
	                this.elm.bookmarkBox.all.find("a > img").forEach((_self) => {
	                    
	                    const img = $(_self);

	                    if(img.attr("src").length>10){return;}
	                    
	                    const url=img.parent("a."+$.cl.sidebar.bookmarkLink).attr($.attr.value);
	                    const title=img.parent("a."+$.cl.sidebar.bookmarkLink).attr($.attr.title);
	                    
	                    //存在则重新赋值
	                    const src = img.attr($.attr.src);
	                    if(src && src.length > 10){
                    		img.removeAttr($.attr.src);
	                    	img.attr("src", src);
                    	}else if(url){
                    		//重新获取赋值
                    		this.helper.dao.call("getFavicon",{url: url,icon:{size:32,title:title}}).then((response) => {
                    			if (response && response.img) {
                    				img.removeAttr($.attr.src);
	                    			img.attr("src", response.img);
                    			}
                    		});
                    	}
	                });
	            }
	        });
	    };
	    
	    /**
         * Adds a loading mask over the sidebar
         */
        this.startLoading = () => {
            this.elm.sidebar.addClass($.cl.loading);
            if (loadingInfo.timeout) {
                clearTimeout(loadingInfo.timeout);
            }
            if (typeof loadingInfo.loader === "undefined" || loadingInfo.loader.length() === 0) {
                loadingInfo.loader = this.helper.template.loading().appendTo(this.elm.sidebar);
            }
        };
        
        
        /**
         * Removes the loading mask after the given time
         *
         * @param {int} timeout in ms
         */
        this.endLoading = (timeout = 500) => {
            loadingInfo.timeout = setTimeout(() => {
                this.elm.sidebar.removeClass($.cl.loading);
                if (loadingInfo.loader) {
                    loadingInfo.loader.remove();
                }
                loadingInfo = {};
            }, timeout);
        };

	    
	    /**
         * Prints the given message in the console (only if this.dev = true)
         *
         * @param {*} msg
         */
        this.log = (msg) => {
            if ($.isDev) {
               console.log(msg);
            }
        };
        
        /**
	     * Reloads the sidebar, the model data, the language variables and the bookmark list,
	     * is only running if the current tab is visible and there is no other process running at the moment
	     */
	    this.reload = () => {
	    	
	        if (isLoading === false && document.hidden === false) { // prevent multiple reload attempts -> only proceed if the previous run finished and if the document is visible
	            
	            this.needsReload = false;
	            isLoading = true;
	
	            this.helper.dao.init().then(() => {
	                return Promise.all([
	                    this.helper.i18n.init(),
	                    this.helper.entry.init()
	                ]);
	            }).then(() => {
	                return this.helper.list.updateBookmarkBox();
	            }).then(()=>{
	            	return this.helper.styleHelper.addStylesheets(["basic"]);//基本刷新
	            }).then(()=>{
	            	return this.helper.ball.refreshBallSize();//刷新球大小
	            });
	        }
	    };
	    
	    /**
         * 插件加载完毕
         */
        this.loaded = () => {
            
            if (this.elm.iframeBody && !this.elm.iframeBody.hasClass($.cl.sidebar.extLoaded)) {
                
                const data = this.helper.dao.getData(["b/animations", "b/toggleArea", "a/showIndicator"]);
                
                //搜索头部
                this.helper.list.updateSidebarHeader();
                
                //搜索初始化
                this.helper.search.init();

                checkExistence();
                
                if (this.elm.iframe.hasClass($.cl.sidebar.extLoaded)) {
	                
	                $("body").addClass($.cl.page.noscroll);
	                
	                //加载一次数据，如果是打开状态
                	this.helper.entry.initOnce();
	            }

                this.initialized = +new Date();
                this.state = "loaded";
                this.log("Finished loading in " + (this.initialized - this.updateBookmarkBoxStart) + "ms");

				//如果是sidepanel则直接打开
				const pageType = this.helper.util.getPageType();
				let autoOpen = pageType === $.opts.attr.sidepanel ?true:false;
				if(autoOpen){
					this.helper.util.triggerEvent("openSidebar", {});
				}
            }
            isLoading = false;
        };
        
        /**
         * 有些网站会将iframe给清除，定时器不断监听
         */
        const checkExistence = () => {
        	
            if (existenceTimeout !== null) {
                clearInterval(existenceTimeout);
            }
            
            existenceTimeout=setInterval(() => {
               
                const htmlUid = $("html").attr($.attr.uid);
                if (typeof htmlUid === "undefined" || uid === htmlUid) {
                    
                    const iframe = $("iframe#" + $.opts.ids.page.iframe);
                    if (iframe.length() === 0 || !iframe[0].contentDocument || !iframe[0].contentDocument.body || iframe[0].contentDocument.body.childElementCount === 0) {
                        
                        destroyOldInstance();//发现有残余，踢出
                        init(true);//强制再次初始化
                    }
                }
            },checkExistenceGap * 1000);
        };


		const initSortBox = ()=>{
			
			const field=$("<select></select>").attr($.attr.type,"field");
            const order=$("<select></select>").attr($.attr.type,"order");
            
            ['default','create','used','frequency'].forEach(key=>{
            	field
            	.append(
            		$("<option></option>")
            		.attr($.attr.value,key)
            		.text(this.helper.i18n.get("sidebar_filter_"+key))
            	);
            });
            
            ['desc','asc'].forEach(key=>{
            	order
            	.append(
            		$("<option></option>")
            		.attr($.attr.value,key.toUpperCase())
            		.text(this.helper.i18n.get("sidebar_filter_order_"+key))
            	);
            });
            
            const filter=$("<div></div>")
            			.addClass($.cl.sidebar.filter)
            			.append($("<span></span>").addClass($.cl.icon))
            			.append($("<label></label>").text(this.helper.i18n.get("sidebar_filter")))
            			.append(field)
            			.append(order);
            					
			this.elm.sortBox=$("<div id=\"" + $.opts.ids.sidebar.bookmarkBox.sort + "\" ></div>")
							.append(filter)
							.appendTo(this.elm.sidebar);
		}
        

        /**
         * Creates the basic html markup for the sidebar
         *
         * @returns {Promise}
         */
        const initSidebarMarkup = async () => {
        	
            this.elm.iframe = $("<iframe id=\"" + $.opts.ids.page.iframe + "\"></iframe>")
                .addClass(["notranslate"])// 'notranslate' prevents Google translator from translating the content of the sidebar
             .appendTo("body");
             
            $("body").attr($.attr.uid, uid); 
            
            
            //添加toast
            this.elm.toast=$("<div id=\"" + $.opts.ids.confirm.toast + "\" ></div>")
      		.append($("<div></div>").addClass($.cl.confirm.toastText))
      		.appendTo("body");
  
            //给头部加入css   
            this.elm.iframeHeader=this.elm.iframe.find("head");
            
            this.helper.styleHelper.readCss(["helper"], this.elm.iframeHeader);
            
            //处理body
            this.elm.iframeBody = this.elm.iframe.find("body");

			//section
			const pageType = this.helper.util.getPageType();
			let position = pageType === $.opts.attr.sidepanel ?"right":this.helper.dao.getData("b/position");

            this.elm.sidebar = $("<section id=\"" + $.opts.ids.sidebar.sidebar + "\"  "+$.attr.position+"=\"" + position + "\"></section>").appendTo(this.elm.iframeBody);

			if(pageType === $.opts.attr.sidepanel){
            	this.elm.sidebar.css("width","calc(100% - 2px)");//强制撑满
            }

            this.elm.header = $("<header></header>").prependTo(this.elm.sidebar);
            
            //sort
            initSortBox();
            
            //搜索和展示框
            this.elm.bookmarkBox = {};
            ["all", "search"].forEach((val) => {
                this.elm.bookmarkBox[val] = this.helper.scroll.add($.opts.ids.sidebar.bookmarkBox[val], $("<ul></ul>").appendTo(this.elm.sidebar));
            });

            //触发自定义事件，在new Tab中使用
            this.helper.util.triggerEvent("elementsCreated", {
                elm: {
                    iframe: this.elm.iframe,
                    sidebar: this.elm.sidebar
                },
                helper: this.helper
            });
        };
        
        
         /*
         * ################################
         * PRIVATE
         * ################################
         */

        /**
         * Initialises the helper objects
         */
        const initHelpers = () => {
            this.helper = {
            	dao: new $.DaoHelper(this),
            	i18n: new $.I18nHelper(this),
                styleHelper: new $.StyleHelper(this),
                list: new $.ListHelper(this),
                scroll:new $.ScrollHelper(this),
                util:new $.UtilHelper(this),
                entry:new $.EntryHelper(this),
                ball:new $.BallHelper(this),
                panel:new $.PanelHelper(this),
                helperEvents: new $.HelperEventsHelper(this),
                search: new $.SearchHelper(this),
                checkbox: new $.CheckboxHelper(this),
                fontAdd: new $.FontAddHelper(this),
                confirm: new $.ConfirmHelper(this),
                template: new  $.TemplateHelper(this),
                dragmove: new $.DragmoveHelper(this),
                contextmenu:new $.ContextmenuHelper(this),
                bookmark:new $.BookmarkHelper(this),
                user:new $.UserHelper(this),
                powerfulCheck:new $.powerfulCheckHelper(this),
                official:new $.OfficialWebsiteHelper(this),
                freUsed:new $.FreUsedHelper(this),
                autoBackup:new $.AutoBackupHelper(this),
                privilege: new $.PrivilegeHelper(this),
            };
        };

    };
    new Client().run();
    
})(jsu);