($ => {
    "use strict";
   
    $.PrivilegeHelper = function (ext) {
    	
    	let privilege={
    		maxAllowNum:5000,
    		maxSize:20,
    		title:null,
    		notice:null
    	};

    	this.init = async ()=>{
    	   await aysPrivilege();
        };

    	this.getPrivilege = () => privilege;
    	
    	this.isLargeBookmark = (num)=>{

      		return {
      			num:num,
      			rs:num>privilege.maxAllowNum?true:false,
      			max:privilege.maxAllowNum,
      		}
      		
      	}
    	
    	const aysPrivilege = ()=>{
    		
    		return new Promise((resolve) => {
        		ext.helper.dao.call("getPrivilegeRemote").then((res) => {
        			if((res.codeMsg === "undefined" || res.codeMsg !=="networkFail")){//show
        				
        				privilege=res;
        				resolve();
        				
        			}else{
        				resolve();
        			}
        		});
        	});
    	}
    };
})(jsu);