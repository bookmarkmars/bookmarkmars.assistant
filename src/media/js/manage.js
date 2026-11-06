($ => {
    "use strict";

    const Manage = function () {

        this.elm = {
            body: $("body"),
            title: $("head > title"),
            section: $("body > section#wrapper"),
            aside: $("body > section#wrapper > aside"),
            content: $("body > section#wrapper > main"),
            toast: $("body > section#wrapper > div.toast"),
            buttons: {
                save: $("body > section#wrapper > footer > menu > li > button.save"),
                recovery: $("body > section#wrapper > footer > menu > li > button.recovery"),
            },
            setting: {
                "style": $("div.tab[data-name='setting'] div.ball-style"),
                 content: $("div.tab[data-name='setting'] div[data-name='function'] > div.box-wrapper"),
            },
            bookmarkManager: { //定义书签管理
                content: $("div.tab[data-name='tool'] div[data-name='iexport'] > div.bookmarks"), //bookmarkManager
                operate: $("div.tab[data-name='tool'] div[data-name='iexport'] > div.bookmarks > div.opreate"), //操作
                ieport: $("div.tab[data-name='tool'] div[data-name='iexport'] > div.bookmarks > div.ieport"), //导入导出
            },
            backup: {
            	all:$("div.tab[data-name='tool'] div[data-name='backup']"),
                content:$("div.tab[data-name='tool'] div[data-name='backup'] > div.content-box"),//backup
            },
            formElement: $("div.form-element"),
            check: {
            	content:$("div.tab[data-name='tool'] div[data-name='linkcheck'] > div.content-box"),
                folderBox: $("div.tab[data-name='tool'] div[data-name='linkcheck'] > div.content-box > ul.all-bookmarks"),
            },
            ucenter:{
            	user:$("div.tab[data-name='ucenter'] > div[data-name='basic'] section[data-type='user']"),
            	motto:$("div.tab[data-name='ucenter'] > div[data-name='basic'] section[data-type='motto']")
            },
            footer: $("body > section#wrapper > footer"),
            about:$("div.tab[data-name='about'] > div[data-name='intro']"),
            preview: {},
            checkbox: {},
            range: {},
            select: {},
            color: {},
            textarea: {},
            field: {},
            radio: {}
        };
        
        let unsavedChanges = false;

        /**
         * Constructor
         */
        this.run = () => {
            initHelpers();
            const loader = {
                body: this.helper.template.loading().appendTo(this.elm.body)
            };
            this.elm.body.addClass($.cl.initLoading);

            this.helper.dao.init()
            .then(()=>{
            	return this.helper.asyUser.init();//同步数据
            }).then(() => {

                return this.helper.i18n.init();
            }).then(() => {
                
                this.elm.body.parent("html");
                
                this.helper.fontAdd.init();
                this.helper.fontAdd.addStylesheet($(document));//添加字体

                return Promise.all([
                    this.helper.form.init(),//翻译form
                    this.helper.styleHelper.addStylesheets(["manage"], $(document))
                ]);
            }).then(() => {
                this.elm.body.removeClass($.cl.building);


                this.helper.i18n.parseHtml(document);
                this.elm.title.text(this.elm.title.text() + " - " + this.helper.i18n.get("extension_name"));

                return this.helper.menu.init();
            }).then(()=>{
            	return this.helper.backup.init();//网络信息有限同步
            }).then(() => {
                return Promise.all([
                	this.helper.entry.init(),//初始化
                    this.helper.ball.init(),
                    this.helper.bookmarkManager.init(),
                    this.helper.check.init(),
                    this.helper.fun.init(),
                    this.helper.about.init(),
                    this.helper.ucenter.init(),
                ]);
            }).then(() => { // initialise events and remove loading mask
                
                initEvents();
                
                loader.body.remove();
                this.elm.body.removeClass($.cl.initLoading);
            });
        };

        /**
         * Shows the given success message for 1.5s
         *
         * @param {string} i18nStr
         */
        this.showSuccessMessage = (i18nStr) => {
            
            unsavedChanges = false;
            
            this.elm.body.attr($.attr.settings.success, this.helper.i18n.get("manage_" + i18nStr));
            this.elm.body.addClass($.cl.success);
            removeEventListener("beforeunload", this.beforeUnloadListener, {capture: true});

            $.delay(1500).then(() => {
                this.elm.body.removeClass($.cl.success);
            });
        };
        
        this.beforeUnloadListener = (event) => {
		  	event.preventDefault();
		  	return event.returnValue = this.helper.i18n.get("manage_beforeunload_desc");//chrome不执行，很无奈
		};

        /**
         * Highlights the save button to indicate, that there are unsaved changes
         */
        this.highlightUnsavedChanges = () => {
            if (unsavedChanges === false) {
                this.elm.buttons.save.addClass([$.cl.manage.highlight]);

                $.delay(1000).then(() => {
                    this.elm.buttons.save.removeClass($.cl.manage.highlight);
                });
                unsavedChanges = true
            }
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
                checkbox: new $.CheckboxHelper(this),
                template: new $.TemplateHelper(this),
                confirm: new $.ConfirmHelper(this),
                i18n: new $.I18nHelper(this),
                fontAdd: new $.FontAddHelper(this),
                styleHelper: new $.StyleHelper(this),
                menu: new $.MenuHelper(this),
                form: new $.FormHelper(this),
                ball: new $.BallHelper(this),
                backup: new $.BackupHelper(this),
                util:new $.UtilHelper(this),
                official:new $.OfficialWebsiteHelper(this),
                bookmarkManager: new $.BookmarkManagerHelper(this),
                user:new $.UserHelper(this),
                check:new $.LinkCheckerHelper(this),
                scroll:new $.ScrollHelper(this),
                entry:new $.EntryHelper(this),
                bookmark:new $.BookmarkHelper(this),
                fun:new $.FunctionHelper(this),
                about:new $.AboutHelper(this),
                ucenter:new $.UcenterHelper(this),
                asyUser:new $.AsyUserHelper(this),
                privilege: new $.PrivilegeHelper(this),
                subscribe: new $.SubscribeHelper(this),
            };
        };
        
        this.createToast=(text,time=2)=>{

        	const toast=this.elm.toast;
        	toast.addClass($.cl.active);
        	toast.find("div.text").html(text);

        	let timeout = setTimeout(() => { // if the timeout is not getting cleared by the content script, the sidebar is not working -> show notification
                toast.removeClass($.cl.active);
            }, time*1000);
        }
        
         /**
         * Save the behaviour settings and the user language
         *
         * @returns {Promise}
         */
        this.autoSave = () => {

        	const saveState=()=>{
        		
        		return new Promise((resolve) => {
	        	    //常量
	        		const backupBox=this.elm.backup.content;
	        		const checkBox = this.elm.check.content;
	        		
	        		$.api.storage.sync.get(["behaviour"], (conf) => {
	    				
	    				const behaviour = conf.behaviour || {};
	    				behaviour.backupAuthorized = backupBox.find("div."+$.cl.manage.backup.authorize+">div[" + $.attr.type + "='checkbox']").hasClass($.cl.active);
	    				behaviour.autoBackup = backupBox.find("div."+$.cl.manage.backup.autoBackup+">div[" + $.attr.type + "='checkbox']").hasClass($.cl.active);
	    				behaviour.recordVisit=backupBox.find("div."+$.cl.manage.backup.recordVisit+">div[" + $.attr.type + "='checkbox']").hasClass($.cl.active);
						behaviour.powerfulCheck=checkBox.find("div."+$.cl.manage.linkchecker.powerfulCheck+">div[" + $.attr.type + "='checkbox']").hasClass($.cl.active);

						//自动备份必须功能授权
						if(behaviour.autoBackup){
							
							const bookmarkAmount = this.helper.entry.getAmount("bookmarks");
        					const maxAllow=this.helper.privilege.isLargeBookmark(bookmarkAmount);

							// VIP temporarily disabled — only require authorize + bookmark-count limit
							if(!behaviour.backupAuthorized || maxAllow.rs){
								
								backupBox.find("div."+$.cl.manage.backup.autoBackup+">div[" + $.attr.type + "='checkbox']").removeClass([$.cl.active,$.cl.checkbox.focus]);
								behaviour.autoBackup=false;
								
								let userMsg=this.helper.i18n.get("manage_tool_backup_auto_auth");

								if(maxAllow.rs){
									
									userMsg=this.helper.i18n.get("manage_tool_backup_auto_max",[maxAllow.max],false);
								}
								this.createToast(userMsg);
							}
						}

						const autoBox = backupBox.find("div."+$.cl.manage.backup.autoBackup+">div[" + $.attr.type + "='checkbox']");
						const gate = behaviour.autoBackup ? this.requireFeature("autoSync", "#tool_backup") : Promise.resolve(true);
						gate.then((allowed) => {
							if (!allowed) {
								autoBox.removeClass([$.cl.active,$.cl.checkbox.focus]);
								behaviour.autoBackup = false;
							}
						    $.api.storage.sync.set({behaviour: behaviour}, () => {resolve()});
						});
	        		});
	        	});
        	}
        	
        	saveState();//存储
        }
        
        /**
         * Resolves true when the feature can be used; otherwise shows the subscribe dialog.
         *
         * @param {string} feature sync | autoSync | linkCheck | exportHtml
         * @param {string|null} hash page to come back to after paying, e.g. "#tool_backup"
         * @returns {Promise<boolean>}
         */
        this.requireFeature = (feature, hash = null) => {
        	return this.helper.dao.call("checkFeature", {feature: feature}).then((res) => {
        		if (!res || res.allowed) {
        			return true;
        		}
        		this.showSubscribeDialog(feature, hash);
        		return false;
        	});
        };

        this.showSubscribeDialog = (feature = null, hash = null) => {
        	const href = this.openVipSug(this.helper.user.getExtensionReturnUrl(hash || location.hash || "#ucenter_basic")).attr("href");
        	this.helper.subscribe.show(feature, href);
        };

        this.openVipSug = (callback=null,recharge=false)=>{

			let href=$.opts.website.main.official + $.opts.website.scope + $.opts.website.servletMain.vip;
			if(callback!=null){
				href=href+"?callback="+encodeURIComponent(callback);
			}
			
        	return $("<a></a>")
    		.addClass($.cl.manage.chargeSug)
    		.attr("href",href)
    		.text(recharge?this.helper.i18n.get("user_vip_recharge_suggestion"):this.helper.i18n.get("user_vip_suggestion"));
        }
        
        this.getIndicatorType=()=>{
        	let type=this.elm.setting.style.find("div.choose").find("a.active").attr($.attr.type);
            type=type.slice(0,1).toUpperCase() +type.slice(1).toLowerCase();
            return type;
        }
        
        this.getPanelWidth=(field)=>{
        	
        	let pWidth=parseInt(this.elm.range[field][0].value);
            let pWidthUnit=this.elm.range[field].attr($.attr.settings.range.unit);
            return {
            	w:pWidth,
            	u:pWidthUnit
            }
            
        }
        
        this.getPanelIconSize=(pu)=>{
	        
            if(pu.w <= 12){
            	return 0;
           	}
            else if(pu.w>12 && pu.w <= 32){
            	return pu.w-5;
            }
            else if(pu.w>32 && pu.w <= 52){
            	return pu.w-10;
            }
            return pu.w-15;
        }

        /**
         * Initialises the eventhandlers
         *
         * @returns {Promise}
         */
        const initEvents = async () => {
            
            $.api.runtime.onMessage.addListener((message) => { // listen for events from the background script
                if (message && message.action && message.action === "reinitialize") {
                    $.delay(2000).then(() => {
                        unsavedChanges = false;
                        removeEventListener("beforeunload", this.beforeUnloadListener, {capture: true});
                        location.reload(true);
                    });
                }
            });


            $("img[loading='lazy']").on("load", (e) => { // add class for lazyloaded images
                $(e.currentTarget).addClass($.cl.manage.lazyloaded);
            }).forEach((img) => { // add the class for all already loaded images as well
                if (img.complete && img.naturalHeight !== 0) {
                    $(img).addClass($.cl.manage.lazyloaded);
                }
            });

			//第一次选择，save按钮发生变化
            $("input, textarea, select").on("keyup change input", (e) => { // highlight save button the first time something got changed

				const styles=this.helper.dao.getData("a/styles");
				let initPanelWidth=false;
				if($(e.target).parent("div.box").hasClass("panel-width") && parseInt(this.elm.range["panelWidth"][0].value) ===parseInt(styles.panelWidth)){
					initPanelWidth=true;
				}

				//newtab 自动保存
				if(
					!$(e.target).parent("div.box").hasClass("auth-newtab") &&
					!initPanelWidth
				){
					this.highlightUnsavedChanges();
				}

            	if($(e.target).attr($.attr.name)==="powerfulCheck" || $(e.target).attr($.attr.name)==="authorize" || $(e.target).attr($.attr.name)==="autoBackup" || $(e.target).attr($.attr.name)==="recordVisit"){
            		
            		this.autoSave();
            	}
            	else if(initPanelWidth){
            		;//do nothing，值未改变
            	}
            	else if(unsavedChanges){//有未保存的内容
            		addEventListener("beforeunload", this.beforeUnloadListener, {capture: true});//监听
            	}
            	
            });

            $(document).on("click", () => {
                $("div." + $.cl.manage.dialog).removeClass($.cl.visible);
            });
            
            //请先登录
            this.elm.section.on("click", "div." + $.cl.manage.backup.mask+">div.go", (e) => {
               this.helper.user.login(location.hash || "#ucenter");
            });

			//保存
            this.elm.buttons.save.on("click", (e) => { // save button
                e.preventDefault();
                
				Promise.all([
                    this.helper.ball.save(),
                    this.helper.fun.save(),
                ]).then(() => {
                    this.showSuccessMessage("saved_message");
                    return this.helper.dao.call("reinitialize");
                }).then(() => {
                    this.helper.dao.call("reloadIcon");
                    return this.helper.dao.init();
                });
            });
        };
    };

    new Manage().run();
})(jsu);