($ => {
    "use strict";

    $.StatisticsHelper = function (b) {
        /**
         *
         * @type {boolean}
         */
        let trackUserDataRunning = false;
        
        let intervalHandler=null;
        
        const timer = 2 * 60; //单位 second


        /**
         *
         * @type {Array}
         */
        let stack = [];

        /**
         * @returns {Promise}
         */
        this.init = async () => {
        	
        	//清空，只保留一个
        	if(intervalHandler!=null){
        		clearInterval(intervalHandler);
        	}
            
            intervalHandler=setInterval(() => {
                if (stack.length > 0) {
                    this.sendStackToServer();
                }
            }, timer * 1000);
        };

        /**
         * Tracks the given data for the given type by sending a request to the webserver
         *
         * @param {object} opts
         * @returns {Promise}
         */
        this.track = (opts) => {
            return new Promise((resolve) => {
                addToStack(opts.name, opts.value);
                resolve();
            });
        };

        /**
         * Send a sign of life, some general information and all configuration once per day
         *
         * @returns {Promise}
         */
        this.trackUserData = async () => {
            
            //最后记录日期
            const lastTrackDate = +b.helper.dao.getData("lastTrackDate");
            const today = +new Date().setHours(0, 0, 0, 0);

            if (trackUserDataRunning === false && today > lastTrackDate) { // no configuration/userdata tracked today
            
                trackUserDataRunning = true;

                await b.helper.dao.setData("lastTrackDate", today);

                if (lastTrackDate && b.helper.dao.getData("lastTrackDate")) { // don't proceed when lastTrackDate is empty or the variable stored in the sync storage is empty -> prevent double tracking of users, where saving the lastTrackDate fails
	
                    //用户信息
                    const user=b.helper.serverExchange.getUser();
                    const installationDate = b.helper.dao.getData("installationDate");
                    
                    addToStack("basic",{
                    	"version":$.opts.manifest.version_name,
                    	"system":navigator.userAgent,
                    	"language":b.helper.language.getLanguage(),
                    	"runtimeId":$.api.runtime.id,
                    	"userType":user?user.vipType:null,
                    	"userId":user?user.id:null,
                    	"installationDate":installationDate?installationDate:null
                    });
                }
                trackUserDataRunning = false;
            }
        };
        
        /**
         * Adds an entry to the stack
         *
         * @param {string} type
         * @param {*} value
         * @param {boolean} ignoreUserPreference
         */
        const addToStack = (type, value) => {
            
            const obj = {type: type};
            if (typeof value === "object") {
                obj.values = value;
            } else {
                obj.value = "" + value;
            }
            stack.push(obj);
        };

        /**
         * Sends the stack to the server and flushes its stored values
         *
         * @param {object} retry
         * @returns {Promise}
         */
        this.sendStackToServer = (retry = {}) => {
            
            let data = [];

            if (retry && retry.stack && retry.count) { // recall of the method -> fill with previous stack
                data = retry.stack;
            } else { // new date to transfer
                data = [...stack];
                stack = [];
                retry = {stack: data, count: 0};
            }
            
            return new Promise((resolve,reject) => {
            	$.fetch(
	                $.opts.website.main.extension+$.opts.website.scope+$.opts.website.servletExt.statistics,
	                {
	                	method:"POST",
	                	headers:{
					      'Accept': 'application/json',
					      'Content-Type': 'application/json;charset=UTF-8',
					    },
					    body:JSON.stringify({
	                        stack: data,
	                        tz: new Date().getTimezoneOffset()
	                    })
	                },
	                6000
	             ).then((res)=>{
					res.json().then((obj)=>{
						resolve();
					});
	           	 }).catch(()=>{
	            	if (retry.count < 50) {
	                    $.delay((retry.count + 1) * 30000).then(() => { // could not send request -> try again later
	                        retry.count++;
	                        return this.sendStackToServer(retry);
	                    }).then(resolve);
	                } else {
	                    resolve($.opts.netWorkError);
	                }
	             });
            })
        };
    };

})(jsu);