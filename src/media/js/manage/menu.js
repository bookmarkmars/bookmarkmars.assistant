($ => {
    "use strict";

    $.MenuHelper = function (s) {
        
        let running = false;
        let list = null;
        let currentPath = null;
        let currentPage = null;

        /**
         *
         * @returns {Promise}
         */
        this.init = () => {
            return new Promise((resolve) => {
            	
            	//logo
            	const logo=$("<a></a>")
            	.addClass($.cl.manage.logo)
            	.append("<span></span>")
            	.prependTo(s.elm.aside);
            	
            	//logo 处理：zh_CN / zh_TW 用中文 logo，其余语言一律用英文 logo
            	let bgLogo = $.api.runtime.getURL("media/img/logo/logo-manage-en.png");
            	const lang = s.helper.i18n.getLanguage();

            	if (lang) {
            		if (lang === "zh_CN" || lang.indexOf("zh_CN") > -1) {
            			bgLogo = $.api.runtime.getURL("media/img/logo/logo-manage.png");
            		} else if (lang === "zh_TW" || lang.indexOf("zh_TW") > -1) {
            			bgLogo = $.api.runtime.getURL("media/img/logo/logo-manage-zh-tw.png");
            		}
            	}
            	logo.find(">span").css("background-image","url("+bgLogo+")");
            	
                list = $("<ul></ul>").appendTo(s.elm.aside.children("nav"));
                let menuParsing = s.elm.content.children("div." + $.cl.manage.tabs.content).length();

                const menupointLoaded = () => {
                    menuParsing--;
                    if (menuParsing === 0) {
                        handleNavigationChange().then(() => {
                            resolve();
                        });
                    }
                };

                s.elm.content.children("div." + $.cl.manage.tabs.content).forEach((elm) => {
                    const name = $(elm).attr($.attr.name);
                    const entry = $("<li></li>").attr($.attr.name, name).html("<a href='#'>" + s.helper.i18n.get("manage_menu_" + name) + "</a>").appendTo(list);
                    const subTabs = $(elm).children("div[" + $.attr.name + "]");

                    if (subTabs.length() > 0) {
                        const subList = $("<ul></ul>").appendTo(entry);

                        subTabs.forEach((subElm) => {
                            const subName = $(subElm).attr($.attr.name);
                            const src = $(subElm).attr($.attr.src);

                            const subEntry = $("<li></li>")
                                .attr($.attr.name, subName)
                                .html("<a href='#'>" + s.helper.i18n.get("manage_menu_" + name + "_" + subName) + "</a>")
                                .appendTo(subList);

                            if (src) {
                                subEntry.attr($.attr.src, src);
                            }
                        });

                        $.delay(500).then(() => {
                            subList.children("li").forEach((elm) => {
                                $(elm).data("height", elm.scrollHeight);
                            });

                            menupointLoaded();
                        });
                    } else {
                        menupointLoaded();
                    }
                });
                
                openAllMenu();//全部展开
                
                initFooter();
                
                initEvents();
            });
        };
        
        const initFooter = () =>{

        	let btn=s.elm.footer.find("button.recovery");
        	btn.attr($.attr.title,btn.html()).html("");
        }

        this.getPath = () => currentPath;

        const handleNavigationChange = () => {
            return new Promise((resolve) => {
                const hash = location.hash ? location.hash.substr(1) : null;//截取short path

                if (hash) {
                    showPage(...hash.split("_"));
                } else {
                    list.find("a").eq(0).trigger("click");//否则第一个
                }

                $.delay(300).then(resolve);
            });
        };

        const initEvents = () => {
            
            list.find("a").on("click", (e) => {
                
                e.preventDefault();
                const elm = $(e.currentTarget).parent("li");
                const name = elm.attr($.attr.name);
                const src = elm.attr($.attr.src);
				
				if (src) {
					
					let href="";
					for(let u of src.split("|")){
						let rs=u.split(".");
						let obj=$.opts.website;
						for(let r of rs){obj=obj[r];}
						href+=obj;
					}

                    s.helper.dao.call("openLink", {
                        href: href,
                        newTab: true
                    });
                }else if (elm.parents("li").length() > 0) {//sub entry
                    const parentName = elm.parent("ul").parent("li").attr($.attr.name);
                    showPage(parentName, name);//长度为2
                } else {
                    showPage(name);
                }
            });
            
            s.elm.aside.find("a.logo").on("click", (e) => {
            	s.helper.dao.call("openLink", {
                    href: $.opts.website.main.official,
	                newTab: true
                });
            });

            $(window).on("popstate", () => {
                handleNavigationChange();
            });
        };

        const updateHeaderMenu = () => {
            const path = this.getPath();
            const pages = [
                s.elm.content.children("div." + $.cl.manage.tabs.content + "[" + $.attr.name + "='" + path[0] + "']")
            ];

            s.elm.header.attr($.attr.type, path[0]);

            if (path[1]) {
                pages.unshift(pages[0].children("div[" + $.attr.name + "='" + path[1] + "']"));
            }

            ["save", "restore"].forEach((type) => {
                pages.some((page) => {
                    const info = page.attr($.attr.settings[type]);
                    s.elm.buttons[type].addClass($.cl.hidden);

                    if (info) { // attribute is available
                        if (info !== "false") {
                            s.elm.buttons[type]
                                .html(info === "true" ? "" : s.helper.i18n.get(info))
                                .removeClass($.cl.hidden);
                        }

                        return true;
                    }
                });
            });
        };

        const hidePages = () => {
            list.find("li").removeClass($.cl.active);

            const allPages = s.elm.content.children("div." + $.cl.manage.tabs.content);
            allPages.removeClass($.cl.active);
            allPages.children("div[" + $.attr.name + "]").removeClass($.cl.active);
        };
        
        const openAllMenu = () =>{
        	
        	//all menu
        	list.children("li > ul").forEach((menu)=>{
	        	let num = $(menu).children("li:not(." + $.cl.hidden + ")").length();
	        	let height=num>0?$(menu).children("li:not(." + $.cl.hidden + ")").eq(0).attr("scrollHeight"):0;
	        	let listHeight = num * height;
	        	$(menu).css("height", listHeight + "px");
        	});
        }

        const showPage = (...path) => {
            return new Promise((resolve) => {
                if (!running) { // prevent popstate and event both running this method
                   	
                   	running = true;
                    let pathLen = path.length;
                    let menu = list.children("li[" + $.attr.name + "='" + path[0] + "']");
                    let page = s.elm.content.children("div." + $.cl.manage.tabs.content + "[" + $.attr.name + "='" + path[0] + "']");

                    if (page.length() === 0) { // invalid page -> redirect to startpage of the settings
                        location.href = location.protocol + "//" + location.host + location.pathname;
                        return;
                    }

                    page.find("img[" + $.attr.src + "]").forEach((_self) => { // load images of the visible page
                        const img = $(_self);
                        const src = img.attr($.attr.src);
                        img.removeAttr($.attr.src);
                        img.attr("src", src);
                    });

                    if (pathLen === 1 && page.find("> div[" + $.attr.name + "]").length() > 0) {
                        path.push(page.find("> div[" + $.attr.name + "]").eq(0).attr($.attr.name));
                        pathLen++;
                    }

                    const hash = path.join("_");
                    hidePages();//关闭其他

					//激活哪个menu，哪个page
                    for (let i = 1; i <= pathLen; i++) {
                        
                        const menuParent = menu.parent("ul");
                        if (menuParent && menuParent.length() > 0) {
                            
                            menu.addClass($.cl.active);
                            page.addClass($.cl.active);

                            if (i < pathLen) {
                                menu = menu.find("> ul > li[" + $.attr.name + "='" + path[i] + "']");
                                page = page.find("> div[" + $.attr.name + "='" + path[i] + "']");
                            }
                        }
                    }

                    s.elm.body.attr($.attr.type, hash);
                    
                    //登录才能使用
                    s.elm.body.removeClass($.cl.manage.needLogin);
                    if(!s.helper.user.isLogin()){
                    	if(s.helper.user.needLogin().some(e => e === hash)){
                    		s.elm.body.addClass($.cl.manage.needLogin);
                    	}
                    }
                    
                    location.hash = hash;
                    currentPage = page;
                    currentPath = path;

                    s.elm.content[0].scrollTop = 0;
                    
                    //决定是否展示footer
                    s.elm.footer.removeClass($.cl.active);
                    const register = s.elm.footer.attr($.attr.register).split(",");
                    register.forEach((item)=>{
                    	
                    	if(item===hash){
                    		s.elm.footer.addClass($.cl.active);
                    	}
                    	else if(item.endsWith("*")){
                    		if(hash.startsWith(item.replace("*",""))){
                    			s.elm.footer.addClass($.cl.active);
                    		}
                    	}
                    });

                    //clear padding
                    s.elm.content.css("padding-left", "");
                    
                    running = false;
                    resolve();
                    
                } else {
                  resolve();
                }
            });
        };
    };

})(jsu);