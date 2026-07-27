($ => {
    "use strict";

    $.UpgradeHelper = function (b) {

        this.loaded = false;

        /**
         *
         * @returns {Promise}
         */
        this.init = async () => {
            
            $.api.runtime.onUpdateAvailable.addListener(() => { // reload background script when an update is available
                $.api.runtime.reload();
            });

            this.loaded = true;
        };

        /**
         * Show onboarding page and reinitialize the content scripts after the extension was installed
         */
        this.onInstalled = () => {
            
            //安装日期
            const installationDate = b.helper.dao.getData("installationDate");

            if (installationDate === null || (+new Date() - installationDate < 60 * 1000)) { // no installation date yet, or installation date from the last minute -> show onboarding page
                
                //记录信息
                b.helper.statistics.track({
                    name: "action",
                    value: {name: "install", value: "true"}
                });

					//更新选项
                updateOptions("install");

                // Fresh install: UI language follows the browser (not a fixed locale)
                $.api.storage.sync.set({language: "default"}, () => {
                    b.helper.language.init();
                });
                
                //打开intro.html
                b.helper.util.openLink({
                    href: $.api.runtime.getURL("html/init.html"),
                    //href: $.api.runtime.getURL("html/new_tab.html"),
                    newTab: true
                });
            }

            //重新初始化
            b.reinitialize();
        };

        /**
         * Will be called after the extension was updated,
         * calls the upgrade method after a version jump (1.6 -> 1.7) and reinitializes the content scripts
         *
         * @param {object} details
         */
        this.onUpdated = (details) => {
            $.api.storage.local.remove(["languageInfos"]);
            b.helper.dao.setData("lastUpdateDate", +new Date());
            const newVersion = $.opts.manifest.version;

            const versionPartsOld = details.previousVersion.split(".");
            const versionPartsNew = newVersion.split(".");

            if (versionPartsOld[0] !== versionPartsNew[0] || versionPartsOld[1] !== versionPartsNew[1]) { // version jump (e.g. 2.1.x -> 2.2.x)
                updateOptions("upgrade").then(() => {
                    b.reinitialize();
                });
            } else {
                b.reinitialize();
            }
        };

        /**
         * Updates the stored settings and data after installing or upgrading
         *
         * @param {string} type
         * @returns {Promise}
         */
        const updateOptions = (type) => {
            return new Promise((resolve) => {
                
                let savedCount = 0;
                const savedValues = () => {
                    savedCount++;
                    if (savedCount >= 3) { // newtab, behaviour and appearance
                        resolve();
                    }
                };

                $.api.storage.sync.get(null, (obj) => { // get all stored information
                    
                    if (typeof obj.newtab === "undefined") {
                        obj.newtab = {};
                    }
                    
                    if (typeof obj.behaviour === "undefined") {
                        obj.behaviour = {};
                    }
                    
                    if (typeof obj.appearance === "undefined") {
                        obj.appearance = {};
                    }


					//更新数据
                    if (type === "upgrade") {
                        updateOptionsAfterUpgrade(obj);
                    }

                    $.api.storage.sync.set({behaviour: obj.behaviour}, savedValues);
                    $.api.storage.sync.set({newtab: obj.newtab}, savedValues);
                    $.api.storage.sync.set({appearance: obj.appearance}, savedValues);
                });
            });
        };
        
        /**
         * Upgrades the stored settings and data to be compatible to the new version
         *
         * @param {object} obj
         */
        const updateOptionsAfterUpgrade = (obj) => {
            try {

                delete obj.appearance.darkMode;
                delete obj.behaviour.contextmenu;
                delete obj.behaviour.dndOpen;
                delete obj.behaviour.initialOpenOnNewTab;
                delete obj.behaviour.rememberSearch;
                delete obj.behaviour.rememberScroll;
                delete obj.behaviour.autoOpen;
                delete obj.behaviour.pxTolerance;
                delete obj.behaviour.scrollSensitivity;
                delete obj.behaviour.hideEmptyDirs;
                delete obj.behaviour.replaceNewTab;
                delete obj.behaviour.language;
                delete obj.behaviour.model;
                
                delete obj.newtab.gridMaxCols;
                delete obj.newtab.gridMaxRows;
                
            } catch (e) {
                //
            }
        };
    };

})(jsu);