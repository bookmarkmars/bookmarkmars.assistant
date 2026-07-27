($ => {
    "use strict";
   
    $.UserHelper = function (ext) {
    	
    	const userInfo={
    		isLogin:null,
    		user:null,
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
        			}
        			resolve();
        		});
        	});
    	}
        
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
       	}
        
        this.vipType = () => userInfo.user.vipType;
        
        this.isVip = () => userInfo && userInfo.user && userInfo.user.vipType > 0;
        
        this.getUser = ()=> userInfo.user;

        this.isLogin = ()=> userInfo.isLogin;
        
        this.needLogin = () => needLogin;
    };
})(jsu);
