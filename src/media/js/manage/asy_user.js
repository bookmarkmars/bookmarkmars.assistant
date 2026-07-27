($ => {
    "use strict";

    $.AsyUserHelper = function (s) {
    	
        this.init = async () => {
			
			await  this.asyUserInfo();
			
        };
        
        this.asyUserInfo=()=>{

        	return new Promise((resolve) => {
        		s.helper.user.serverState().then((yes)=>{
        			
        			if(yes){
        				
        				return Promise.all([
			               s.helper.user.asyLoginInfo(),
			               s.helper.user.asyUserInfo()
			            ]).then(resolve);
        			}
        			resolve();
        		});
        		resolve();
        	});
        }
    };
    
})(jsu);