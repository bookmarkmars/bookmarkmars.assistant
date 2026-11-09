($ => {
    "use strict";

    $.NewtabHelper = function (b) {

        let config = {};
        
        let inited = false;

        /**
         *
         * @returns {Promise}
         */
        this.init = () => {
            return new Promise((resolve) => {
                this.updateConfig().then(() => {
                	inited = true;
                    initEvents();
                    resolve();
                });
            });
        };
        
        this.getConfig = ()=> config;

        /**
         * Reloads all extension new tab pages
         */
        this.reload = () => {
            $.api.tabs.query({}, (tabs) => {
                tabs.forEach((tab) => {
                    if(tab){
                        this.openNewTab(tab);
                    };
                });
            });
        };

        /**
         * Retrieves the configuration about the new tab replacement from the storage
         */
        this.updateConfig = () => {
            
            return new Promise((resolve) => {
                $.api.storage.sync.get(["newtab"], (obj) => {
                	
                    if (typeof obj.newtab === "undefined") {
                        config = {};
                    } else {
                        config = obj.newtab;
                    }
                    resolve();
                });
            });
        };
        
        const allowNewTab = (url)=>{
        	
        	if (url && ["://newtab","://startpage","chrome-search://"].some(e => url.indexOf(e) !== -1)){
        	
                if (typeof config.override !== "undefined" && config.override === true) {
                	return true;
                }
            }
        	return false;
        }
        
        /**
         * Update the url of the given tab
         *
         * @param tabId
         * @param url
         * @param retry
         */
        const updateTab = (tabId, url, retry = 0) => {
            
            $.api.tabs.update(tabId, {url: url, active: true}, async () => {
                
                const tab = await $.api.tabs.get(tabId);
                const actualUrl = tab.pendingUrl || tab.url;
                
                if (!actualUrl || !actualUrl.startsWith(url)) {
                    // workaround since mv3 (for some reason) does not always update the url
                    if (retry < 300) {
                        setTimeout(() => {
                            updateTab(tabId, url, retry + 1);
                        }, 20);
                    } else {
                        console.error("Override new tab error");
                    }
                }
            });
        };
        
         /**
         * Remove the given tab
         *
         * @param tabId
         * @param retry
         */
        const removeTab = (tabId, retry = 0) => {
            
            $.api.tabs.remove(tabId, () => {
                if ($.api.runtime.lastError) {
                    // workaround since mv3 (for some reason) does not always want to delete the tab on the first try
                    if (retry < 200) {
                        setTimeout(() => {
                            removeTab(tabId, retry + 1);
                        }, 20);
                    } else {
                        console.error("Remove new tab error");
                    }
                }
            });
        };
        
        
        this.openNewTab = (tab, retry = 0)=>{
        	
        	//使用接口覆盖的，全部返回不执行，chrome政策调整，凡是接口支持的，其他实现方式全为非法
        	if(!!$.opts.manifest.chrome_url_overrides){return;}
        	
        	if (!inited) { //还没有初始化，则多次尝试
                if (retry < 200) {
                    setTimeout(() => {
                        this.openNewTab(tab, retry + 1);
                    }, 5);
                } else {
                    console.error("Create new tab error");
                }
                return;
            }
        	
        	const href = tab.url || tab.pendingUrl;

        	if(allowNewTab(href)){
                    	
            	let url = $.api.runtime.getURL("html/new_tab.html");

                if (config.website && config.website.length > 0) {
                    url = addParameterToUrl(config.website, "bs_nt", 1);
                }
                
                 //只对chrome/edge/oprea生效，360不生效，
                 //新版edge $.api.tabs.remove不生效，采用update
                 if (config.focusOmnibox || tab.index === 0) {
                 	if ($.browserName!=="Others") {
                 		
                 		//Edge 浏览器会有冲突事件，放弃首页update
                 		if(tab.index === 0 && $.browserName==="Edge"){
                 			;
                 		}
                 		else{
                 			updateTab(tab.id, url);
                 		}
                 	}
                 }else {
                	
                	if(tab.index>0){//必须大于0删除，否则自动关闭浏览器
                		removeTab(tab.id);
                	}

                    $.api.tabs.create({url: url, active: true},() => {
                        $.api.runtime.lastError;
                    });

                }
            }
        }
        
        /**
         * Initialises eventlistener for the new tab replacement
         *
         * @returns {Promise}
         */
        const initEvents = async () => {
        	
        	// Manifest already declares chrome_url_overrides.newtab — do not hijack tabs
        	// (Edge/Chrome policy 1.1.8 requires the standard API only)
        	if ($.opts.manifest.chrome_url_overrides) {
        		return;
        	}
			
            $.api.tabs.onCreated.addListener((tab) => {
				this.openNewTab(tab);
            });
            
        };

        /**
         * Adds a parameter to the given url,
         * maintains existing querystring and anchors
         *
         * @param {string} url
         * @param {string} key
         * @param {string|int} value
         * @returns {string}
         */
        const addParameterToUrl = (url, key, value) => {
            const re = new RegExp("([?&])" + key + "=.*?(&|#|$)", "i");
            if (url.match(re)) {
                return url.replace(re, "$1" + key + "=" + value + "$2");
            } else {
                let hash = "";
                if (url.indexOf("#") !== -1) {
                    hash = url.replace(/.*#/, "#");
                    url = url.replace(/#.*/, "");
                }
                const separator = url.indexOf("?") !== -1 ? "&" : "?";
                return url + separator + key + "=" + value + hash;
            }
        };
    };

})(jsu);