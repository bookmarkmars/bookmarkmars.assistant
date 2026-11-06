($ => {
    "use strict";

    $.OperateHelper = function (n) {

        const LOCAL_WALLPAPERS = () => [1, 2, 3].map((i) =>
            $.api.runtime.getURL("media/img/manage/bg-free-" + i + ".jpg")
        );

        /**
         *
         * @returns {Promise}
         */
        this.init = async () => {

            const tools = $("<div></div>").addClass("nt-tools").appendTo(n.elm.body);

        	$("<a></a>").attr($.attr.title,n.helper.i18n.get("new_tab_setting")).addClass($.cl.newtab.setting).appendTo(tools);
            
            $("<a></a>").attr($.attr.title,n.helper.i18n.get("new_tab_bg_server_change")).addClass($.cl.newtab.imgChange).appendTo(tools);
            
            $("<a></a>")
            .attr($.attr.title,n.helper.i18n.get("new_tab_bg_upload_change"))
            .addClass($.cl.newtab.uploadImg)
            .appendTo(tools);
            
            $("<a></a>").attr($.attr.title,n.helper.i18n.get("new_tab_link_edit")).addClass($.cl.newtab.linkChange).appendTo(tools);
            
            initEvent(tools);
        };
        
        const initEvent = (tools)=>{
        	
        	initSetting(tools);
        	
        	initSearchConfig();
            
            initBgChange(tools);
            
            initLinkChange(tools);
            
            initUploadBg(tools);
            
            setUploadImgBg(tools);
        }
        
        const initSetting = (tools)=>{
            // Bind directly on the button (no delegation) — more reliable with mask icons
        	tools.find("a."+$.cl.newtab.setting).on("click",(e) => {
        		
        		e.preventDefault();
        		e.stopPropagation();
                
                const obj=$(e.currentTarget);
                const items=[$.cl.newtab.imgChange,$.cl.newtab.uploadImg,$.cl.newtab.linkChange];
                
                if(!obj.hasClass($.cl.active)){
                	obj.addClass($.cl.active);
                	items.forEach(cl=>{
                		tools.find("a."+cl).css("display","block");
                	});
                }else{
                	obj.removeClass($.cl.active);
                	items.forEach(cl=>{
                		tools.find("a."+cl).css("display","none");
                	});
                }
        	});
        }
        
        const initLinkChange = (tools)=>{
        	tools.find("a."+$.cl.newtab.linkChange).on("click",(e) => {
        		e.preventDefault();
        		e.stopPropagation();
                n.helper.popup.create("link", n.helper.i18n.get("new_tab_link_edit_headline"));
        	});
        }
        
        const initUploadBg = (tools)=>{
        	
            tools.find("a."+$.cl.newtab.uploadImg).html("");
            
            if(tools.find("input[type='file']").length() < 1){
            	tools.find("a."+$.cl.newtab.uploadImg)
            	.html("<input type=\"file\" accept=\"image/*\" />");
            }
        }
        
        const setUploadImgBg = (tools)=>{
        	
        	const wapper=tools.find("input[type='file']");
        	let wallpaperAllowed = false;

        	wapper.off("click").on("click", (e) => {
        		if (wallpaperAllowed) {
        			return;
        		}
        		e.preventDefault();
        		const input = e.currentTarget;
        		n.helper.dao.call("checkFeature", {feature: "wallpaper"}).then((res) => {
        			if (!res || res.allowed) {
        				wallpaperAllowed = true;
        				input.click();
        			} else {
        				const href = res.subscribeUrl || ($.opts.website.main.official + $.opts.website.scope + $.opts.website.servletMain.vip);
        				n.helper.subscribe.show("wallpaper", href);
        			}
        		});
        	});

        	wapper.off("change").on("change",(e) => {

	            if (e.currentTarget.files) {
	                
	                try{
	                	const reader = new FileReader();
		                reader.onload = (ev) => {
		                    try {
		                        n.setBackground(ev.target.result);
		                    } catch (err) {console.log(err);}
		                };
		                reader.readAsDataURL(e.currentTarget.files[0]);
	                }catch (err) {console.log(err);}

	            }
	        });
        }

        /**
         * Cycle to the next wallpaper in the list
         *
         * @param {string[]} list
         */
        const applyNextWallpaper = (list) => {
            if (!list || !list.length) {
                n.setBackground(null);
                return;
            }

            n.getBackground().then((wallpaper) => {
                let index = 0;
                if (wallpaper) {
                    const found = list.indexOf(wallpaper);
                    index = found >= 0 ? found + 1 : 0;
                }
                if (index >= list.length) {
                    index = 0;
                }
                // Skip if same URL (e.g. single-item list)
                if (list[index] === wallpaper && list.length > 1) {
                    index = (index + 1) % list.length;
                }
                n.setBackground(list[index]);
            });
        };

        const parseBebeauty = (text) => {
        	if (!text || typeof text !== "string") {
        		return null;
        	}
        	try {
        		return JSON.parse(text);
        	} catch (err) {
        		try {
        			return JSON.parse(text.replace(/,\s*([}\]])/g, "$1"));
        		} catch (err2) {
        			return null;
        		}
        	}
        };

        const bebeautyPics = (res) => {
        	if (!res) {
        		return [];
        	}
        	let payload = res;
        	if (typeof res.data === "string") {
        		payload = parseBebeauty(res.data) || res;
        	} else if (res.data && typeof res.data === "object") {
        		payload = res.data;
        	}
        	let pics = Array.isArray(payload.pics) ? payload.pics : [];
        	if (!pics.length && typeof res.data === "string") {
        		pics = res.data.match(/https?:\/\/[^"'\s,\]]+/g) || [];
        	}
        	return pics.filter((url) => !!url);
        };

        const wallpaperList = (res) => {
        	const seen = new Set();
        	const list = [];
        	LOCAL_WALLPAPERS().concat(bebeautyPics(res)).forEach((url) => {
        		if (!url || seen.has(url)) {
        			return;
        		}
        		seen.add(url);
        		list.push(url);
        	});
        	return list;
        };

        const initBgChange = (tools)=>{
        	
        	tools.find("a."+$.cl.newtab.imgChange).on("click",(e) => {
                
                e.preventDefault();
                e.stopPropagation();

            	n.helper.dao.call("getValue",{key:"bebeauty"})
	            .then((res) => {
	            	applyNextWallpaper(wallpaperList(res));
	            })
                .catch(() => {
                    applyNextWallpaper(LOCAL_WALLPAPERS());
                });
            });
        }

        /**
         * Initialises the edit button for the search engine and the dropdown to show/hide the search field
         */
        const initSearchConfig = () => {

            if (n.helper.search.usesBrowserSearch && n.helper.search.usesBrowserSearch()) {
                return;
            }

            n.elm.search.engine.on("click",(e) => {
                e.preventDefault();
                e.stopPropagation();
                n.helper.popup.create("searchEngine", n.helper.i18n.get("new_tab_search_engine_headline"));
            });
        };
    };

})(jsu);
