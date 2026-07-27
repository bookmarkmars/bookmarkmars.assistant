($ => {
    "use strict";

    $.BallHelper = function (s) {

        /**
         *
         * @returns {Promise}
         */
        this.init = async () => {
            
            await initBall();
            
            initChooseEvents();
        };


        /**
         * Displays the given tip/trick by hiding the currently displayed first and then render the new one
         *
         * @param uid
         * @param obj
         */
        const initBall = () => {
        	
        	
        	const data=s.helper.dao.getData(["b/toggleArea","b/openWay"]);
        	const styles=s.helper.dao.getData("a/styles");

        	$.delay(100).then(() => {
                
                return new Promise((resolve) => {
                	
                	const hit=(color)=>{
                		
                		if(color===styles.indicatorStyle){
                			return true;
                		}
                		
                		return false;
                	}
                	 
                	s.elm.setting.style
                	 .find("div.choose")
                	 .children("a")
                	 .forEach((_self) => {
                		
                		const aTag = $(_self);
		                aTag.attr($.attr.title,aTag.html());
		                aTag.html(s.helper.util.initCircle());//clear
		               
		                let type=aTag.attr($.attr.type);
		                type=type.slice(0,1).toUpperCase() +type.slice(1).toLowerCase();
		                
		                aTag.removeClass($.cl.active);
		                if(hit(styles.indicatorColor["indicator"+type])){
		                	aTag.addClass($.cl.active);
		                }

		                aTag.css("width",data.toggleArea.width+"px");
		                aTag.css("height",data.toggleArea.height+"px");
		            });

		            resolve();
		            
                }).then(()=>{
	            	
	            	//默认选择
	            	["size"].forEach((field) => { // select
		                s.elm.select[field][0].value = data.toggleArea.width;
		        	});
		        	
		        	//打开方式
		        	s.elm.select["openWay"][0].value = data.openWay;

		        	//召唤面板宽度
		        	s.elm.range["panelWidth"][0].value = parseInt(styles.panelWidth);
		        	s.elm.range["panelWidth"].trigger("change");
            	});
         	});
        };
        
        
         /**
         * Initialises the eventhandlers for the intro slide
         */
        const initChooseEvents = () => {
        	
            s.elm.setting.style.find("div.choose").children("a").on("click", (e) => {
               
                e.preventDefault();
                
                const elm = $(e.target);
                
                if(elm.hasClass($.cl.active)){
                	return;
                }
                
                s.elm.setting.style.find("div.choose").children("a").removeClass($.cl.active);

				elm.addClass($.cl.active);
				
				s.elm.select["size"].trigger("change");//触发保存事件
            });
        };
        
        /**
         * Save the behaviour settings and the user language
         *
         * @returns {Promise}
         */
        this.save = () => {
            return new Promise((resolve) => {

                $.api.storage.sync.get(["behaviour", "appearance"], (conf) => {
                    

                    conf.behaviour.toggleArea = conf.behaviour.toggleArea || {};
                    conf.appearance.styles = conf.appearance.styles || {};
                    conf.appearance.styles.indicatorColor=conf.appearance.styles.indicatorColor||{};
                    
					//默认值
					let defaults=s.helper.dao.getDefaults();
                    if(JSON.stringify(conf.appearance.styles.indicatorColor) === '{}'){
                    	conf.appearance.styles.indicatorColor=defaults.a.styles.indicatorColor;
                    }
                    conf.appearance.styles.panelWidth=defaults.a.styles.panelWidth;
                    conf.appearance.styles.panelIconSize=defaults.a.styles.panelIconSize;
                    
					//尺寸设置
                    ["width", "height"].forEach((field) => {
                        conf.behaviour.toggleArea[field] = s.elm.select['size'][0].value;
                    });
                    
                    //打开方式
                    conf.behaviour.openWay = s.elm.select['openWay'][0].value;
                    
                    //位置
                    conf.behaviour.toggleArea.top = typeof conf.behaviour.toggleArea["top"] !== "undefined"?conf.behaviour.toggleArea.top:defaults.b.toggleArea.top;

                    //召唤球颜色
                    const color=conf.appearance.styles.indicatorColor["indicator"+s.getIndicatorType()];
                    conf.appearance.styles["indicatorStyle"] = color;
                    
                    //召唤面板宽度(在function函数中也同时设置，否则设置被覆盖)
					let pu=s.getPanelWidth("panelWidth");
                    conf.appearance.styles["panelWidth"] = pu.w + pu.u;
                    
                    //icon 大小
					conf.appearance.styles["panelIconSize"] = s.getPanelIconSize(pu) + pu.u;

                    $.api.storage.sync.set({
                       appearance: conf.appearance, 
                       behaviour: conf.behaviour
                    }, () => {
                        $.delay(1500).then(() => {
                            location.reload(true);
                        });
                        resolve();
                    });
                });
            });
        };
    };

})(jsu);