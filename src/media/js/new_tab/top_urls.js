($ => {
    "use strict";

    $.TopUrlsHelper = function (n) {

        /**
         *
         * @returns {Promise}
         */
        this.init = async () => {
            this.refreshEntries();
            initEvents();
        };

        /**
         * Initialises the entries for the menu
         */
        this.refreshEntries = () => {
        	
        	const entries = [];
        	
        	entries.push({
        		title:n.helper.i18n.get("new_tab_bookmark_manage"),
        		url:n.helper.util.getParsedUrl("chrome://bookmarks/"),
        		icon:$.api.runtime.getURL("media/img/icon/newtab/icon-bookmarks.png")
            });
            
            entries.push({
        		title:n.helper.i18n.get("header_toolbox_ucenter"),
        		url:$.api.runtime.getURL("html/manage.html#ucenter_basic"),
        		icon:$.api.runtime.getURL("media/img/icon/header/ucenter-white.png")
        	});

            n.elm.topUrls.children("ul").remove();
            const list = $("<ul></ul>").appendTo(n.elm.topUrls);
            
            const user = n.helper.user.getUser();

            if (entries && entries.length > 0) {
                entries.forEach((entry) => {
                    
                    const elm = 
                    $("<li></li>")
                    .appendTo(list);
                    
                    const link = $("<a></a>")
                    .addClass($.cl.newtab.link)
                    .data("href", entry.url)
                    .attr("href", entry.url)
                    .text(entry.title);
                    
                    
                    if(entry.icon){
                    	
                    	link.removeClass($.cl.newtab.link);

                    	const img=$("<img />").attr("src",entry.icon);
                    	let badge=null;
                    	if(user!=null && entry.icon.indexOf("ucenter")!==-1){
                    		
                    		elm.addClass($.cl.newtab.isLogin);
                    		img.attr("src",user.avatar);
                    		
                    		if(user.vipType>0){
                    			badge=$("<span></span>")
	                    		.attr({
	                    			[$.attr.title]:user.vipTypeDesc,
	                    			[$.attr.type]:user.vipType===1?"vip":"supervip"
	                    		})
	                    		.addClass($.cl.header.notify);
                    		}
                    		
                    		link
                    		.attr($.attr.title,user.username)
                    		.text("");
                    		
                    	}
                    	else{
	                    	link.addClass($.cl.newtab.icon);
                    	}
                    	
                    	link.prepend(img);
                    	if(badge){
                    		link.prepend(badge);
                    	}
                    }
                    
                    link.appendTo(elm);
                });
            }
        };

        /**
         * Initialises the eventhandler
         */
        const initEvents = () => {
            
            n.elm.topUrls.on("click auxclick", "> ul > li  > a", (e) => { // handle chrome urls -> regular clicking will be blocked

                e.preventDefault();
                
                if (e.button === 0 || e.button === 1) {
                    n.helper.dao.call("openLink", {
                        href: $(e.currentTarget).data("href"),
                        newTab: e.type === "auxclick",
                        position: n.helper.dao.getData("b/newTabPosition"),
                        active: e.type !== "auxclick"
                    });
                }
            });
        };
    };

})(jsu);