($ => {
    "use strict";

    $.UcenterHelper = function (s) {
    	
        this.init = () => {
			return new Promise((resolve) => {
				
				
				const user=s.helper.user.getUser();
		
        		//已经登录的情况下
        		if(user){
        			
        			const info=$("<div></div>")
	        		.addClass($.cl.manage.ucenter.info)
	        		.append($("<span></span>").html(s.helper.i18n.get("ucenter_ip")+"："+user.loginIp))
	        		.append($("<span></span>").html(s.helper.i18n.get("ucenter_register_days")+"："+user.registerDays))
	        		.append($("<span></span>").html(s.helper.i18n.get("ucenter_account_type")+"："+user.vipTypeDesc));

        			info.append($("<a></a>").addClass($.cl.manage.ucenter.logout).html(s.helper.i18n.get("ucenter_logout")));
        			
        			const userInfo=$("<div></div>")
	        		.addClass($.cl.manage.ucenter.userInfo)
	        		.append($("<div></div>").addClass($.cl.manage.ucenter.username).html(s.helper.i18n.get("ucenter_greeting")+user.username))
	        		.append($("<div></div>").addClass($.cl.manage.ucenter.welcome).html(s.helper.i18n.get("ucenter_welcome")))
	        		.append(info);
	        		
	        		s.elm.ucenter.user.html("");
	        		s.elm.ucenter.user.append(userInfo);
	        		
	        		//重新初始化
	        		bgLoad().then(()=>{
	        			resolve();
	        		});
	        		
        		}else{
					const src=$.api.runtime.getURL("media/img/manage/bg-free-"+s.helper.util.randomIntFromInterval(1,3)+".jpg");
					setBgContent(src,s.helper.i18n.get("ucenter_motto_today"));
					resolve();
				}
        		
        		initEvent();
			});
        };
        
        
        
        const setBgContent = (src,motto) =>{
			const img=s.elm.ucenter.motto.find("img");
			const p=s.elm.ucenter.motto.find("p.large");
			
			img.attr("src",src);
			img.attr($.attr.src,src);
			p.text("[\""+motto+"\"]");
        }

        const bgLoad=()=>{
        	
        	return new Promise((resolve) => {
        		s.helper.dao.call("getBg").then((res)=>{
					if(res.codeMsg !== "undefined" && res.codeMsg ==="networkFail"){
						const src=$.api.runtime.getURL("media/img/manage/bg-free-"+s.helper.util.randomIntFromInterval(1,3)+".jpg");
						setBgContent(src,s.helper.i18n.get("ucenter_motto_today"));
					}
					else{
						setBgContent(res.pic,res.motto);
					}
					resolve();
				});
        	});
        }
        
        const initEvent=()=>{
        	
        	s.elm.ucenter.user.on("click","a."+$.cl.manage.ucenter.logout ,(e) => {
                e.preventDefault();
                s.helper.dao.call("logout").then((res)=>{
                	
                	s.helper.user.resetUserInfo();//重置用户信息
                	return s.helper.dao.call("reinitialize");
                	
                }).then(()=>{
                	$.delay(1200).then(() => {
                        location.reload(true);
                    });
                })
            });
            
            s.elm.ucenter.user.on("click","p.stress" ,(e) => {
                s.helper.user.login(location.hash || "#ucenter_basic");
            });
        	
        }
    };
    
})(jsu);