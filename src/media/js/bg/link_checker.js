($ => {
    "use strict";

    $.LinkCheckerHelper = function (b) {
    	
		//重点保护网站，这些网站的搜索词不同认为地址不同
        const importantURLParameters = {
            "bookmarkearth.cn": ["q"],
            "bookmarkmars.com": ["q"],
            "google.com": ["q"],
            "google.de": ["q"],
            "baidu.com": ["q"],
            "bing.com": ["q"],
            "so.com": ["q"],
            "toutiao.com": ["keyword"],
            "sogou.com": ["query"],
            "zhihu.com": ["q"],
            "bilibili.com": ["keyword"],
            "youtube.com": ["search_query"],
        };

       this.check = (opts) => {
            return new Promise((resolve) => {
            	
                Promise.all([
                    getHTTPInfo(opts.url,opts.timeout),
                    !opts.all?Promise.resolve(null):getDuplicateInfo(opts.url),
                ]).then(([httpInfo, duplicateInfo]) => {
                    resolve({
                        httpInfo: httpInfo,
                        duplicateInfo: duplicateInfo
                    });
                }, () => {
                    resolve({error: true});
                });

            });
        };


        /**
         * 对于指定的几种状态，我们认为是链接已经失效
         */
        const unacceptStatus =(res) => {
        	
        	/**
        	 * 502 明显的后端错误，可能需要前后端配合来修复
        	 * 504 网关超时
        	 */
        	const invalidStatusCodes = [404,502,504];
  			return invalidStatusCodes.some(code => code === res.status);
        }

		/*2024.04.15重新调整*/
        const getHTTPInfo = async (rawUrl, timeout = 7000, method = "HEAD", times = 0) => {
        	
	    	const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), timeout);
			let response =null;
			
			try {
			    
			    response = await fetch(rawUrl, {
			      method,
			      redirect: 'follow',
			      signal: controller.signal,
			    });
			    
			    //非不可接受状态
			    if (!unacceptStatus(response)) {
			      return { url: rawUrl, ok: true, status: response.status };
			    }
			
				//尝试https
			    const httpsUrl = rawUrl.startsWith('http:') ? rawUrl.replace(/^http:/, 'https:') : rawUrl;
			    response = await fetch(httpsUrl, {
			      method,
			      redirect: 'follow',
			      signal: controller.signal,
			    });
			
			    if (!unacceptStatus(response)) {
			      return { url: httpsUrl, ok: true, status: response.status };
			    }
			
			    return { url: rawUrl, ok: false, status: response.status };
			    
			} catch (error) {

				// 请求因超时而中止
			    if (error.name === 'AbortError') {  
			    	
			    	// 如果是超时错误，并且还有重试次数，则重试  
				    if (times < 2) {  
			           return await getHTTPInfo(rawUrl, timeout, method, times + 1);  
			        } else {  
			          
			          // 如果尝试了两次还是超时，则认为链接无效
			          return { url: rawUrl, ok: false, status: !!response?response.status:null, errorType: 'timeout' };  
			        }  
			    }
			    
			    else {
			        // 对于其他未知错误，根据业务需求决定是否认为是链接有效
			        // 这里默认返回链接有效，但实际应用中可能需要更严谨的处理  
			        return { url: rawUrl, ok: true, status: !!response?response.status:null, errorType: 'unknown' };  
			    } 
			    
			} finally {
			    
			    if(timeoutId!=null){
			    	clearTimeout(timeoutId);
			    }
			}
        };

        /**
         * Checks whether the given urls are used by multiple bookmarks and returns information about all duplicate bookmarks for the given url list
         *
         * @param {string} rawUrl
         * @returns {Promise}
         */
        const getDuplicateInfo = async (rawUrl) => {

            const getFilteredUrl = (url) => { // filters the given url -> e.g. https://www.google.com/?q=123#top -> google.com
                let urlObj = null;
                try {
                    urlObj = new URL(url);
                } catch (e) {
                    //
                }

                url = url.split("?")[0];
                url = url.split("#")[0];
                url = url.replace(/^https?:\/\//, "");
                url = url.replace(/^www\./, "");
                url = url.replace(/\/$/, "");

                const hostname = url.split("/")[0];

				//对于一些重要网站，去掉不重要参数
                if (urlObj && importantURLParameters[hostname]) { // keep important parameters of known urls -> e.g. https://www.youtube.com/?v=abcdefg&list=xyz -> youtube.com/?v=abcdefg
                    const params = [];
                    importantURLParameters[hostname].forEach((param) => {
                        const val = urlObj.searchParams.get(param);
                        if (val) {
                            params.push(param + "=" + val);
                        }
                    });
                    url += "?" + params.join("&");
                }

                return url;
            };

			//过滤
            const filteredUrl = getFilteredUrl(rawUrl);
            
            //搜索
            const result = await b.helper.bookmarks.api.search(filteredUrl); // will return some false positive (e.g. 'google.com/' will also return all subdomains of google.com and all subdirectories)

            if (result.length > 1) {
                const realResults = [];

                result.forEach((bookmark) => { // filter the result array and only add real duplicates to the final result list
                    if (getFilteredUrl(bookmark.url) === filteredUrl) {
                        realResults.push(bookmark);
                    }
                });

                if (realResults.length > 1) { // there are real duplicates -> return them
                    return {label: filteredUrl, duplicates: realResults};
                }
            }

            return {label: filteredUrl, duplicates: []};
        };
    };

})(jsu);