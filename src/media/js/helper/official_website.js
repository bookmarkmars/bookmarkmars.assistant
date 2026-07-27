($ => {
    "use strict";
	
    $.OfficialWebsiteHelper = function (ext){
    	
    	let bookmarkHtml="";
    	
    	const protect=[
    		"127.0.",
    		"192.168.",
    		"bookmarkearth.cn",
    		"bookmarkmars.com"
    	]
		
        this.init = ()=>{

            if(this.isOfficialWeb()){
            	const url = window.location.href;
            	if(url.indexOf("plugin/vip/activated")!=-1){
                    updateUserData();
                }
            }
        };
        
        
        this.isOfficialWeb=()=>{
        	const host = window.location.host;
            const url = window.location.href;
            return protect.some(e => host.indexOf(e) !=-1 );
        }
        
        this.isChargePage=()=>{
        	if(this.isOfficialWeb){
        		
        	}
        	return false;
        }
    };
})(jsu);