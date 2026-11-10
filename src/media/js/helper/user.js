($ => {
    "use strict";
   
    $.UserHelper = function (ext) {
    	
    	const userInfo={
    		isLogin:null,
    		user:null,
    	};

    	// Sidebar avatar only. Full profile still comes from user-info when the cache is stale.
    	const CACHE_KEY = "sidebarUserView";
    	const CACHE_TTL = 10 * 60 * 1000;
    	let memoryUser = null;

    	const viewOf = (user) => {
    		if (!user || !user.avatar) {
    			return null;
    		}
    		return {
    			username: user.username || "",
    			avatar: user.avatar,
    			vipType: user.vipType || 0,
    			vipTypeDesc: user.vipTypeDesc || ""
    		};
    	};

    	const readCache = () => {
    		return new Promise((resolve) => {
    			$.api.storage.local.get([CACHE_KEY], (obj) => {
    				resolve(obj[CACHE_KEY] || null);
    			});
    		});
    	};

    	const writeCache = (user) => {
    		memoryUser = viewOf(user);
    		$.api.storage.local.set({
    			[CACHE_KEY]: { at: +new Date(), user: memoryUser }
    		});
    	};

    	const needLogin=["tool_backup","tool_linkcheck"]

       	this.serverState = ()=>{
        	return new Promise((resolve) => {
	        	ext.helper.dao.call("serverState").then(res=>{
	        		resolve(res);
	        	})
	        });
        }

        /**
         * Build extension manage return URL (hash only, e.g. "#ucenter_basic").
         *
         * @param {string|null} hash
         * @returns {string}
         */
        this.getExtensionReturnUrl = (hash = null) => {
        	const h = (hash && String(hash).charAt(0) === "#") ? String(hash) : "#ucenter";
        	return $.api.runtime.getURL("html/manage.html") + h;
        };

        /**
         * Open site login; background returns this tab to the extension after success.
         *
         * @param {string|null} callback hash, e.g. "#ucenter_basic"
         */
        this.login = (callback=null) =>{
        	ext.helper.dao.call("openLogin", {
        		returnUrl: this.getExtensionReturnUrl(
        			callback != null ? callback : (typeof location !== "undefined" ? location.hash : null)
        		)
        	});
        }
        
        this.asyUserInfo = ()=>{
    		return new Promise((resolve) => {
        		ext.helper.dao.call("userInfo").then((res)=>{

        			if(res && res.code === "ok"){
        				userInfo.user=res.data;
        				writeCache(res.data);
        			} else if (!(res && res.codeMsg === "networkFail")) {
        				userInfo.user=null;
        				writeCache(null);
        			}
        			resolve();
        		});
        	});
    	}

        /**
         * Paint the header avatar from the last saved view. Does not hit the network.
         */
        this.applyCachedHeader = () => {
        	return readCache().then((bag) => {
        		memoryUser = bag && bag.user ? bag.user : null;
        		if (memoryUser && !userInfo.user) {
        			userInfo.user = memoryUser;
        		}
        		if (bag) {
        			this.applyHeaderUser(memoryUser);
        		}
        	});
        };

        /**
         * Show the cached avatar immediately, then refresh user-info only when the cache is older than 10 minutes.
         */
        this.warmHeader = () => {
        	return readCache().then((bag) => {
        		const fresh = !!(bag && bag.at && (+new Date() - bag.at < CACHE_TTL));
        		memoryUser = bag && bag.user ? bag.user : null;
        		if (memoryUser && !userInfo.user) {
        			userInfo.user = memoryUser;
        		}
        		if (bag) {
        			this.applyHeaderUser(memoryUser);
        		}
        		if (fresh) {
        			return;
        		}
        		return this.asyUserInfo().then(() => {
        			this.applyHeaderUser(this.getUser());
        		});
        	});
        };

        /**
         * @param {object|null} user display fields only
         */
        this.applyHeaderUser = (user) => {
        	if (!ext.elm.header || !ext.elm.header.toolBox) {
        		return;
        	}
        	const ucenter = ext.elm.header.toolBox.find("a[" + $.attr.name + "='ucenter']");
        	if (!ucenter || ucenter.length() === 0) {
        		return;
        	}
        	const img = ucenter.find("> img");
        	ucenter.find("> span").remove();
        	if (!user || !user.avatar) {
        		ucenter.attr($.attr.title, ext.helper.i18n.get("header_toolbox_ucenter"));
        		img.attr("src", $.api.runtime.getURL("media/img/icon/header/ucenter.png"));
        		return;
        	}
        	if (ext.helper.util.getNoticeFromBall() === ext.helper.i18n.get("not_login_notice")) {
        		ext.helper.util.removeNoticeFromBall();
        	}
        	ucenter.attr($.attr.title, user.username);
        	img.attr("src", user.avatar);
        	if (user.vipType > 0) {
        		$("<span></span>")
        		.attr($.attr.title, user.vipTypeDesc)
        		.attr($.attr.type, user.vipType === 1 ? "vip" : "supervip")
        		.addClass($.cl.header.notify)
        		.insertBefore(img);
        	}
        };
        
        this.asyLoginInfo = () => {
        	
        	return new Promise((resolve) => {
        		ext.helper.dao.call("isLogin").then((res)=>{
        			
        			if(res && res.codeMsg !== "undefined" && res.codeMsg ==="networkFail"){
        				userInfo.isLogin=false;//网断了认为没有登录
        			}
        			else{
        				userInfo.isLogin=res;
        			}
        			resolve();
        		});
        	});
        }
             	
       	this.resetUserInfo = () =>{
       		
       		userInfo.isLogin=null;
       		userInfo.user=null;
       		memoryUser=null;
       		$.api.storage.local.remove([CACHE_KEY]);
       	}
        
        this.vipType = () => userInfo.user.vipType;
        
        this.isVip = () => userInfo && userInfo.user && userInfo.user.vipType > 0;
        
        this.getUser = ()=> userInfo.user;

        this.isLogin = ()=> userInfo.isLogin;
        
        this.needLogin = () => needLogin;
    };
})(jsu);
