($ => {
    "use strict";

    $.LinkCheckerHelper = function (b) {
    	
		// 这些站点只保留检索参数，避免把同一次搜索的附加参数当成不同链接。
        // 其它站点保留查询串里除跟踪参数以外的部分，避免把不同视频、文章误判成重复。
        const importantURLParameters = {
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
            "youtube.com": ["search_query", "v", "list"],
        };

        const trackingParam = {
            "utm_source": 1, "utm_medium": 1, "utm_campaign": 1, "utm_term": 1, "utm_content": 1,
            "utm_id": 1, "utm_name": 1, "fbclid": 1, "gclid": 1, "gclsrc": 1, "dclid": 1,
            "msclkid": 1, "mc_cid": 1, "mc_eid": 1, "igshid": 1, "spm": 1, "si": 1,
            "yclid": 1, "twclid": 1, "gbraid": 1, "wbraid": 1, "_ga": 1, "_gl": 1, "cmpid": 1
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
         * 只有页面明确不存在时才算失效。超时、502、504 多半是暂时的，不记成失效。
         */
        const brokenStatus = {404: 1, 410: 1};

        const stopBody = (response) => {
            try {
                if (response && response.body && response.body.cancel) {
                    response.body.cancel().catch(() => {});
                }
            } catch (e) {
                //
            }
        };

        const probe = async (url, method, timeout) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            try {
                const response = await fetch(url, {
                    method: method,
                    redirect: "follow",
                    cache: "no-store",
                    signal: controller.signal
                });
                stopBody(response);
                return {response: response};
            } catch (error) {
                return {error: error};
            } finally {
                clearTimeout(timeoutId);
            }
        };

        const netKind = (error) => {
            const msg = String((error && (error.message || error.name)) || "");
            if (!error || error.name === "AbortError" || /ERR_TIMED_OUT|ERR_CONNECTION_TIMED_OUT|Timeout/i.test(msg)) {
                return "timeout";
            }
            if (/ERR_NAME_NOT_RESOLVED|ERR_NAME_RESOLUTION_FAILED|ERR_DNS/i.test(msg)) {
                return "dns";
            }
            if (/ERR_CONNECTION_REFUSED|ERR_ADDRESS_UNREACHABLE|ERR_TOO_MANY_REDIRECTS|ERR_CERT_|ERR_SSL_/i.test(msg)) {
                return "dead";
            }
            return "unknown";
        };

        const finalUrl = (response, fallback) => {
            return response && response.url ? response.url : fallback;
        };

        const httpsUpgrade = (rawUrl) => {
            return /^http:\/\//i.test(rawUrl) ? rawUrl.replace(/^http:/i, "https:") : null;
        };

        /**
         * HEAD 很快，但不少站点对 HEAD 返回 404/405。那种结果再用一次 GET 确认。
         * 超时不再连试三次，也不把超时记成失效。
         */
        const getHTTPInfo = async (rawUrl, timeout = 5000) => {
            if (!rawUrl || !/^https?:\/\//i.test(rawUrl)) {
                return {url: rawUrl, ok: true, status: null, skipped: true};
            }

            const limit = timeout || 5000;

            const tryHttps = async () => {
                const httpsUrl = httpsUpgrade(rawUrl);
                if (!httpsUrl) {
                    return null;
                }
                const again = await probe(httpsUrl, "GET", limit);
                if (again.response && !brokenStatus[again.response.status]) {
                    return {url: finalUrl(again.response, httpsUrl), ok: true, status: again.response.status};
                }
                if (again.response && brokenStatus[again.response.status]) {
                    return {url: rawUrl, ok: false, status: again.response.status};
                }
                return null;
            };

            const head = await probe(rawUrl, "HEAD", limit);

            if (head.response && !brokenStatus[head.response.status] && head.response.status !== 405 && head.response.status !== 501) {
                return {url: finalUrl(head.response, rawUrl), ok: true, status: head.response.status};
            }

            // 域名不存在或连接被拒绝时，同一地址再 GET 一次没有意义。
            if (head.error) {
                const headKind = netKind(head.error);
                if (headKind === "dns" || headKind === "dead") {
                    return await tryHttps() || {url: rawUrl, ok: false, status: null, errorType: headKind};
                }
            }

            const got = await probe(rawUrl, "GET", limit);
            if (got.response && !brokenStatus[got.response.status]) {
                return {url: finalUrl(got.response, rawUrl), ok: true, status: got.response.status};
            }

            if (got.response && brokenStatus[got.response.status]) {
                return await tryHttps() || {url: rawUrl, ok: false, status: got.response.status};
            }

            const kind = netKind(got.error || head.error);
            if (kind === "dns" || kind === "dead" || kind === "unknown") {
                // unknown：扩展请求失败且浏览器没给出状态码，多半是域名失效或连接失败。
                // 超时不走这里，避免把慢站点记成失效。
                return await tryHttps() || {url: rawUrl, ok: false, status: null, errorType: kind};
            }

            if (head.response && brokenStatus[head.response.status]) {
                return {url: rawUrl, ok: false, status: head.response.status};
            }

            return {url: rawUrl, ok: true, status: null, errorType: kind};
        };

        /**
         * Checks whether the given urls are used by multiple bookmarks and returns information about all duplicate bookmarks for the given url list
         *
         * @param {string} rawUrl
         * @returns {Promise}
         */
        const getDuplicateInfo = async (rawUrl) => {

            const getFilteredUrl = (url) => { // https://www.google.com/search?q=123&utm_source=x#top -> google.com/search?q=123
                let urlObj = null;
                try {
                    urlObj = new URL(url);
                } catch (e) {
                    return url;
                }

                const hostname = urlObj.hostname.replace(/^www\./i, "").toLowerCase();
                const path = urlObj.pathname.replace(/\/+$/, "");
                const keep = importantURLParameters[hostname];
                const params = [];

                urlObj.searchParams.forEach((val, key) => {
                    const name = key.toLowerCase();
                    if (!val || trackingParam[name]) {
                        return;
                    }
                    if (keep && keep.indexOf(name) === -1 && keep.indexOf(key) === -1) {
                        return;
                    }
                    params.push(key + "=" + val);
                });

                return hostname + path + (params.length ? "?" + params.join("&") : "");
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