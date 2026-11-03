($ => {
    "use strict";

    $.DaoHelper = function (b) {
        
        let data = {};

        /**
         *
         * @returns {Promise}
         */
        this.init = () => {
            return new Promise((resolve) => {
                $.api.storage.sync.get(["model"], (obj) => {
                    data = obj.model || {};

                    if (typeof data.installationDate === "undefined") { // no date yet -> save a start date in storage
                        data.installationDate = +new Date();
                    }

                    if (typeof data.lastUpdateDate === "undefined") { // no date yet -> save a start date in storage
                        data.lastUpdateDate = +new Date();
                    }

                    if (typeof data.blacklist === "undefined") {
                        data.blacklist = null;
                    }
                    
                    if (typeof data.bebeauty === "undefined") {
                        data.bebeauty = null;
                    }
                    
                    if (typeof data.search_engine === "undefined") {
                        data.search_engine = null;
                    }
                    
                    // navigation payloads are ~15KB. chrome.storage.sync rejects
                    // items over 8KB and the failure is ignored, so the catalog
                    // never persisted. Keep them out of the sync model.
                    if (data.navigation) {
                        delete data.navigation;
                    }
                    if (data.navigation_v2) {
                        delete data.navigation_v2;
                    }
                    
                    if (typeof data.newVersionFound === "undefined") {
                        data.newVersionFound = null;
                    }
                    
                    if (typeof data.backupRequest === "undefined") {
                        data.backupRequest = null;
                    }
                    
                     if (typeof data.openedByExtension === "undefined") {
                        data.openedByExtension = null;
                    }
                  
                    saveModelData().then(resolve);
                });
            });
        };

        /**
         * Saves the given value under the given name
         *
         * @param {string} key
         * @param {*} val
         * @returns {Promise}
         */
        this.setData = (key, val) => {
            return new Promise((resolve) => {
                data[key] = val;
                saveModelData().then(resolve);
            });
        };
        
        this.setValue = (opts) =>{
        	
        	return new Promise((resolve) => {
                data[opts.key] = opts.value;
                saveModelData().then(resolve);
            });
        	
        }
        
        
		/**
		 * 通过key值来获得value
		 */
        const localConfigKey = (key) => {
        	return "cfg_" + key;
        };

        const isLocalConfig = (key) => {
        	return key === "navigation" || key === "navigation_v2";
        };

        /**
         * Large server configs live in local storage, not the sync model.
         */
        this.setLocalConfig = (key, value) => {
        	return new Promise((resolve) => {
        		if (!isLocalConfig(key)) {
        			this.setData(key, value).then(resolve);
        			return;
        		}
        		const bag = {};
        		bag[localConfigKey(key)] = value;
        		$.api.storage.local.set(bag, () => {
        			$.api.runtime.lastError;
        			resolve();
        		});
        	});
        };

        this.getValue = (opts) => {
        	const key = opts && opts.key;
        	if (!isLocalConfig(key)) {
        		return Promise.resolve(this.getData(key));
        	}
        	return new Promise((resolve) => {
        		$.api.storage.local.get([localConfigKey(key)], (obj) => {
        			$.api.runtime.lastError;
        			resolve((obj && obj[localConfigKey(key)]) || null);
        		});
        	});
        };


        /**
         * Returns the value to the given name
         *
         * @param {string} key
         * @returns {*|null}
         */
        this.getData = (key) => {
            return data[key] || null;
        };

        /**
         * Saves the data object into the synced storage
         *
         * @returns {Promise}
         */
        const saveModelData = () => {
            return new Promise((resolve) => {
                if (Object.getOwnPropertyNames(data).length > 0) {

                   $.api.storage.sync.set({ // save to sync storage
                        model: data
                    }, () => {
                        $.api.runtime.lastError; // do nothing specific with the error -> is thrown if too many save attempts are triggered
                        resolve();
                    });
                }
            });
        };
    };

})(jsu);