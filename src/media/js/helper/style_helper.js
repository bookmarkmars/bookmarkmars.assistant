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

        this.readCss = (files,head,deft=false) => {

	        return new Promise((resolve,reject) => {
	        	
	        	let loaded=0;
	        	const styles = ext.helper.dao.getData("a/styles",deft);

	            files.forEach((file) => {
	            	
	                $.fetch($.api.runtime.getURL("media/css/" + file + ".css")).then((res) => {
	                    
	                    res.text().then((data)=>{

                    		let css = data;
                    		Object.keys(styles).forEach((key) => {

                    			if(typeof styles[key] === "object" ){
                    				Object.keys(styles[key]).forEach((k)=>{
                    					css = css.replace(new RegExp("\"?%" + k + "\"?", "g"),styles[key][k]);
                    				});
                    			}else{
                    				
                    				if(key==="fontFamily"){
                    					styles[key]=styles[key].trim()==="default"?ext.helper.fontAdd.getDefaultFontFamily():styles[key];
                    				}
                    				
                    				if(key==="switchCloseTag" || key==="switchOpenTag"){
										let tag=key.indexOf("Open")!==-1?"open":"close";
                    					styles[key]="'"+ext.helper.i18n.get("manage_switch_"+tag+"_tag")+"'";
                    				}
                    				css = css.replace(new RegExp("\"?%" + key + "\"?", "g"), styles[key]);
                    			}
                           });
                    		if ($.cl &&  $.cl.page &&  $.cl.page.style && $.attr && $.attr.name) {
                                head.find("style." +  $.cl.page.style + "[" + $.attr.name + "='" + file + "']").remove();
                                head.append("<style class='" +  $.cl.page.style + "' " + $.attr.name + "='" + file + "'>" + css + "</style>");
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