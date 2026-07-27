($ => {
    "use strict";

    $.UtilHelper = function (b) {

        const LOGIN_RETURN_KEYS = ["pendingLoginReturnUrl", "pendingLoginTabId"];
        const LOGIN_COOKIE = "cbx_dd";

        const clearLoginReturn = () => {
            $.api.storage.local.remove(LOGIN_RETURN_KEYS);
        };

        const isLoginPage = (url) => /\/login(\?|$|#)/i.test(url || "");

        const finishLoginReturn = (tabId, returnUrl) => {
            clearLoginReturn();
            // Allow next new-tab to pull cloud shortcuts immediately after login
            $.api.storage.local.get(["utility"], (obj) => {
                const utility = Object.assign({}, obj.utility || {});
                utility.shortcutsLastCheck = null;
                $.api.storage.local.set({utility: utility}, () => {
                    $.api.tabs.update(tabId, {url: returnUrl});
                });
            });
        };

        /**
         * After website login, bring the tab back into the extension manage page.
         */
        $.api.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.status !== "complete" || !tab || !tab.url) {
                return;
            }

            $.api.storage.local.get(LOGIN_RETURN_KEYS, (data) => {
                if (!data.pendingLoginReturnUrl) {
                    return;
                }

                const url = tab.url;
                const manageExt = $.api.runtime.getURL("html/manage.html");

                if (url.indexOf(manageExt) === 0) {
                    clearLoginReturn();
                    return;
                }

                if (data.pendingLoginTabId !== tabId || isLoginPage(url)) {
                    return;
                }

                const site = $.opts.website.main.official;
                $.api.cookies.get({url: site, name: LOGIN_COOKIE}, (cookie) => {
                    if (cookie && cookie.value) {
                        finishLoginReturn(tabId, data.pendingLoginReturnUrl);
                    } else {
                        clearLoginReturn();
                    }
                });
            });
        });

        /**
         * Open site login and remember where to return inside the extension.
         *
         * @param {object} opts
         * @param {string} opts.returnUrl chrome-extension://…/html/manage.html#…
         * @returns {Promise}
         */
        this.openLogin = (opts) => {
            return new Promise((resolve) => {
                const returnUrl = (opts && opts.returnUrl)
                    || ($.api.runtime.getURL("html/manage.html") + "#ucenter");
                const loginAddress = $.opts.website.main.official
                    + $.opts.website.servletMain.exclude.login
                    + "?callback=" + encodeURIComponent($.opts.website.main.official);

                const open = (tabId) => {
                    $.api.storage.local.set({
                        pendingLoginReturnUrl: returnUrl,
                        pendingLoginTabId: tabId
                    }, () => {
                        $.api.tabs.update(tabId, {url: loginAddress}, () => {
                            resolve();
                        });
                    });
                };

                if ($.is360XBrowserV) {
                    $.api.tabs.create({url: "about:blank", active: true}, (tab) => {
                        open(tab.id);
                    });
                } else {
                    $.api.tabs.query({active: true, currentWindow: true}, (tabs) => {
                        if (tabs && tabs[0] && tabs[0].id != null) {
                            open(tabs[0].id);
                        } else {
                            $.api.tabs.create({url: "about:blank", active: true}, (tab) => {
                                open(tab.id);
                            });
                        }
                    });
                }
            });
        };

        /**
         * Returns all history entries where the title or url are matching the given search value
         *
         * @param {object} opts
         * @returns {Promise}
         */
        this.getHistoryBySearchVal = (opts) => {
            return new Promise((resolve) => {
            	
                if ($.api.history) {
                    $.api.history.search({
                        text: opts.searchVal,
                        maxResults: 100
                    }, (results) => {
                        const searchValFiltered = opts.searchVal.toLowerCase();

                        results.sort((a, b) => { // sort the history entry to prefer entries where the search value is part of the label and the url, as well as pages, which were visited more often
                            const aScore = (a.title.toLowerCase().indexOf(searchValFiltered) > -1 ? 100 : 0) + (a.url.toLowerCase().indexOf(searchValFiltered) > -1 ? 50 : 0) + a.visitCount + a.typedCount;
                            const bScore = (b.title.toLowerCase().indexOf(searchValFiltered) > -1 ? 100 : 0) + (b.url.toLowerCase().indexOf(searchValFiltered) > -1 ? 50 : 0) + b.visitCount + b.typedCount;
                            return aScore - bScore;
                        });

                        resolve({history: results});
                    });
                } else {
                    resolve({history: []});
                }
            });
        };

        /**
         * treat some Chrome specific urls differently to make them work in Edge, Opera, ...
         *
         * @param url
         * @returns {string|null}
         */
        this.getParsedUrl = (url) => {
            if (!url) {
                return url;
            }

            if ($.opts.urlAliases[$.browserName] && $.opts.urlAliases[$.browserName][url]) {
                url = $.opts.urlAliases[$.browserName][url];
            }

            return url;
        };

        /**
         * Opens the given url while regarding the specified parameters
         *
         * @param {object} opts
         * @returns {Promise}
         */
        this.openLink = (opts) => {
            
            return new Promise((resolve) => {
                
                b.helper.viewAmount.addByEntry(opts);

                let params = "";
        	
        		//360安全浏览器不支持更新newtab，只能_blank方式打开
            	if($.is360XBrowserV){
            	   opts['newTab'] = true;
            	   opts['position'] = "afterCurrent";
            	}  

                if (opts.params) { // params are given -> serialize
                    params = Object.entries(opts.params).map(([key, val]) => {
                        return encodeURIComponent(key) + "=" + val;
                    }).join("&");

                    if (params) {
                        params = "?" + params;
                    }
                }

                const url = this.getParsedUrl(opts.href) + params;

                if (opts.newTab && opts.newTab === true) { // new tab
                    
                    const createTab = (idx = null) => {
                        $.api.tabs.query({active: true, currentWindow: true}, (tabs) => {
                            $.api.tabs.create({
                                url: url,
                                active: typeof opts.active === "undefined" ? true : !!(opts.active),
                                index: idx === null ? tabs[0].index + 1 : idx,
                                openerTabId: tabs[0].id
                            }, (tab) => {
                                b.helper.dao.setData("openedByExtension", tab.id).then(resolve);//这个数据在viewAmount中用于计数
                            });
                        });
                    };

                    if (opts.position === "afterLast") {
                        $.api.tabs.query({currentWindow: true}, (tabs) => {
                            let idx = 0;
                            tabs.forEach((tab) => {
                                idx = Math.max(idx, tab.index);
                            });
                            createTab(idx + 1);
                        });
                    } else if (opts.position === "beforeFirst") {
                        createTab(0);
                    } else {
                        createTab();
                    }
                } else if (opts.newWindow && opts.newWindow === true) { // new normal window
                    $.api.windows.create({url: url, state: "maximized"});
                    resolve();
                } else if (opts.incognito && opts.incognito === true) { // incognito window
                    $.api.windows.create({url: url, state: "maximized", incognito: true});
                    resolve();
                } else { // current tab
                	
                	$.api.tabs.query({active: true, currentWindow: true}, (tabs) => {
                        $.api.tabs.update(tabs[0].id, {url: url}, (tab) => {
                        	
                        	if(!!tab){
                        		b.helper.dao.setData("openedByExtension", tab.id).then(resolve);//这个数据在viewAmount中用于计数
                        	}
                        });
                    });
                }
            });
        };
    };

})(jsu);