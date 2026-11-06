($ => {
    "use strict";

    $.BackupHelper = function (s) {
    	
        /**
         * Initialises the appearance settings
         *
         * @returns {Promise}
         */
        this.init = () => {
			
			return new Promise((resolve) => {
				initState();
				initEvent();
				
				if(s.helper.user.isLogin()){
					s.helper.privilege.init().then(()=>{
						this.userPrivilegeDesc();
						resolve();
					})
				}else{
					resolve();
				}
			});
        };
        
        const initState = ()=>{
        	
        	const backupBox=s.elm.backup.content;
        	const authorized=s.helper.dao.getData("b/backupAuthorized");
        	const autoBackup=s.helper.dao.getData("b/autoBackup");
        	const recordVisit=s.helper.dao.getData("b/recordVisit");
        	
        	
        	[{"authorize":authorized},{"auto-backup":autoBackup},{"record-visit":recordVisit}].forEach((obj)=>{
        		for (const key in obj) {
				    let box=backupBox.find("> div."+key).find("div."+$.cl.checkbox.box);
		      		if(!obj[key]){
		      			box.removeClass([$.cl.active,$.cl.checkbox.focus]);
		      		}else{
		      			box.addClass([$.cl.active,$.cl.checkbox.focus]);
		      		}
				}
        	});
        }
        
        const initEvent = () => {
        	
        	//常量
        	const backupBox=s.elm.backup.content;
        	
        	backupBox.on("click"," > button."+$.cl.manage.backup.manual,(e)=>{
        		this.manualBackup(e);
        	});
       	}
        
        this.userPrivilegeDesc= ()=>{
        	
        	const privilege=s.helper.privilege.getPrivilege();
    		if(privilege.title!==null && privilege.notice!==null){//show
				s.elm.backup.content.parent("div").find(" > p.desc").text(privilege.notice);
				s.elm.backup.all.find("div.title > p.desc").text(privilege.title);
			}
        }

        this.manualBackup = (e) =>{
        	
        	$.api.storage.sync.get(["behaviour"], (conf) => {
        		
        		if(!conf.behaviour.backupAuthorized){
        			s.createToast(s.helper.i18n.get("manage_tool_backup_authorize_first"));
        			return;
        		}
        		
        		if(!s.helper.user.isLogin()){
	        		s.createToast(s.helper.i18n.get("manage_tool_backup_login_first"));
	        		return;
	        	}

        		s.requireFeature("sync", "#tool_backup").then((allowed) => {
        			if(allowed){
        				upload(e);
        			}
        		});
        	});
        }

        const upload = (e) => {

        		let that=$(e.target);
	        	let oText=that.text();
	        	
	        	//do it
	        	const loader = s.helper.template.loading().appendTo(s.elm.body);

	        	that.text(s.helper.i18n.get("manage_tool_backup_import_bookmark"));//导出书签中
	        	
	        	s.helper.dao.call("createBookmarkHtml", {name: s.helper.i18n.get("manage_tool_backup_name")}).then((data) => {
	        		
	        		that.text(s.helper.i18n.get("manage_tool_backup_upload_bookmark"));//上传中
	        		
	        		return s.helper.dao.call("uploadBookmark",{data:data,origin:"m"});

	        	}).then((obj)=>{
	        		
	        		return new Promise((resolve) => {

	        			const rs=s.elm.backup.all.find("div."+$.cl.result);
	        			rs.find("div.stress").html("");
	        			
	        			if(obj.success){
	        				
	        				let tip=s.helper.i18n.get("manage_tool_backup_upload_success");
	        				rs.find("div.stress").html(tip);
	        				rs.addClass($.cl.visible);
						    s.createToast(tip);
						}
						else if(obj.code==="subscription_required"){
							s.showSubscribeDialog("sync", "#tool_backup");
						}
						else if(obj.code && obj.reason){
							
							let tip=s.helper.i18n.get("manage_tool_backup_fail") +"，" + obj.reason;
							rs.find("div.stress").html(tip);
	        				rs.addClass($.cl.visible);
							s.createToast(tip);
							
							if(obj.code==="backup_exceed_max_times"){
								s.elm.backup.content.find("label."+$.cl.manage.titleHandler).html(s.helper.i18n.get("manage_tool_backup_intro",[1],false)).append(s.openVipSug(s.helper.user.getExtensionReturnUrl(location.hash || "#tool_backup")));
							}

						}else if(obj.reason==="toLarge"){
							
							let tip=s.helper.i18n.get("manage_tool_backup_fail") +"，" + s.helper.i18n.get("manage_tool_backup_upload_too_large",[$.opts.maxAllowAsySize],false);
							rs.find("div.stress").html(tip);
	        				rs.addClass($.cl.visible);
							s.createToast(tip);
						}
						else{
							
							let tip=s.helper.i18n.get("manage_tool_backup_fail") +"，" + s.helper.i18n.get("manage_tool_backup_upload_fail");
							rs.find("div.stress").html(tip);
	        				rs.addClass($.cl.visible);
							s.createToast(tip);
						}
						
						resolve();
					});
        		})["finally"](()=>{
        			$.delay(200).then(()=>{
	        			that.text(oText);
	        			loader.remove();
	        		})
        		});
        }
    };
    
})(jsu);