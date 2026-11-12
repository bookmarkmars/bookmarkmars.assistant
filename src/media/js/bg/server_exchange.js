($ => {
    "use strict";
	
    /**
	 * 二次开发的关键文件
	 */
    $.ServerExchangeHelper = function(b){
    	
    	let timeout=3000;
    	// Remote config (navigation / search_engine / …): fail fast so new tab can use cache
    	const configTimeout = 800;
    	
    	let userInfo={};
    	
    	let upgradeInfo={};

		let intervalHandler=null;
		
		const timer = 2 * 60; //单位 second

		const NAV_CATALOG_KEY = "u/navCatalog";
	
    	const mainHost=$.opts.website.main.official+$.opts.website.scope;
    	const extHost=$.opts.website.main.extension+$.opts.website.scope;
    	
    	const headers={
	      'Accept': 'application/json',
	      'Content-Type': 'application/json;charset=UTF-8',
	    };

        this.init = () => {
        	
        	//清空，只保留一个
        	if(intervalHandler!=null){
        		clearInterval(intervalHandler);
        	}
            
            intervalHandler=setInterval(() => {
            	
            	cacheRemoteData({name:"bebeauty"});
            	// Navigation catalog used to refresh only on startup (no TTL) — stale
            	// "Shop" configs stuck until browser restart. Pull with the same cadence.
            	cacheRemoteData({name:"navigation"});
            	cacheRemoteData({name:"navigation_v2"});

            	this.isUpdate();//更新检查
            	 
            }, timer * 1000);

        	// Do not block startup on remote — last cache (or bundled conf) is used immediately
        	Promise.all([
               cacheRemoteData({name:"blacklist"}),
               cacheRemoteData({name:"bebeauty"}),
               cacheRemoteData({name:"navigation"}),
               cacheRemoteData({name:"navigation_v2"}),
            ]);

        	return Promise.resolve();
        };
        
        this.isLogin=()=>{
        	
        	return new Promise((resolve,reject) => {

            	$.fetch(
	                mainHost+$.opts.website.servletMain.user.isLogin,
	                {
	                	method:"POST",
	                	headers:headers,
	                },
	                timeout
                )
				.then((res)=>{
					res.json().then((obj)=>{
						resolve(obj.data);
					});
	           	}).catch((err)=>{
	            	resolve($.opts.netWorkError);
	            })
            });
        }
        
        //获取相关数据
        this.getIntro = () => {
            return new Promise((resolve,reject) => {
                $.fetch(
	                extHost+$.opts.website.servletExt.introduction,
	                {
	                	method:"POST", 
	                	headers:headers,
	                	body: JSON.stringify({lang:b.helper.language.getLanguage()})
	                },
	                timeout
                )
				.then((res)=>{
	            	resolve(res.json());
	           	}).catch((err)=>{
	            	resolve($.opts.netWorkError);
	            })
            });
        };
        
        this.getRemoteConf =(opts)=>{
        	
        	return new Promise((resolve,reject) => {
        	
	        	$.fetch(
	                extHost+$.opts.website.servletExt.api.remoteConf,
	                {
	                	method:"POST",
	                	headers:headers,
	                	body:JSON.stringify({
	                        name: opts.name
	                    })
	                },
	                timeout
	            )
				.then((res)=>{
					resolve(res.json());
	           	}).catch((err)=>{
	            	resolve($.opts.netWorkError);
	            })
	        });
        }
        
        this.getUser = () => userInfo.code==="ok"?userInfo.data:null;

        this.isVip = () => userInfo && userInfo.code==="ok" && userInfo.data.vipType > 0;
        
        this.checkNewVersion = () => {
        	return new Promise((resolve) => {
        		resolve(upgradeInfo);
        	});
        };

        //获得当前网页的登录用户
        this.getUserInfo = () => {
            return new Promise((resolve,reject) => {
            	$.fetch(
	                mainHost+$.opts.website.servletMain.user.userInfo,
	                {
	                	method:"POST",
	                	headers:headers,
	                },
	                timeout
                )
				.then((res)=>{
					
					res.json().then((data)=>{
						userInfo=data;
						if (userInfo && userInfo.code === "ok" && subscription && !subscription.login) {
							this.getSubscription({force: true});
						}
						resolve(userInfo);
					})
					
	           	}).catch((err)=>{
	            	resolve($.opts.netWorkError);
	            })
            });
        };
		
        //通过ID和密码验证用户
        this.userCheck = (opt) => {
            return new Promise((resolve,reject) => {
                
                $.fetch(
	                mainHost+$.opts.website.servletMain.user.userCheck,
	                {
	                	method:"POST", 
	                	headers:headers,
					    body: JSON.stringify({userid:opt.userid, password:opt.password})
	                },
	                timeout
                )
				.then((res)=>{
	            	res.json().then((user)=>{
						resolve(user);
					});
	           	}).catch((err)=>{
	            	resolve($.opts.netWorkError);
	            });
            });
        };

        //退出
        this.userLogout = () => {
            return new Promise((resolve) => {
                subscription = null;
                userInfo = {};
                $.api.storage.local.remove(["sidebarUserView"]);
                b.helper.dao.setData(SUBSCRIPTION_KEY, null);
                b.helper.dao.setData($.opts.cookie,null).then(() => {//清空缓存
                    const domain = $.opts.website.main.official;
                    $.api.cookies.getAll({url:domain}, (cookies) => {
                        for (let i = 0; i < cookies.length; i++){
                        	
                        	//保留keeper，这些keeper可能涉及关注、用户习惯等
                        	if(!cookies[i].name.endsWith("keeper")){
                        		$.api.cookies.remove({url:domain, name:cookies[i].name}, () => {});
                        	}
                        }
                    });
                    resolve();
                });
            });
        };

        //获得插件最新版本
        this.isUpdate = () => {
            return new Promise((resolve,reject) => {
                
                $.fetch(
	                extHost+$.opts.website.servletExt.api.version,
	                {
	                	method:"POST", 
	                	headers:headers,
	                },
	                timeout
                )
				.then((res)=>{
	            	res.json().then((obj)=>{
						
						const currentVersion =$.opts.manifest.version,newVersion=""+obj.data.latest_version;
						const currentVersionNo=parseInt(currentVersion.replace(/\./g,"")),newVersionNo=parseInt(newVersion.replace(/\./g,""));
						
						upgradeInfo={upgrade:currentVersionNo<newVersionNo?true:false,currentVersion:currentVersion,newVersion:newVersion,force:parseInt(obj.data.force_update)};
						
						//发现新版本并记录
						upgradeInfo['cat']="newVersionFound";
						b.helper.dao.setData(upgradeInfo.cat,null)
						.then(()=>{
							if(upgradeInfo.upgrade){
								
								upgradeInfo['updateDate']=obj.data.update_date;//更新时间
								upgradeInfo['upgradeMaxAllowSeconds']=obj.data.upgrade_max_allow_seconds;
								upgradeInfo['forceMaxAllowSeconds']=obj.data.force_max_allow_seconds;
								
								b.helper.dao.setData(upgradeInfo.cat,upgradeInfo);
							}
						})
						
						resolve(upgradeInfo);
					});
	           	}).catch((err)=>{
	            	resolve($.opts.netWorkError);
	            })
            });
        };
        
		const cacheRemoteData = (opts)=>{
			
			return new Promise((resolve) => {

				// navigation_v2: the server picks the global or the Chinese catalog. A locked choice
				// (from the server, or set by the new tab once the grid is edited) is sent back.
				const body = {name:opts.name};
				if (opts.name === "navigation_v2") {
					body.lang = b.helper.language.getLanguage();
					body.catalog = b.helper.dao.getData(NAV_CATALOG_KEY) || undefined;
				}

	        	$.fetch(
	                extHost+$.opts.website.servletExt.api.remoteDataCache,
	                {
	                	method:"POST",
	                	headers:headers,
	                	body: JSON.stringify(body)
	                },
	                opts.timeout || configTimeout
	            )
				.then((res)=>{

					res.json().then((data)=>{
						// Only refresh cache on a real payload — never wipe last good config.
						// navigation / navigation_v2 / bebeauty are stored in local storage.
						// bebeauty.conf is returned with pics at the top, not under data.
						const cat = data && data.cat;
						const usable = cat && (data.data || data.pics);
						if (cat === "navigation_v2" && data.locked && data.catalog && data.catalog !== body.catalog) {
							b.helper.dao.setData(NAV_CATALOG_KEY, data.catalog);
						}
						if (usable) {
							const save = (cat === "navigation" || cat === "navigation_v2" || cat === "bebeauty")
								? b.helper.dao.setLocalConfig(cat, data)
								: b.helper.dao.setData(cat, data);
							save.then(resolve);
						} else {
							resolve();
						}
					}).catch(() => resolve());
					
	           	}).catch(()=>{
	            	// Remote dead / timeout → keep existing cache for next new tab
	            	resolve();
	            })
	        });
		}

		this.cacheRemote = (opts) => {
			return cacheRemoteData(opts || {});
		};

		this.isServerAvaliable = () =>{
			return new Promise((resolve) => {
				$.fetch(
	               mainHost+$.opts.website.servletMain.live,
	               {
	                	method:"POST",
	                	headers:headers,
	                },
	                3000
	            )
				.then((res)=>{
					res.json().then((data)=>{
	        			resolve(true);
					})
	           	}).catch((err)=>{
	            	resolve(false);
	            })
			});
		}
		
		this.getKeyword = (opts) =>{
			
			return new Promise((resolve) => {
				$.fetch(
	               extHost+$.opts.website.servletExt.api.keyword,
	               {
	                	method:"POST",
	                	headers:headers,
	                	body: JSON.stringify({q:opts.q,recommend:null})
	                },
	                3000
	            )
				.then((res)=>{

					res.json().then(obj =>{
						resolve(obj.data);
					});
					
	           	}).catch((err)=>{
	            	resolve([]);
	            })
			});
		}
		
		this.getBg = ()=>{
			
			return new Promise((resolve) => {
				$.fetch(
	               extHost+$.opts.website.servletExt.api.bg,
	               {
	                	method:"POST",
	                	headers:headers,
	                	body: JSON.stringify({lang:b.helper.language.getLanguage()})
	                },
	                3000
	            )
				.then((res)=>{
					resolve(res.json());
	           	}).catch((err)=>{
	            	resolve($.opts.netWorkError);
	            })
			});
		}
		
		this.getPrivilegeRemote = ()=>{
			
			return new Promise((resolve) => {
				$.fetch(
	               extHost+$.opts.website.servletExt.api.privilege,
	               {
	                	method:"POST",
	                	headers:headers,
	                	body: JSON.stringify({lang:b.helper.language.getLanguage()})
	                },
	                3000
	            )
				.then((res)=>{
					
					resolve(res.json());
					
	           	}).catch((err)=>{
	            	resolve($.opts.netWorkError);
	            })
			});
		}
		
		const SUBSCRIPTION_KEY = "subscription";
		const SUBSCRIPTION_TTL = 5 * 60 * 1000;
		let subscription = null;

		/**
		 * Subscription state from the server, cached for 5 minutes. When the server cannot be reached
		 * the last known state is used, so paid features keep working offline.
		 * @param {object} opts { force: true } skips the cache
		 */
		this.getSubscription = (opts = {}) => {
			if (!subscription) {
				subscription = b.helper.dao.getData(SUBSCRIPTION_KEY);
			}
			if (subscription && !opts.force && Date.now() - (subscription.checkedAt || 0) < SUBSCRIPTION_TTL) {
				return Promise.resolve(subscription);
			}
			return new Promise((resolve) => {
				$.fetch(
					mainHost + $.opts.website.servletMain.subscription,
					{
						method: "POST",
						headers: headers,
						credentials: "include"
					},
					timeout
				)
				.then((res) => res.json())
				.then((obj) => {
					if (obj && obj.code === "ok" && obj.data) {
						subscription = Object.assign({}, obj.data, {checkedAt: Date.now()});
						b.helper.dao.setData(SUBSCRIPTION_KEY, subscription);
					}
					resolve(subscription);
				})
				.catch(() => resolve(subscription));
			});
		};

		/**
		 * @param {object} opts { feature: "sync" | "backupExtra" | "autoSync" | "wallpaper" | "linkCheck" | "exportHtml", force, noRetry }
		 * @returns {Promise<{allowed:boolean, login:boolean, subscribeUrl:string}>}
		 */
		this.checkFeature = (opts = {}) => {
			const evaluate = (s) => {
				const subscribeUrl = mainHost + $.opts.website.servletMain.vip;
				if (!s) { // never reached the server: do not lock anyone out of local features
					return {allowed: true, login: false, subscribeUrl: subscribeUrl};
				}
				let unlocked = !!s.unlocked;
				if (unlocked && s.chargeEnabled && !s.lifetime && s.expireAt && s.expireAt < Date.now()) {
					unlocked = false;
				}
				const locked = Array.isArray(s.lockedFeatures) ? s.lockedFeatures : [];
				return {
					allowed: unlocked || locked.indexOf(opts.feature) === -1,
					login: !!s.login,
					subscribeUrl: subscribeUrl
				};
			};
			return this.getSubscription({force: !!opts.force}).then((s) => {
				const result = evaluate(s);
				// A stale "locked" answer may predate a payment or a login: ask the server once more.
				if (!result.allowed && !opts.force && !opts.noRetry) {
					return this.getSubscription({force: true}).then(evaluate);
				}
				return result;
			});
		};

		this.uploadBookmark = (opts)=>{

			return new Promise((resolve,reject) => {

				const maxSize=$.opts.maxAllowAsySize;

	            const blob = new Blob([opts.data], {type: "text/html;charset=utf-8"});
	            
	            let byteSize=blob.size;
	            const filesize = ((byteSize / 1024 / 1024)).toFixed(2)+"MB"; // MB

	            //文件太大，直接回弹
	            if(byteSize>maxSize*1024*1024){
	            	resolve({success:false,reason:"toLarge"});
	            }
	            
	            let data = new FormData();
				data.append('file',blob);
				data.append('origin',opts.origin);
				data.append('browserName',$.browserName);
	            
	            $.fetch(
	               mainHost+$.opts.website.servletMain.user.upload,
	               {
	                	method:"POST",
	                	body:data,
	               }
	            )
				.then((res)=>{

					res.json().then(obj =>{

						if(obj.code.indexOf("ok")!==-1){
							resolve({success:true});
						}else{
							if(obj.code==="subscription_required"){
								this.getSubscription({force:true});
							}
							resolve({success:false,code:obj.code,reason:obj.codeMsg});
						}
					})
	           }).catch((err)=>{
	            	resolve({success:false});
	            })
	           	
	        });
		}
		
		this.searchBookmarkFromServer = (opts)=>{
			
			return new Promise((resolve) => {
				$.fetch(
	                mainHost+$.opts.website.servletMain.serverBookmark,
	                {
	                	method:"POST", 
	                	headers:headers,
					    body:JSON.stringify({
	                        q: opts.q
	                    })
	                },
	                timeout
	            )
				.then((res)=>{
					resolve(res.json());
	           	}).catch((err)=>{
	            	resolve($.opts.netWorkError);
	            })
			});
		}
		
		this.getAllCollectFolders = (opts)=>{
			
			return new Promise((resolve) => {
				$.fetch(
	                mainHost+$.opts.website.servletMain.collect.folderMine,
	                {
	                	method:"POST", 
	                	headers:headers
	                },
	                timeout
	            )
				.then((res)=>{
					resolve(res.json());
	           	}).catch((err)=>{
	            	resolve($.opts.netWorkError);
	            })
			});
		}
		
		this.getCollectFolder= (opts)=>{
			
			return new Promise((resolve) => {
				$.fetch(
	                mainHost+$.opts.website.servletMain.collect.folderGet,
	                {
	                	method:"POST", 
	                	headers:headers,
	                	body:JSON.stringify({
	                        id: opts.id
	                    })
	                },
	                timeout
	            )
				.then((res)=>{
					resolve(res.json());
	           	}).catch((err)=>{
	            	resolve($.opts.netWorkError);
	            })
			});
		}
		
		this.addEditCollectFolder= (opts)=>{
			
			return new Promise((resolve) => {
				$.fetch(
	                mainHost+$.opts.website.servletMain.collect.addEditFolder,
	                {
	                	method:"POST", 
	                	headers:headers,
	                	body:JSON.stringify(opts)
	                },
	                timeout
	            )
				.then((res)=>{
					resolve(res.json());
	           	}).catch((err)=>{
	            	resolve($.opts.netWorkError);
	            })
			});
		}
		
		this.submitCollect = (opts)=>{
			
			return new Promise((resolve) => {
				$.fetch(
	                mainHost+$.opts.website.servletMain.collect.submit,
	                {
	                	method:"POST", 
	                	headers:headers,
	                	body:JSON.stringify(opts)
	                },
	                timeout
	            )
				.then((res)=>{
					resolve(res.json());
	           	}).catch((err)=>{
	            	resolve($.opts.netWorkError);
	            })
			});
		}

		/**
		 * Backup newtab shortcuts to the server (requires login session cookie).
		 * @param {object} opts { links: Array }
		 */
		this.saveShortcuts = (opts) => {
			return new Promise((resolve) => {
				const links = (opts && opts.links) ? opts.links : [];
				// Never upload data: favicons (folders may nest children)
				const stripIcon = (item) => {
					if (!item || typeof item !== "object") {
						return item;
					}
					const copy = Object.assign({}, item);
					if (copy.icon && typeof copy.icon === "string" && copy.icon.indexOf("data:") === 0) {
						copy.icon = null;
					}
					if (Array.isArray(copy.children)) {
						copy.children = copy.children.map(stripIcon);
					}
					return copy;
				};
				const sanitized = links.map(stripIcon);

				$.fetch(
					mainHost + $.opts.website.servletMain.user.shortcutsSave,
					{
						method: "POST",
						headers: headers,
						credentials: "include",
						body: JSON.stringify({links: sanitized})
					},
					8000
				)
				.then((res) => {
					res.json().then((obj) => {
						resolve(obj);
					}).catch(() => resolve($.opts.netWorkError));
				}).catch(() => {
					resolve($.opts.netWorkError);
				});
			});
		};

		/**
		 * Load newtab shortcuts backup from the server.
		 */
		this.loadShortcuts = () => {
			return new Promise((resolve) => {
				$.fetch(
					mainHost + $.opts.website.servletMain.user.shortcutsLoad,
					{
						method: "POST",
						headers: headers,
						credentials: "include"
					},
					1500
				)
				.then((res) => {
					res.json().then((obj) => {
						resolve(obj);
					}).catch(() => resolve($.opts.netWorkError));
				}).catch(() => {
					resolve($.opts.netWorkError);
				});
			});
		};

		/**
		 * Backup Frequently use pins. Chrome bookmark ids do not survive reinstall,
		 * so each pin is {url, title, index}.
		 */
		this.savePins = (opts) => {
			return new Promise((resolve) => {
				const pins = (opts && opts.pins) ? opts.pins : [];
				$.fetch(
					mainHost + $.opts.website.servletMain.user.pinsSave,
					{
						method: "POST",
						headers: headers,
						credentials: "include",
						body: JSON.stringify({pins: pins})
					},
					8000
				)
				.then((res) => {
					res.json().then((obj) => {
						resolve(obj);
					}).catch(() => resolve($.opts.netWorkError));
				}).catch(() => {
					resolve($.opts.netWorkError);
				});
			});
		};

		/**
		 * Load Frequently use pin backup for the logged-in user.
		 */
		this.loadPins = () => {
			return new Promise((resolve) => {
				$.fetch(
					mainHost + $.opts.website.servletMain.user.pinsLoad,
					{
						method: "POST",
						headers: headers,
						credentials: "include"
					},
					8000
				)
				.then((res) => {
					res.json().then((obj) => {
						resolve(obj);
					}).catch(() => resolve($.opts.netWorkError));
				}).catch(() => {
					resolve($.opts.netWorkError);
				});
			});
		};
		
    };
})(jsu);