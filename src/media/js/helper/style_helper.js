($ => {
    
    "use strict";

    /**
     * @param {object} ext
     * @constructor
     */
    $.StyleHelper = function (ext) {
    	
    	 /**
         * Adds the stylesheets to the document
         *
         * @param {Array} files
         * @param {jsu} context
         */
        this.addStylesheets = (files, context = null,deft=false) => {
            
            return new Promise((resolve) => {
            
	            if (context === null) { // page context
	                context = $(document);
	            }
	
	            let head = null;
	            if (context.find("head").length() === 0) { // document does not have a head -> append styles to the body
	                head = context.find("body");
	            } else {
	                head = context.find("head");
	            }
	
	            this.readCss(files, head,deft).then(()=>{
	            	resolve();
	            });
	        });
        };

        this.readCss = (files, head, deft=false, scope=null) => {

	        return new Promise((resolve,reject) => {
	        	
	        	let loaded=0;
	        	const styles = Object.assign({}, ext.helper.dao.getData("a/styles", deft));
	        	if (ext.helper.dao.getThemeStyles) {
	        		const theme = ext.helper.dao.getData("a/theme");
	        		const palette = theme && theme !== "default" ? ext.helper.dao.getThemeStyles(theme) : null;
	        		if (palette) {
	        			Object.assign(styles, palette);
	        		} else if (!deft) {
	        			if (styles.hoverColor === "#908b8b66") {
	        				styles.hoverColor = "#ffffff7a";
	        			}
	        			if (styles.headerIconBackground === "#535553") {
	        				styles.headerIconBackground = "#dbcfcfcc";
	        			}
	        		}
	        	}
	        	if (!styles.manageMenuBackground) {
	        		styles.manageMenuBackground = "#322e2f";
	        	}
	        	if (!styles.manageBodyBackground) {
	        		styles.manageBodyBackground = "#f5f5f5";
	        	}
	        	if (!styles.manageCardBackground) {
	        		styles.manageCardBackground = "#efefef";
	        	}
	        	if (!styles.manageMenuText) {
	        		styles.manageMenuText = "#918f8f";
	        	}
	        	if (!styles.manageMenuTextActive) {
	        		styles.manageMenuTextActive = "#ccc";
	        	}
	        	if (!styles.manageAccent) {
	        		styles.manageAccent = "#322e2f";
	        	}

	            files.forEach((file) => {
	            	
	                $.fetch($.api.runtime.getURL("media/css/" + file + ".css")).then((res) => {
	                    
	                    res.text().then((data)=>{

                    		let css = data;
                    		const tokens = [];
                    		Object.keys(styles).forEach((key) => {

                    			if(typeof styles[key] === "object" ){
                    				Object.keys(styles[key]).forEach((k)=>{
                    					tokens.push([k, styles[key][k]]);
                    				});
                    			}else{
                    				
                    				if(key==="fontFamily"){
                    					styles[key]=styles[key].trim()==="default"?ext.helper.fontAdd.getDefaultFontFamily():styles[key];
                    				}
                    				
                    				if(key==="switchCloseTag" || key==="switchOpenTag"){
										let tag=key.indexOf("Open")!==-1?"open":"close";
                    					styles[key]="'"+ext.helper.i18n.get("manage_switch_"+tag+"_tag")+"'";
                    				}
                    				tokens.push([key, styles[key]]);
                    			}
                           });
                    		// Longer names first, and never match a name that is only the start of another.
                    		tokens.sort((a, b) => b[0].length - a[0].length);
                    		tokens.forEach((pair) => {
                    			const value = String(pair[1]);
                    			css = css.replace(new RegExp("\"?%" + pair[0] + "(?![A-Za-z0-9])\"?", "g"), () => value);
                    		});
                    		if (scope === "shadow") {
                    			css = css.replace(/body\s*>/g, ":host >");
                    			// The host does not take clicks. The visible ball must, or it cannot open.
                    			if ($.opts && $.opts.ids && $.cl && $.cl.toggle) {
                    				css += ":host > div#" + $.opts.ids.page.indicator + ":not(." + $.cl.hidden + ") > div." + $.cl.toggle.indicator + "{pointer-events:auto;}";
                    			}
                    		}
                    		if ($.cl &&  $.cl.page &&  $.cl.page.style && $.attr && $.attr.name) {
                                head.find("style." +  $.cl.page.style + "[" + $.attr.name + "='" + file + "']").remove();
                                if (scope === "shadow") {
                                	// Parse after the tag is inside the shadow root. :host is invalid
                                	// in a style tag built in the page, and those rules are dropped.
                                	const style = document.createElement("style");
                                	style.className = $.cl.page.style;
                                	style.setAttribute($.attr.name, file);
                                	head[0].appendChild(style);
                                	style.textContent = css;
                                } else {
                                	head.append("<style class='" +  $.cl.page.style + "' " + $.attr.name + "='" + file + "'>" + css + "</style>");
                                }
                            } else if (scope === "shadow") {
                            	const style = document.createElement("style");
                            	head[0].appendChild(style);
                            	style.textContent = css;
                            } else {
                                head.append("<style>" + css + "</style>");
                            }
                            
                            //loaded
                            loaded++;
		                    if (loaded >= files.length) {
		                        resolve();
		                    }
                    	});
	                }).catch(err => {});
	            });
	        });
	    };
	}

})(jsu);