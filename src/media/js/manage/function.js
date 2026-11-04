($ => {
    "use strict";

    $.FunctionHelper = function (s) {
    	
    	let languages = {};

        /**
         * Initialises the appearance settings
         *
         * @returns {Promise}
         */
        this.init = () => {
            
            return new Promise((resolve) => {
              		
          		//theme
            	const theme = s.helper.dao.getData("a/theme");
            	
            	//sytles
                const styles = s.helper.dao.getData("a/styles");
                
                //linkAction
                const linkAction = s.helper.dao.getData("b/linkAction");
                
                //override
                const newtab = s.helper.dao.getData("n/override");
                
                // language preference: keep "Follow browser" selected when unset/default
                $.api.storage.sync.get(["language"], (stored) => {
                    const language = (!stored.language || stored.language === "default")
                        ? "default"
                        : s.helper.i18n.getLanguage();
                
            	[{"newtab":newtab},{"language":language},{"theme":theme},{"styles":styles},{"linkAction":linkAction}].forEach(self => {
            	
                	Object.entries(self).forEach(([key, value]) => {
                		
                		//styles 展开
                		if(key==="styles"){

                			Object.entries(value).forEach(([k, v]) => {

                				if (k === "fontFamily") {
	                                v = v.replace(/(^'*)|('*$)/g, "");
	                                if (s.elm.select[k].children("option[value='" + v + "']").length() === 0) {
	                                    v = "default";
	                                }
	                                
	                                s.elm.select[k][0].value = v;
                        			s.elm.select[k].data("initial", v);
	                            }
                			});
                			
                		}else{
                			
                			s.elm.select[key][0].value = value;
                			s.elm.select[key].data("initial", value);
                		}
                	});
                });

				//初始化
                initEvents();
				
				//resize and resolve
                $(window).trigger("resize");
                
                resolve();
                });
            });
        };

        /**
         * Saves the appearance settings
         * @returns {Promise}
         */
        this.save = () => {
            return new Promise((resolve) => {
                
                const newConfig = getCurrentConfig();
                
                $.api.storage.sync.get(["appearance","language"], (conf) => {
                    
                    //存储的
                    conf.appearance = conf.appearance || {};

					//赋值新的
                    Object.entries(newConfig.appearance).forEach(([key, val]) => {
                        conf.appearance[key] = val;
                    });

                    $.api.storage.sync.set({appearance: conf.appearance}, () => {
                        $.api.storage.sync.get(["behaviour"], (obj) => {
                            const behaviour = obj.behaviour || {};
                            behaviour.linkAction = newConfig.behaviour.linkAction;
                            $.api.storage.sync.set({
                            	language: newConfig.lang,
                            	behaviour: behaviour
                            },() => {
                                resolve();
                            });
                        });
                    });
                });
            });
        };

        /**
         * Returns the current values of function
         *
         * @returns object
         */
        const getCurrentConfig = () => {
           
        	//sytles
            let styles = s.helper.dao.getData("a/styles");
            
            let lang = s.elm.select.language[0].value;
            if (lang === "default" || lang === s.helper.i18n.getUILanguage()) {
                lang = "default";
            }

            const ret = {
                behaviour: {
                   linkAction:s.elm.select.linkAction[0].value,
                },
                appearance: {
                   theme:s.elm.select.theme[0].value,
                   styles: {}
                },
                newtab:{
                	override:s.elm.select.newtab[0].value,
                },
                lang:lang
            };
            
            const themePalette = s.helper.dao.getThemeStyles(ret.appearance.theme);
            if(ret.appearance.theme==="default"){
            	
            	let defaultStyles = s.helper.dao.getData("a/styles",true);
            	
            	Object.keys(s.helper.dao.getThemeStyles("classcial")).forEach((key) => {
            		styles[key]=defaultStyles[key];
            	});
            }

            Object.keys(styles).forEach((key) => {

				//copy
            	ret.appearance.styles[key]=styles[key];
            	
            	//字体
            	if(key === "fontFamily"){
            		ret.appearance.styles[key]=s.elm.select[key][0].value;
            		if(ret.appearance.styles[key] !=="default"){
            			ret.appearance.styles[key] = "'" + ret.appearance.styles[key] + "'";
            		}
            	}

                if(themePalette && themePalette[key]){
                	ret.appearance.styles[key]=themePalette[key];
                }
                             
                //indicatorStyle
                if(key === "indicatorStyle"){
                   ret.appearance.styles[key]=styles.indicatorColor["indicator"+s.getIndicatorType()];
                }
                
                //panelWidth
                if(key === "panelWidth"){
                	
                    let pu=s.getPanelWidth("panelWidth");
                    ret.appearance.styles["panelWidth"] = pu.w + pu.u;
                }
                
                if(key==="panelIconSize"){
                	
                	let pu=s.getPanelWidth("panelWidth");
					
					//set size
					ret.appearance.styles["panelIconSize"] = s.getPanelIconSize(pu) + pu.u;
                }
            });
            return ret;
        };
        
        const autoSaveNewtabConf = (val)=>{
        	
        	if(val && val==="true"){
    			$.api.permissions.request({ //申请权限，覆盖新标签页和查询历史
                    permissions: ["tabs","history"]
                }, (granted) => {
                	
                	s.helper.util.setAsNewtab(false,null).then(()=>{
                		if (granted) {
	                        s.helper.util.setAsNewtab(true,null);
	                    }
                	})
                });
    		}else{
    			s.helper.util.setAsNewtab(false,null);
    		}
        }

        /**
         * Initialises the eventhandlers
         */
        const initEvents = () => {

            s.elm.setting.content.find("select").on("change", (e) => {
                
                e.stopImmediatePropagation();
                const elm = $(e.currentTarget);
                const initialVal = elm.data("initial");
                let val = e.currentTarget.value;

                if (typeof initialVal !== "undefined") {

                    const box = $(e.currentTarget).parents("div." + $.cl.manage.box).eq(0);
                    if (val !== initialVal) {
                    	
                    	if (box.children("a." + $.cl.manage.revert).length() === 0) {
                            $("<a href='#'></a>").addClass($.cl.manage.revert).data("elm", box).appendTo(box);
                        }
               
               			if(elm.parent("div.box").hasClass("auth-newtab")){
               				autoSaveNewtabConf(val);
               			}
                    	
                    } else {
                        box.children("a." + $.cl.manage.revert).remove();
                    }
                }
            });

            s.elm.setting.content.on("click", "a." + $.cl.manage.revert, (e) => { // revert the changes of the specific field
                e.preventDefault();
                $(e.currentTarget).parent("div." + $.cl.manage.box).find("select").forEach((elm) => {
                    
                    const elmObj = $(elm);
                    const value = elmObj.data("initial");

					if (typeof value !== "undefined") {
                        elm.value = value;
                        elmObj.trigger("change");
                    }
                });
            });
        };
    };

})(jsu);