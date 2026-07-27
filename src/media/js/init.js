($ => {
    "use strict";

    const Onboarding = function () {

        let configChanged = false;
        
        const configData = {};

        /*
         * ################################
         * PUBLIC
         * ################################
         */

        this.elm = {
            body: $("body"),
            title: $("head > title")
        };

        /**
         * Constructor
         */
        this.run = () => {
            
            initHelpers();
            
            //加载
            const loader = this.helper.template.loading().appendTo(this.elm.body);
            loader.addClass($.cl.loading);
            
            //loading
            this.elm.body.addClass($.cl.initLoading);

			//数据初始化
            this.helper.dao.init().then(() => {
                return this.helper.i18n.init();
            }).then(() => {
            	
            	const toggleArea=this.helper.dao.getDefaults().b.toggleArea;

				this.helper.fontAdd.init();
				this.helper.fontAdd.addStylesheet($(document));//添加字体

				//字符串替换
                this.helper.i18n.parseHtml(document);

                //出去text并转移到title
                let i=0;
                $("section." + $.cl.onboarding.slide + "[" + $.attr.name + "='choose'] > div.ball > div").children("a").forEach((_self) => {
                    const aTag = $(_self);
                    aTag.attr($.attr.title,aTag.html());
                    aTag.html(this.helper.util.initCircle());//clear
                    aTag.removeClass($.cl.active);
                    if(i==0){
                    	aTag.addClass($.cl.active);
                    }
                    
                    aTag.css("width",toggleArea.width+"px");
                    aTag.css("height",toggleArea.height+"px");
                    
                    //即时存储
					configData['width']=parseInt(toggleArea.width+"");
					configData['height']=parseInt(toggleArea.height+"");
                    
                    i++;
                });

                this.elm.title.text(this.elm.title.text() + " - " + this.helper.i18n.get("extension_name"));
				
				//加入css
                return this.helper.styleHelper.addStylesheets(["init"], $(document));
            }).then(() => {
            	
            	//完成，去除building
                this.elm.body.removeClass($.cl.building);

                initGeneralEvents();
                initIntroEvents();
                initChooseEvents();
                initIndicatorStyleEvents();
                initFinishEvents();

                $.delay(500).then(() => {
                    this.elm.body.removeClass($.cl.initLoading);
                    gotoSlide("welcome");
                    return $.delay(300);
                }).then(() => {
                    loader.remove();
                });
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
                i18n: new $.I18nHelper(this),
                fontAdd: new $.FontAddHelper(this),
                styleHelper: new $.StyleHelper(this),
                template: new $.TemplateHelper(this),
                util:new $.UtilHelper(this),
                dao: new $.DaoHelper(this)
            };
        };

        /**
         * Initialises the general eventhandlers
         */
        const initGeneralEvents = () => {
            $(window).on("beforeunload", () => { // reinitialize the other tabs after changing any configuration
                if (configChanged) {
                    this.helper.dao.call("reinitialize");
                }
            });
        };

        
        /**
         * Initialises the eventhandlers for the intro slide
         */
        const initIntroEvents = () => {
            $("section." + $.cl.onboarding.slide + "[" + $.attr.name + "='welcome'] a.go").on("click", (e) => {
                e.preventDefault();
                gotoNextSlide();
            });
        };
        
        /**
         * Shows the next slide
        */
        const gotoNextSlide = () => {
            const name = $("section." + $.cl.onboarding.slide + "." + $.cl.visible).next("section." + $.cl.onboarding.slide).attr($.attr.name);
            gotoSlide(name);
        };
        
        
        /**
         * Initialises the eventhandlers for the intro slide
         */
        const initChooseEvents = () => {
            $("section." + $.cl.onboarding.slide + "[" + $.attr.name + "='choose'] > div.ball > div.choose >  a").on("click", (e) => {
               
                e.preventDefault();
                
                $("section." + $.cl.onboarding.slide + "[" + $.attr.name + "='choose'] > div.ball > div.choose > a").removeClass($.cl.active);

				const elm = $(e.target);
				
				elm.addClass($.cl.active);
            });
        };
        
        /**
         * Initialises the eventhandlers for the intro slide
         */
        const initBallSizeEvents = () => {
            $("section." + $.cl.onboarding.slide + "[" + $.attr.name + "='size'] > div > a").on("click", (e) => {
               
                e.preventDefault();

                $("section." + $.cl.onboarding.slide + "[" + $.attr.name + "='size'] > div > a").removeClass($.cl.active);

				const elm = $(e.target);
				
				//即时存储
				configData['width']=parseInt(elm.css("width").replace("px",""));
				configData['height']=parseInt(elm.css("height").replace("px",""));
				
				elm.addClass($.cl.active);
            });
        };
       
        /**
         * Initialises the eventhandlers for the last slide
         */
        const initIndicatorStyleEvents = () => {
            $("section." + $.cl.onboarding.slide + " a.next-step").on("click", (e) => {
                e.preventDefault();

                const elm = $(e.target);
                
                let type=elm.prev("div").find("a."+$.cl.active).attr($.attr.type);
                initBallSize(type);//ball size
                initBallSizeEvents();//监听事件
                
                type=type.slice(0,1).toUpperCase() +type.slice(1).toLowerCase();

                const styles = this.helper.dao.getData("a/styles");
                styles.indicatorStyle=styles.indicatorColor["indicator"+type];

                this.helper.dao.setData({
                    "a/styles": styles
                }).then(() => {
                    configChanged = true;
                }).then(()=>{
                	this.helper.dao.call("reload",//重新加载刷新
                		{
	            			scrollTop: true, 
	            			type: "Sort"
                		}
                	);
                }).then(()=>{
                	gotoNextSlide();
                })
            });
        };
        
        const initBallSize = (type) =>{
        	
        	$("section." + $.cl.onboarding.slide + "[" + $.attr.name + "='size'] > div").html("");
        	const data=this.helper.dao.getDefaults()
        	for(let i=data.b.minBall;i<=data.b.maxBall;i=i+10){
        		let a=$("<a></a>")
        				.attr($.attr.type,type)
        				.css("width",i+"px")
        				.css("height",i+"px")
        				.attr($.attr.title,i +"*"+ i)
        				.html(this.helper.util.initCircle());
        				
        		if(i==data.b.toggleArea.width){
        			a.addClass($.cl.active);
        		}
        		a.appendTo($("section." + $.cl.onboarding.slide + "[" + $.attr.name + "='size'] > div"));	
        	}
        }
        
        const saveStartConfig = (grantState)=>{
    		
            const toggleArea = this.helper.dao.getData("b/toggleArea");
            toggleArea.width=configData.width;
            toggleArea.height=configData.height;

            this.helper.dao.setData({
                "b/toggleArea": toggleArea
            }).then(() => {
                configChanged = true;
            }).then(()=>{
            	this.helper.dao.call("reload",//重新加载刷新
            		{
            			scrollTop: true, 
            			type: "Sort"
            		}
            	);
            }).then(()=>{
            	
            	//打开书签火星
            	if(grantState==0){
            		
	                this.helper.dao.call("openLink", {
	                    href: $.opts.website.main.official,
	                    newTab: false
	                });
	                
            	}
            	//对于已经授权或者无需授权的，打开美化页
            	else if(grantState==1 || grantState==2){
            		
            		this.helper.dao.call("openLink", {//打开美化页
	                    href: $.api.runtime.getURL("html/new_tab.html"),
	                    newTab: false
	                });
            	}
            });
        }
        
        const grantPermissionHelper = (type) =>{
        	
        	//未授权
        	let grantState=0;
        	
        	if(type==="1"){//只有1代表授权
                	
            	$.api.permissions.request({ //申请权限，覆盖新标签页和查询历史
                    permissions: ["tabs","history"]
                }, (granted) => {

					this.helper.util.setAsNewtab(false,null).then(()=>{
						if (granted) {
	                        this.helper.util.setAsNewtab(true,null).then(()=>{
	                        	grantState=1;//已授权
	                        	saveStartConfig(grantState);
	                        })
	                    }
					});    
                });
                
                return;
            }
        	
        	//overides
        	if(type==="2"){grantState=2;}
        	this.helper.util.setAsNewtab(false,null).then(()=>{
				saveStartConfig(grantState);
			});
        }
        
        /**
         * Initialises the eventhandlers for the last slide
         */
        const initFinishEvents = () => {
			
			//授权页面
       		$("section." + $.cl.onboarding.slide + " > div.grant > a.finish").on("click", (e) => {
                e.preventDefault();
                const type=$(e.target).attr($.attr.type);
                grantPermissionHelper(type);
            });
            
            //360或者无需授权的浏览器等提前完成
            $("section." + $.cl.onboarding.slide + " > a.finish").on("click", (e) => {
                e.preventDefault();
                const type=$(e.target).attr($.attr.type);
                grantPermissionHelper(type);
            });
        };

        /* Shows the slide with the given name
         *
         * @param {string} name
        */
        const gotoSlide = (name) => {
        	
        	//去除之前已经显示的
            const prevSlide = $("section." + $.cl.onboarding.slide + "." + $.cl.visible);
            prevSlide.removeClass($.cl.visible);

            $.delay(300).then(() => {
                const newSlide = $("section." + $.cl.onboarding.slide + "[" + $.attr.name + "='" + name + "']").addClass($.cl.visible);
                const num = newSlide.prevAll("section." + $.cl.onboarding.slide).length() + 1;

				//记录用户设置到哪个步骤了
                this.helper.dao.call("statistics", {
                    name: "action",
                    value: {name: "onboarding", value: num + "_" + name}
                });
            });
        };
    };

    new Onboarding().run();
})(jsu);