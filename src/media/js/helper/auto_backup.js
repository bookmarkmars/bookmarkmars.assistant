($ => {
    "use strict";
   
    $.AutoBackupHelper = function (ext) {
    	
    	this.init = ()=>{
    	   
    	   //同步登录信息
    	   ext.helper.user.asyLoginInfo().then(()=>{
    	   		
    	   		ext.helper.util.removeNoticeFromBall();
    	   		
    	   		//检查更新
	    		ext.helper.dao.call("checkNewVersion")//同步更新信息
		   		.then((res)=>{

		   			if(!ext.helper.user.isLogin()){
    	   			
    	   				ext.helper.util.printNoticeOnBall(ext.helper.i18n.get("not_login_notice"),ext.elm.indicator.ball.css("height"));
	    	   		}
	    	   		else{
	    	   			backup();//登录后再谈backup
	    	   		}

	    	   		//写到最后，覆盖消息
	    	   		if(res && res.upgrade){
	    	   			
	    	   			ext.helper.util.removeNoticeFromBall();
	    	   			ext.helper.util.printNoticeOnBall(ext.helper.i18n.get("extension_need_upgrade"),ext.elm.indicator.ball.css("height"));
		   			}
		   		})
    	   });
        };

    	const backup = () =>{

        	ext.helper.dao.call("getValue",{key:"backupRequest"})
        	.then((res)=>{
        		
        		if(res && res.push){
        			
        			//载入新页面以后，发现有变动的书签，则开始同步
        			ext.helper.dao.call("asyBookmark", {name: ext.helper.i18n.get("manage_tool_backup_name")}).then((res)=>{
        				
        				//ext.log(res);
        				
        				//有些信息可以即及时回，短暂的提示用户，只有在用户操作了书签以后才会执行
        				if(res && !res.success){
        					
        					const reason=res.reason;
        					
        					switch (reason) {
				                case "noPermission": {
				                    ext.helper.util.createToast(ext.helper.i18n.get("manage_tool_backup_auto_tip"));
				                    break;
				                }
				                case "tooMany": {
				                	const privilege=ext.helper.privilege.getPrivilege();
				                  	ext.helper.util.createToast(ext.helper.i18n.get("manage_tool_backup_auto_max",[privilege.maxAllowNum],false));
				                    break;
				                }
				            }
        				}
        			});
        			
        			//取消请求标记
        			ext.helper.dao.call("setValue",{key:"backupRequest",value:null});
        		}
        	});
        }
    };
})(jsu);