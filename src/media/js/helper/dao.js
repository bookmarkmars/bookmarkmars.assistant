($ => {
    "use strict";

    /**
     * @param {object} ext
     * @constructor
     */
    $.DaoHelper = function (ext) {

        const defaults = {
            u: { // utility -> saved locally
                openStates: {},
                hiddenEntries: {},
                additionalInfo: {},
                scrollPos: 0,
                pinnedEntries: {},
                lockPinned: true,
                performReopening: false,
                entryAmounts: {},
                linkcheckerIgnored: {},
                lastOpened: null,
                sort: {
                    name: "default",
                    dir: "ASC"
                },
                mostViewedPerMonth: false,
                viewAsTree: true,
                recommend: false,
                shortcutsSyncTime: null,
                shortcutsLastCheck: null,
                shortcutsSeeded: false,
            },
            b: { // behaviour -> synced across devices
                animations: true,
                preventPageScroll: true,
                toggleArea: {
                    left:null,
                    top:null,
                    width:50,
                    height:50,
                    min:0.6,
                },
                panel:{
                	width:3,
                    widthWindowed: 20,
                    height: 100,
                    top: 0
                },
                showPanelIcon:true,
                panelPos: "left",
                openWay:"panel",
                openAction: "mousedown",
                minBall:30,
                maxBall:90,
                backupAuthorized:false,
                autoBackup:false,
                powerfulCheck:true,
                iconAction: "sidepanel",
				position: "left",
                recordVisit:false,
                blacklist: [],
                whitelist: [],
                newTab: "foreground",
                newTabPosition: "afterCurrent",//新tab位置
                visibility: "always",
                linkAction: "current",//或者newtab
                reopenSidebar: false,
                preventWindowed: false,
                preventWebapp: false,
                rememberState: "openStatesAndPos",
                rememberOpenStatesSubDirectories: false,
                newEntryPosition: "prepend",
                dndCreationDialog: false,
                openChildrenWarnLimit: 10,
                dirOpenDuration: 0,//不延时，单位为s
                scrollBarHide: 1.5,
                openDelay: 0,
                closeTimeout: 1,
                dndOpenDirDelay: 0.5,
            },
            a: { // appearance -> synced across devices
            	theme: "default",
                styles: {
	                indicatorColor:{
	                	indicatorMoon: "#debb06",
	                	indicatorWater: "#0c70c6",
	                	indicatorSun: "#c60c0c",
	                },
	                modalHeaderBgColor:"#524949",
	                indicatorStyle:"#debb06",//默认
					indicatorBallExeTimes:"3",//默认3，infinite标识永久
					panelWidth: "20px",
					panelIconColor:"#ffffff",
					panelIconSize:"15px",
					colorScheme:"#444",
					foregroundColor:"#ffffff",
					textColor:"#444",
					bodyColor:"#efefef",
					sidebarWidth:"400px",
					sidebarHeaderHeight:"150px",
					overlayHeaderHeight:"30px",
					directoriesIconSize:"18px",
					bookmarksFontSize:"14px",
					bookmarksIconSize:"16px",
					bookmarksLineHeight:"40px",
					bookmarksDirIcon:"dir-default",
					bookmarksDirColor:"#f6ae0d",
					separatorColor:"#00000042",
					searchFieldBackground:"#b8b8b833",
					bookmarksDirIndentation:"25px",
					bookmarksHorizontalPadding:"16px",
					scrollBarWidth:"4px",
					hoverColor:"#ffffff7a",
					overlayMaskColor:"#2d2b2b1f",
					searchInputHeight:"40px",
					headerIconBackground:"#dbcfcfcc",
					headerIconBadgeColor:"#df1212",
					fontFamily:"default",
					fontWeightThin:"100",
					fontWeightExtraLight:"200",
					fontWeightLight:"300",
					fontWeightNormal:"400",
					fontWeightMedium:"500",
					fontWeightSemiBold:"600",
					fontWeightBold:"700",
					fontWeightExtraBold:"800",
					fontWeightBlack:"900",
					switchCloseTag:"关闭",
					switchOpenTag:"开启"
                }
            },
            n: { // new tab settings sync; the shortcut list is stored locally (see newtab_links)
                override: false,
                faviconShape: "favicon",
                faviconBackground:"#fff0",//透明
                faviconPadding: 5,
                focusOmnibox: false,
                searchField: "show",
                searchEngine: "google",
                searchEngineCustom: {
                    title: "",
                    homepage: "",
                    queryUrl: ""
                },
                gridMaxCols: 8,
                gridMaxRows: 2,
                links: [],
                topLinks:"",
                website: "",
                searchSuggestQueries:true,
                searchSuggestBookmarks:true,
                searchSuggestHistory:true,
                widgetsVisible: true
            }
        };
    	
    	let data = {};
        let port=null;
        const callbacks = {};
        let activeTimer=null;
        
        this.getDefaults = ()=>{
        	return defaults;
        }

        const themeStyles = {
            classcial: {
                colorScheme: "#4b2323",
                bodyColor: "#d9d0d0",
                textColor: "#3c3030",
                foregroundColor: "#fff8f2",
                modalHeaderBgColor: "#762f2f",
                bookmarksDirColor: "#8f6840",
                bookmarksDirIcon: "dir-classcial",
                hoverColor: "#4b232216",
                headerIconBackground: "#c4a4a4cc",
                searchFieldBackground: "#ffffff1f",
                separatorColor: "#3c303028"
            },
            young: {
                colorScheme: "#16812a",
                bodyColor: "#e7f0e4",
                textColor: "#181515",
                foregroundColor: "#ffffff",
                modalHeaderBgColor: "#229538",
                bookmarksDirColor: "#2f6a3c",
                bookmarksDirIcon: "dir-young",
                hoverColor: "#16812a14",
                headerIconBackground: "#ffffffcc",
                searchFieldBackground: "#ffffff40",
                separatorColor: "#18151524"
            },
            happy: {
                colorScheme: "#bb3515",
                bodyColor: "#ddd6d6",
                textColor: "#3d3333",
                foregroundColor: "#ffffff",
                modalHeaderBgColor: "#bd2323",
                bookmarksDirColor: "#c4532e",
                bookmarksDirIcon: "dir-happy",
                hoverColor: "#bb351514",
                headerIconBackground: "#f0d2cccc",
                searchFieldBackground: "#ffffff24",
                separatorColor: "#3d333328"
            }
        };

        this.getThemeStyles = (name) => {
            if (name) {
                return themeStyles[name] || null;
            }
            return themeStyles;
        };

        /**
         * Initialises the model
         *
         * @returns {Promise}
         */
        this.init = () => {
            return new Promise((resolve) => {
                Promise.all([
	                refresh()
                ]).then(resolve);
            }).catch(()=>{});
        };


        /**
         * Sends a message to the background script and resolves when receiving a response
         *
         * @param {string} key
         * @param {object} opts
         * @param {number} retry
         * @returns {Promise}
         */
        this.call = async (key, opts = {}, retry = 0) => {
            
            let backendDead = false;
            
            opts.type = key;

            let response = await $.api.runtime.sendMessage(opts)["catch"]((err) => {
                $.api.runtime.lastError;
                if (err && ("" + err).includes("Could not establish connection")) {
                    backendDead = true;
                } else {
                    if ($.isDev) {
		               console.log(err);
		            }
                }
            });

            if (backendDead && retry < 50) { // backend got killed by the browser -> it should restart and be available after a short delay, so we try again
                await $.delay(100);
                response = await this.call(key, opts, retry + 1);
            }

            return response;
        };
        
        
        /**
         * Returns the name of the given alias
         * e.g. "b" -> "behaviour"
         *
         * @param alias
         * @returns {*}
         */
        // Shortcut lists outgrow chrome.storage.sync's 8KB per-item limit.
        // A failed sync write is ignored, so adds and drag order vanished on refresh.
        const LINKS_LOCAL_KEY = "newtab_links";

        const loadShortcutLinks = (newtab) => {
            return new Promise((resolve) => {
                const bag = newtab || {};
                $.api.storage.local.get([LINKS_LOCAL_KEY], (obj) => {
                    $.api.runtime.lastError;
                    const stored = obj ? obj[LINKS_LOCAL_KEY] : undefined;
                    if (Array.isArray(stored)) {
                        bag.links = stored;
                    } else if (!Array.isArray(bag.links)) {
                        bag.links = [];
                    }
                    resolve(bag);
                });
            });
        };

        const getNameByAlias = (alias) => {
            switch (alias) {
                case "u": {
                    return "utility";
                }
                case "b": {
                    return "behaviour";
                }
                case "a": {
                    return "appearance";
                }
                case "n": {
                    return "newtab";
                }
            }
            return null;
        };
        
        /**
         *
         * @returns {Promise}
         */
        // People who were still on the old "open both" default move to the side panel once.
        // Choosing "Open all" again after that is kept.
        const applyPanelDefault = () => {
            if (!data || !data.behaviour || (data.utility && data.utility.openWayPanelDefault)) {
                return;
            }
            const openWay = data.behaviour.openWay;
            const moveToPanel = !openWay || openWay === "all";
            if (!data.utility) {
                data.utility = {};
            }
            data.utility.openWayPanelDefault = true;
            if (moveToPanel) {
                data.behaviour.openWay = "panel";
            }
            const revert = () => {
                if (moveToPanel) {
                    data.behaviour.openWay = openWay;
                }
                data.utility.openWayPanelDefault = false;
            };
            try {
                const persistFlag = () => {
                    $.api.storage.local.set({utility: data.utility});
                };
                if (!moveToPanel) {
                    persistFlag();
                    return;
                }
                $.api.storage.sync.set({behaviour: data.behaviour}, () => {
                    const error = $.api.runtime.lastError;
                    if (error && error.message) {
                        revert();
                        return;
                    }
                    persistFlag();
                });
            } catch (e) {
                revert();
            }
        };

        // The old default reopened child folders. New installs, and this one change, keep them closed.
        const applySubDirDefault = () => {
            if (!data || !data.behaviour || (data.utility && data.utility.rememberSubsDefault)) {
                return;
            }
            if (!data.utility) {
                data.utility = {};
            }
            data.utility.rememberSubsDefault = true;
            const alreadyClosed = data.behaviour.rememberOpenStatesSubDirectories === false;
            if (!alreadyClosed) {
                data.behaviour.rememberOpenStatesSubDirectories = false;
            }
            const revert = () => {
                if (!alreadyClosed) {
                    data.behaviour.rememberOpenStatesSubDirectories = true;
                }
                data.utility.rememberSubsDefault = false;
            };
            try {
                const persistFlag = () => {
                    $.api.storage.local.set({utility: data.utility});
                };
                if (alreadyClosed) {
                    persistFlag();
                    return;
                }
                $.api.storage.sync.set({behaviour: data.behaviour}, () => {
                    const error = $.api.runtime.lastError;
                    if (error && error.message) {
                        revert();
                        return;
                    }
                    persistFlag();
                });
            } catch (e) {
                revert();
            }
        };

        const refresh = () => {
            return new Promise((resolve) => {
            	
            	if($.api.runtime.id == undefined) {
                    resolve();
                    return;
                }
                
                const keys = ["utility", "behaviour", "appearance","newtab"];
                const newData = {};

                const len = keys.length;
                let loaded = 0;
                keys.forEach((key) => {

                    $.api.storage[key === "utility" ? "local" : "sync"].get([key], (obj) => {
                        newData[key] = obj[key] || {};

                        if (++loaded === len) {
                            loadShortcutLinks(newData.newtab).then((newtab) => {
                                newData.newtab = newtab || {};
                                data = newData;
                                applyPanelDefault();
                                applySubDirDefault();
                                resolve();
                            });
                        }
                    });
                });
            });
        };
        
        /**
         * Retrieves the stored values for the given keys,
         * if a value is undefined, it will be set to the default value
         *
         * @param {object|string} keys
         * @param {boolean} defaultVal
         */
        this.getData = (keys, defaultVal = false) => {
            
            let configKeys = keys;
            if (typeof configKeys === "string") {
                configKeys = [configKeys];
            }

            let result = {};

            configKeys.forEach((keyInfo) => {
                const scope = keyInfo.split("/")[0];//eg,a
                const key = keyInfo.split("/")[1];//eg,styles
                let value = null;

                const scopeName = getNameByAlias(scope);//eg,appearance
                if (scopeName && data[scopeName]) { //apperarance is a
                    if (defaultVal === true || typeof data[scopeName][key] === "undefined") {
                        if (typeof defaults[scope] !== "undefined" && typeof defaults[scope][key] !== "undefined") { // default values if undefined
                            value = defaults[scope][key];
                        }
                    } else {
                        value = data[scopeName][key];
                    }
                }

				//整体映射一遍
                if (keyInfo === "a/styles") {
                    //map styles to value
                    value = Object.assign({}, defaults.a.styles, value);
                }

                result[key] = value;
            });
            
            if (typeof keys === "string") {
                const key = keys.split("/")[1];
                result = result[key];
            }

            return result;
        };
        
        /**
         * Saves the given values in the storage
         *
         * @param {object} values
         * @returns {Promise}
         */
        this.setData = (values) => {
            return new Promise((resolve) => {
                refresh().then(() => { // refresh to retrieve the newest data
                    Object.keys(values).forEach((keyInfo) => {
                        const scope = keyInfo.split("/")[0];
                        const key = keyInfo.split("/")[1];
                        const value = values[keyInfo];

                        switch (scope) {
                            case "u": {
                                data.utility[key] = value;
                                break;
                            }
                            case "b": {
                                data.behaviour[key] = value;
                                break;
                            }
                            case "a": {
                                data.appearance[key] = value;
                                break;
                            }
                            case "n": {
                                data.newtab[key] = value;
                                break;
                            }
                        }
                    });

                    if (!data.newtab) {
                        data.newtab = {};
                    }

                    const writingLinks = Object.prototype.hasOwnProperty.call(values, "n/links");
                    let savedAmount = 0;
                    const saved = (amount = 1) => { // is getting called after data is saved in the storage
                        savedAmount += amount;
                        if (savedAmount >= 5) { // utility, shortcut list, behaviour, appearance, newtab settings
                            resolve();
                        }
                    };

                    try { // can fail (e.g. MAX_WRITE_OPERATIONS_PER_MINUTE exceeded)
                        $.api.storage.local.set({utility: data.utility}, () => {
                            
                            const error = $.api.runtime.lastError;
                            if (error && error.message) {} //什么都不做
                            saved();
                        });

                        if (writingLinks) {
                            const linkBag = {};
                            linkBag[LINKS_LOCAL_KEY] = Array.isArray(data.newtab.links) ? data.newtab.links : [];
                            $.api.storage.local.set(linkBag, () => {
                                $.api.runtime.lastError;
                                saved();
                            });
                        } else {
                            saved();
                        }

                        // Keep the sync item small. links and topLinks live locally.
                        const syncNewtab = Object.assign({}, data.newtab);
                        delete syncNewtab.links;
                        delete syncNewtab.topLinks;
                        $.api.storage.sync.set({
                            behaviour: data.behaviour,
                            appearance: data.appearance,
                            newtab: syncNewtab
                        }, () => {
                        	
                        	 const error = $.api.runtime.lastError;
                             if (error && error.message) {} //什么都不做
                             saved(3);
                        });
                    } catch (e) {
                        resolve();
                    }
                });
            });
        };
    };
})(jsu);
