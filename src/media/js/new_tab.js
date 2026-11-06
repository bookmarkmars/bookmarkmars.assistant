($ => {
    "use strict";

    const Newtab = function () {

        /*
         * ################################
         * PUBLIC
         * ################################
         */

        this.elm = {
            body: $("body"),
            content: $("section#content"),
            topUrls: $("section#content > nav"),
            search: {
                wrapper: $("form#search"),
                field: $("form#search > input[type='text']"),
                submit: $("form#search > button[type='submit']"),
                engine: $("form#search > div.engine"),
            },
            grid: $("div#grid"),
            widgets: {
                wrapper: $("div#nt-widgets"),
                calendar: $("div#nt-widgets [data-nt-calendar]"),
                memo: $("div#nt-widgets [data-nt-memo]"),
                tools: $("div#nt-widgets [data-nt-tools]"),
            },
            toast: $("body > section#content > div.toast"),
        };

        /**
         * Constructor
         */
        this.run = () => {
        	
        	//360安全浏览器不支持新标签页
   			if($.is360SeBrowserV){return;}

            initHelpers();

            const loader = this.helper.template.loading().appendTo(this.elm.body);
            this.elm.body.addClass($.cl.initLoading).attr($.attr.id, $.opts.ids.page.newtab);

            this.helper.dao.init()
            .then(() => {
                
                this.helper.fontAdd.init();
                this.helper.fontAdd.addStylesheet($(document));//添加字体

                return Promise.all([
                    initIcon(),
                    this.helper.i18n.init(),
                    this.helper.styleHelper.addStylesheets(["basic","new_tab"], $(document)),//添加样式
                ]);
            })
            .then(()=>{//需要call函数，尽可能多的给时间建立连接
            	return this.helper.user.asyUserInfo();//同步数据
            }).then(() => {
            	
                this.helper.i18n.parseHtml(document);
                initHeroClock();
                
                return Promise.all(
                    [
                        this.getBackground(),
                        this.helper.grid.init(),
                        this.helper.search.init(),
                        this.helper.topUrls.init(),
                        this.helper.operate.init(),
                        this.helper.widgets.init(),
                        initEvents(),
                        $.delay(200),
                    ]
                );
            }).then(([background]) => {
                
                loader.remove();
                
                this.setBackground(background);
                this.elm.body.removeClass([$.cl.building, $.cl.initLoading]);
                $(window).trigger("resize");
                
              	if(this.elm.search.wrapper.hasClass($.cl.hidden) === false) {
                  this.helper.search.focusSearch();
              	}
              	
              	//统计
              	this.helper.dao.call("statistics", {
                    name: "action",
                    value: {name: "newtab", value:"loaded"}
                });
            });
        };

        /**
         * Reads the stored background image
         *
         * @returns {Promise}
         */
        this.getBackground = () => {

        	return new Promise((resolve) => {
        		
        		$.api.storage.local.get(["newtab_wallpaper"], (obj) => {//数量判断
        			
					resolve(obj.newtab_wallpaper!=null?obj.newtab_wallpaper:null);
					
				});
        	});
        };

        /**
         * Sets the given image as body background, if there is one available
         *
         * @param {string} background
         * @returns {Promise}
         */
        this.setBackground = (background) => {
        	
        	$.api.storage.local.set({
                newtab_wallpaper: background && background !== "none" ? background : null
            }, () => {
                $.api.runtime.lastError;
            });
            
            //为空则默认
            if (!background || background === "none") {
                background=$.api.runtime.getURL("media/img/manage/bg-free-3.jpg");
            }
            
            // Force a repaint so cycling always shows a visible change
            this.elm.body.css("background-image", "none");
            const url = background;
            $.delay(20).then(() => {
                this.elm.body.addClass($.cl.newtab.customBackground).css("background-image", "url(\"" + url + "\")");
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
                template: new $.TemplateHelper(this),
                confirm: new $.ConfirmHelper(this),
                subscribe: new $.SubscribeHelper(this),
                i18n: new $.I18nHelper(this),
                fontAdd: new $.FontAddHelper(this),
                styleHelper: new $.StyleHelper(this),
                util:new $.UtilHelper(this),
                checkbox:new $.CheckboxHelper(this),
                user:new $.UserHelper(this),
                catalog: new $.CatalogHelper(this),
                grid: new $.GridHelper(this),
                search: new $.SearchHelper(this),
                topUrls: new $.TopUrlsHelper(this),
                popup:new $.PopupHelper(this),
                operate: new $.OperateHelper(this),
                widgets: new $.WidgetsHelper(this)
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
         * Initialises the eventhandler
         */
        const initEvents = async () => {
        	
        	$.api.runtime.onMessage.addListener((message) => { // listen for events from the background script
                if (message && message.action && message.action === "reinitialize") { // sidebar has changed (e.g. due to saving configuration
                    location.reload(true);
                }
            });

            /*this.elm.body.on("click", (e) => {
                $.api.permissions.request({ //申请权限，覆盖新标签页和查询历史
                    permissions: ["tabs","history"]
                }, (granted) => {

					this.helper.util.setAsNewtab(false,null).then(()=>{
						if (granted) {
	                        this.helper.util.setAsNewtab(true,null);
	                    }
					});    
                });
            });*/
        };

        /**
         * Live clock / date / greeting on the beautification page
         */
        const initHeroClock = () => {
            const clockEl = document.querySelector("[data-nt-clock]");
            const dateEl = document.querySelector("[data-nt-date]");
            const greetEl = document.querySelector("[data-nt-greeting]");
            if (!clockEl || !dateEl || !greetEl) {
                return;
            }

            const lang = (this.helper.i18n.getLanguage() || "en").replace(/_/g, "-");
            const tick = () => {
                const now = new Date();
                try {
                    clockEl.textContent = now.toLocaleTimeString(lang, {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false
                    });
                    dateEl.textContent = now.toLocaleDateString(lang, {
                        weekday: "long",
                        month: "long",
                        day: "numeric"
                    });
                } catch (err) {
                    clockEl.textContent = [
                        String(now.getHours()).padStart(2, "0"),
                        String(now.getMinutes()).padStart(2, "0")
                    ].join(":");
                    dateEl.textContent = now.toDateString();
                }

                const h = now.getHours();
                let key = "new_tab_greeting_evening";
                if (h >= 5 && h < 12) {
                    key = "new_tab_greeting_morning";
                } else if (h >= 12 && h < 18) {
                    key = "new_tab_greeting_afternoon";
                } else if (h >= 18 && h < 22) {
                    key = "new_tab_greeting_evening";
                } else {
                    key = "new_tab_greeting_night";
                }
                greetEl.textContent = this.helper.i18n.get(key) || "";
            };

            tick();
            setInterval(tick, 1000);
        };

        /**
         * 初始化favicon
         *
         * @returns {Promise<void>}
         */
        const initIcon = async () => {
            
            const opts = this.helper.dao.getData(["n/faviconShape","n/faviconBackground", "n/faviconPadding"]);
            const imageData = await this.helper.dao.call("iconImageData", {
                name: opts.faviconShape,
                padding: opts.faviconPadding,
                background: opts.faviconBackground,
                asDataURL:true
            });

            $("<link />").attr({
                rel: "icon",
                href: imageData
            }).appendTo(document.head);
        };
    };
    
    new Newtab().run();

})(jsu);