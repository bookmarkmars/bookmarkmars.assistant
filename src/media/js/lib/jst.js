/**
 * jst - Javascript tool
 *
 * lds
 * https://bookmarkmars.com/
 */
(() => {
    
    "use strict";
    
    const runningFetch=[];
    
    /**
     * jsuTools
     */
    
	const jsuTools = {
		

		
		
        /**
         * Promise for a delay of the given duration
         *
         * @param {int} t
         * @returns {Promise}
         */
        delay: (t = 0) => {
            return new Promise((resolve) => {
                setTimeout(resolve, t);
            });
        },
       
        /**
         * Performs Fetch with the given options
         *
         * @param {string} url
         * @param {object} opts
         * @returns {Promise}
         */
        fetch: (url, opts = {},timeout=null) => {
        	
        	// Default GET (native fetch default). Do not force POST — that breaks
        	// chrome-extension:// static files (locales, css, seed json).
        	if (JSON.stringify(opts) === "{}") {
        		opts = { method: "GET" };
        	}
        	
        	const controller = new AbortController();
        	let signal=controller.signal;
        	
        	//promise
        	const promise = new Promise((resolve, reject)=>{

        		fetch(url, { signal:signal, ...opts })
	        	.then((response)=>{
	        		
	        		if (response.status < 400) {
	      				resolve(response);
	      			}
	        		reject(response);//拒绝，进入catch，catch 返回错误给上层
	        		
	        	})
	        	.catch(e=>{

	      			runningFetch.push({url: url});//准备去abort
	      			reject(null);
	      		});
        	});
        	
        	//out
        	let out = null;
        	if(timeout!=null){
        		
        		if (signal) signal.addEventListener("abort", () => controller.abort());
        		out=setTimeout(() => controller.abort(), timeout);
        	}
        	
        	return promise.finally(() => {if(out!=null) {clearTimeout(out)} });
        },
        
        /**
         * Cancels all FetchRequests or only the ones with the given url
         *
         * @param {string} url
         */
        cancelFetch: (url = null) => {
            runningFetch.forEach((obj) => {
                if (url === null || obj.url === url) {
                	const controller = new AbortController();
                    controller.abort();
                    obj = null;
                }
            });
        }
    };
    
    (()=>{
    	self.jsuTools = jsuTools;
    })();
    
})();