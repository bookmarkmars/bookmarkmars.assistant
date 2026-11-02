($ => {
    "use strict";

    $.ImageHelper = function (b) {

        let cache = {};
        let isSaving = false;
        
        const colorArray=[
        	{
        		background:"#ffffff",
        		color:"#444"
        	},
        	{
        		background:"#ffffff",
        		color:"#00ade7"
        	},
        	{
        		background:"#ffffff",
        		color:"#ed6c27"
        	},
        	{
        		background:"#ffffff",
        		color:"#b51cb7"
        	},
        	{
        		background:"#ffffff",
        		color:"#188a09"
        	}
        ]

        /**
         *
         * @returns {Promise}
         */
        this.init = () => {
            return new Promise((resolve) => {
                $.api.storage.local.get(["imageCache"], (obj) => {
                    cache = obj.imageCache || {};
                    resolve();
                });
            });
        };

        /**
         * Returns the cached image string for the given url if available
         *
         * @param {string} type
         * @param {string} url
         * @returns {string|null}
         */
        const getCachedValue = (type, url) => {
            if (cache[type + "_" + url]) {
                return cache[type + "_" + url].d;
            } else {
                return null;
            }
        };

        /**
         * Stored the given image string for the given url in the storage
         *
         * @param {string} type
         * @param {string} url
         * @param {string} data
         * @returns {Promise}
         */
        const updateImageCache = (type, url, data) => {
            cache[type + "_" + url] = {t: +new Date(), d: data};

            if (isSaving === false) {
                isSaving = true;
                const now = +new Date();

                Object.keys(cache).forEach((key) => {
                    // Favicons keep longer for offline NTP; other images 5 days
                    const maxAge = key.indexOf("favicon_") === 0
                        ? 1000 * 60 * 60 * 24 * 30
                        : 1000 * 60 * 60 * 24 * 5;
                    if (now - cache[key].t > maxAge) {
                        delete cache[key];
                    }
                });

                return new Promise((resolve) => {
                    $.api.storage.local.set({
                        imageCache: cache
                    }, () => {
                        isSaving = false;
                        resolve();
                    });
                });
            }
        };
        
        const ICON_SIZE = 32;
        const FAVICON_FETCH_TIMEOUT = 4000;

        this.getFaviconUrl=(url) => {
		  
		  const faviconUrl = new URL("chrome-extension://"+$.api.runtime.id+"/_favicon/");

		  faviconUrl.searchParams.append('pageUrl', url);
		  faviconUrl.searchParams.append('size', String(ICON_SIZE));
		  
		  return faviconUrl.href;
		}

        /**
         * Build favicon candidate URLs. Order does not matter — they are raced in parallel.
         * Prefer sources that work when Google/DDG are blocked (e.g. CN networks).
         *
         * @param {string} pageUrl
         * @param {number} size
         * @returns {string[]}
         */
        const getRemoteFaviconCandidates = (pageUrl, size = ICON_SIZE) => {
            try {
                const u = new URL(pageUrl);
                const host = u.hostname.replace(/^www\./, "");
                if (!host) {
                    return [];
                }
                const hostWithWww = u.hostname;
                const encodedHost = encodeURIComponent(hostWithWww);
                return [
                    // Reliable PNG in many regions including CN
                    "https://favicon.yandex.net/favicon/" + hostWithWww + "?size=" + size,
                    "https://favicon.yandex.net/favicon/" + host + "?size=" + size,
                    // Proxies site favicon
                    "https://favicon.im/" + hostWithWww,
                    "https://favicon.im/" + host,
                    // Site itself
                    u.origin + "/favicon.ico",
                    u.origin + "/favicon.png",
                    u.origin + "/apple-touch-icon.png",
                    // May be blocked — short timeout + parallel so they cannot stall the rest
                    "https://www.google.com/s2/favicons?domain=" + encodedHost + "&sz=" + size,
                    "https://icons.duckduckgo.com/ip3/" + hostWithWww + ".ico"
                ];
            } catch (e) {
                return [];
            }
        };

        /**
         * Tiny / default provider placeholders (e.g. Yandex ~70B empty PNG) look "valid"
         * but draw blank — treat as miss so first-character fallback can run.
         *
         * @param {string} dataUrl
         * @returns {boolean}
         */
        const isLikelyPlaceholderDataUrl = (dataUrl) => {
            if (!dataUrl || typeof dataUrl !== "string" || dataUrl.indexOf("data:image") !== 0) {
                return true;
            }
            const comma = dataUrl.indexOf(",");
            const payload = comma >= 0 ? dataUrl.slice(comma + 1) : "";
            // ~150 bytes decoded; real 32px favicons are usually larger
            if (payload.length < 220) {
                return true;
            }
            return false;
        };

        /**
         * True if canvas has almost no visible (non-transparent) ink.
         *
         * @param {OffscreenCanvasRenderingContext2D} ctx
         * @param {number} w
         * @param {number} h
         * @returns {boolean}
         */
        const isBlankIconCanvas = (ctx, w, h) => {
            try {
                const {data} = ctx.getImageData(0, 0, w, h);
                let visible = 0;
                const total = w * h;
                for (let i = 0; i < data.length; i += 4) {
                    const a = data[i + 3];
                    if (a < 12) {
                        continue;
                    }
                    // Ignore near-white filler often used as empty placeholders
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    if (r > 245 && g > 245 && b > 245) {
                        continue;
                    }
                    visible++;
                    if (visible > total * 0.01) {
                        return false;
                    }
                }
                return true;
            } catch (e) {
                return false;
            }
        };

        /**
         * @param {Blob} blob
         * @returns {Promise<string>}
         */
        const blobToDataUrl = (blob) => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = function () {
                    resolve(this.result);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        };

        /**
         * fetch with hard AbortController timeout (no hanging native fallback).
         *
         * @param {string} url
         * @param {number} timeout
         * @returns {Promise<Blob>}
         */
        const fetchBlobWithTimeout = async (url, timeout = FAVICON_FETCH_TIMEOUT) => {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeout);
            try {
                const response = await fetch(url, {
                    method: "GET",
                    credentials: "omit",
                    redirect: "follow",
                    signal: controller.signal,
                    cache: "force-cache"
                });
                if (!response.ok) {
                    throw new Error("HTTP " + response.status);
                }
                const blob = await response.blob();
                if (!blob || blob.size < 20) {
                    throw new Error("empty blob");
                }
                // HTML error pages / SVG text — skip (SVG often fails in SW canvas)
                const type = (blob.type || "").toLowerCase();
                if (type.indexOf("text/html") === 0 || type.indexOf("text/plain") === 0 || type.indexOf("image/svg") === 0) {
                    throw new Error("unsupported type " + type);
                }
                return blob;
            } finally {
                clearTimeout(timer);
            }
        };

        /**
         * Decode favicon blob to a PNG data URL usable in <img>.
         * Rejects blank / placeholder icons so character fallback can run.
         *
         * @param {Blob} blob
         * @param {number} size
         * @returns {Promise<string|null>}
         */
        const blobToPngDataUrl = async (blob, size = ICON_SIZE) => {
            if (!blob || blob.size < 20) {
                return null;
            }

            // Prefer canvas re-encode (normalizes ico/png/webp)
            try {
                const bitmap = await createImageBitmap(blob);
                const w = bitmap.width || size;
                const h = bitmap.height || size;
                if (w < 1 || h < 1) {
                    if (bitmap.close) {
                        bitmap.close();
                    }
                    return null;
                }
                const cw = Math.min(w, 128);
                const ch = Math.min(h, 128);
                const canvas = new OffscreenCanvas(cw, ch);
                const ctx = canvas.getContext("2d", {willReadFrequently: true});
                ctx.clearRect(0, 0, cw, ch);
                ctx.drawImage(bitmap, 0, 0, cw, ch);
                if (bitmap.close) {
                    bitmap.close();
                }
                if (isBlankIconCanvas(ctx, cw, ch)) {
                    return null;
                }
                const pngBlob = await canvas.convertToBlob({type: "image/png"});
                if (!pngBlob || pngBlob.size < 20 || pngBlob.size < 100) {
                    // Sub-~100B PNGs are almost always empty provider stubs
                    return null;
                }
                const dataUrl = await blobToDataUrl(pngBlob);
                if (isLikelyPlaceholderDataUrl(dataUrl)) {
                    return null;
                }
                return dataUrl;
            } catch (e) {
                // ICO / odd mime: force image mime so <img> accepts the data URL
                try {
                    let mime = "image/png";
                    const t = (blob.type || "").toLowerCase();
                    if (t.indexOf("image/") === 0) {
                        mime = t;
                    } else {
                        // sniff ICO magic 00 00 01 00
                        const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
                        if (head[0] === 0x00 && head[1] === 0x00 && head[2] === 0x01 && head[3] === 0x00) {
                            mime = "image/x-icon";
                        } else if (head[0] === 0x89 && head[1] === 0x50) {
                            mime = "image/png";
                        } else if (head[0] === 0xFF && head[1] === 0xD8) {
                            mime = "image/jpeg";
                        } else if (head[0] === 0x47 && head[1] === 0x49) {
                            mime = "image/gif";
                        } else {
                            mime = "image/x-icon";
                        }
                    }
                    // Re-decode via canvas so blank placeholders are still rejected
                    const typed = new Blob([blob], {type: mime});
                    const bitmap = await createImageBitmap(typed);
                    const w = bitmap.width || size;
                    const h = bitmap.height || size;
                    const cw = Math.min(Math.max(w, 1), 128);
                    const ch = Math.min(Math.max(h, 1), 128);
                    const canvas = new OffscreenCanvas(cw, ch);
                    const ctx = canvas.getContext("2d", {willReadFrequently: true});
                    ctx.clearRect(0, 0, cw, ch);
                    ctx.drawImage(bitmap, 0, 0, cw, ch);
                    if (bitmap.close) {
                        bitmap.close();
                    }
                    if (isBlankIconCanvas(ctx, cw, ch)) {
                        return null;
                    }
                    const pngBlob = await canvas.convertToBlob({type: "image/png"});
                    if (!pngBlob || pngBlob.size < 100) {
                        return null;
                    }
                    const dataUrl = await blobToDataUrl(pngBlob);
                    if (isLikelyPlaceholderDataUrl(dataUrl)) {
                        return null;
                    }
                    return dataUrl;
                } catch (e2) {
                    // ignore
                }
                return null;
            }
        };

        /**
         * Race all candidates in parallel; first valid PNG/ICO data URL wins.
         * Blocked hosts abort in FAVICON_FETCH_TIMEOUT ms and cannot stall others.
         *
         * @param {string} pageUrl
         * @param {number} size
         * @returns {Promise<{img: string}|null>}
         */
        const fetchRemoteFaviconAsBase64 = (pageUrl, size = ICON_SIZE) => {
            const candidates = getRemoteFaviconCandidates(pageUrl, size);
            if (!candidates.length) {
                return Promise.resolve(null);
            }

            return new Promise((resolve) => {
                let pending = candidates.length;
                let done = false;

                const finishNull = () => {
                    pending--;
                    if (!done && pending <= 0) {
                        done = true;
                        resolve(null);
                    }
                };

                candidates.forEach((iconUrl) => {
                    fetchBlobWithTimeout(iconUrl, FAVICON_FETCH_TIMEOUT)
                        .then((blob) => blobToPngDataUrl(blob, size))
                        .then((dataUrl) => {
                            if (!dataUrl) {
                                finishNull();
                                return;
                            }
                            if (!done) {
                                done = true;
                                updateImageCache("favicon", pageUrl, dataUrl);
                                resolve({img: dataUrl});
                            }
                        })
                        .catch(() => {
                            finishNull();
                        });
                });
            });
        };

        /**
         * Letter / first-character icon when no remote favicon could be loaded.
         * Always resolves to {img} when a title is available.
         *
         * @param {object} opts
         * @returns {Promise<{img: string}|null>}
         */
        const resolveCharacterIcon = (opts) => {
            const iconOpts = (opts && opts.icon)
            	? opts.icon
            	: {size: ICON_SIZE, title: (opts && opts.url) ? opts.url : "N"};
            if (!iconOpts.title) {
            	iconOpts.title = (opts && opts.url) ? opts.url : "N";
            }
            return b.helper.icon.writeCharacterOnImage(this.getCustomIcon(iconOpts));
        };
        
        /**
         * Guarantee a usable icon: remote/cache favicon, else first character of title.
         */
        const resolveWithCharacterFallback = (opts, primary) => {
        	return Promise.resolve(primary).then((res) => {
        		if (res && res.img) {
        			return res;
        		}
        		return resolveCharacterIcon(opts);
        	}).catch(() => resolveCharacterIcon(opts));
        };
        
        this.getCustomIcon = (opts)=>{
        	
        	const specialCharacters=[
        		"/",
        		"\\",
        		",",
        		"(",
        		")",
        		"（",
        		"）",
        		"[",
        		"]",
        		"【",
        		"】",
        		"{",
        		"}",
        		"~",
        		"·",
        	]
        	
        	let c="N";
        	const title = (opts && opts.title) ? String(opts.title) : "";
        	const tArray = title.split("");
        	for(let a of tArray){
        		if(a && !specialCharacters.includes(a) && a.trim() !== ""){
        			c=a;
        			break;
        		}
        	}
        	// Only Latin letters get uppercased — keep CJK / emoji as-is
        	if (/^[a-z]$/i.test(c)) {
        		c = c.toUpperCase();
        	}
			
			let index=0;
			if(title){
				if(title.length>=5 && title.length < 9){
					index=1
				}
				else if(title.length>=9  && title.length < 13){
					index=2;
				}
				else if(title.length>=13  && title.length < 17){
					index=3;
				}
				else if(title.length>=17){
					index=4;
				}
			}
			const item = colorArray[index]
			
			return {c:c,size:(opts && opts.size) || ICON_SIZE,color:item.color,background:item.background}
        }
        
        this.fetchBase64Img = (opts)=>{
        	
        	return new Promise((resolve) => {
                const size = (opts.icon && opts.icon.size) || ICON_SIZE;
	        	const imgUrl=this.getFaviconUrl(opts.url);

                fetchBlobWithTimeout(imgUrl, FAVICON_FETCH_TIMEOUT)
                    .then((blob) => blobToPngDataUrl(blob, size))
                    .then((dataUrl) => {
                        if (!dataUrl) {
                            return fetchRemoteFaviconAsBase64(opts.url, size).then((remote) => {
                                if (remote) {
                                    resolve(remote);
                                } else {
                                    resolveCharacterIcon(opts).then(resolve);
                                }
                            });
                        }
                        updateImageCache("favicon", opts.url, dataUrl);
                        resolve({img: dataUrl});
                    })
                    .catch(() => {
                        fetchRemoteFaviconAsBase64(opts.url, size).then((remote) => {
                            if (remote) {
                                resolve(remote);
                            } else {
                                resolveCharacterIcon(opts).then(resolve);
                            }
                        });
                    });
			});
        }
        
        /**
         * Returns the data url of the favicon of the given url
         *
         * @param {object} opts
         * @returns {Promise}
         */
        this.getFavicon = (opts) => {
            
            return new Promise((resolve) => {
                const finish = (res) => {
                	resolveWithCharacterFallback(opts, res).then(resolve);
                };

                const cached = getCachedValue("favicon", opts.url);
                if (cached && !isLikelyPlaceholderDataUrl(cached)) {
                    finish({img: cached});
                    return;
                }
                // Drop blank placeholders stuck in cache from earlier fetches
                if (cached && cache["favicon_" + opts.url]) {
                    delete cache["favicon_" + opts.url];
                    if (isSaving === false) {
                        isSaving = true;
                        $.api.storage.local.set({imageCache: cache}, () => {
                            isSaving = false;
                        });
                    }
                }

                const size = (opts.icon && opts.icon.size) || ICON_SIZE;

                const withRemoteFallback = () => {
                    fetchRemoteFaviconAsBase64(opts.url, size).then((remote) => {
                        finish(remote);
                    }).catch(() => {
                        finish(null);
                    });
                };
            	
            	if($.browserCoreVersion < $.faviconLowestVersion){
                    withRemoteFallback();
            	}else if(opts.query){
                    // Custom shortcuts are often not bookmarks — race remote providers first.
                    b.helper.bookmarks.api.search({url: opts.url}).then((bookmarks) => {
                        if (bookmarks && bookmarks.length > 0) {
                            this.fetchBase64Img(opts).then(finish).catch(() => finish(null));
                        } else {
                            withRemoteFallback();
                        }
                    }).catch(() => {
                        withRemoteFallback();
                    });
            		}else{
            			this.fetchBase64Img(opts).then(finish).catch(() => finish(null));
            		}
            });
        };
    };

})(jsu);