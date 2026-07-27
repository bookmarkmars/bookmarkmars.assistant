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
                    
                    if (typeof data.navigation === "undefined") {
                        data.navigation = null;
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
        this.getValue = (opts) => {
        	return new Promise((resolve) => {

                resolve(this.getData(opts.key));
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