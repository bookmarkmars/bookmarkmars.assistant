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
	        		.append($("<span></span>").html(s.helper.i18n.get("ucenter_register_days")+"："+user.registerDays));

        			info.append($("<a></a>").addClass($.cl.manage.ucenter.logout).html(s.helper.i18n.get("ucenter_logout")));
        			
        			const userInfo=$("<div></div>")
	        		.addClass($.cl.manage.ucenter.userInfo)
	        		.append($("<div></div>").addClass($.cl.manage.ucenter.username).html(s.helper.i18n.get("ucenter_greeting")+user.username))
	        		.append($("<div></div>").addClass($.cl.manage.ucenter.welcome).html(s.helper.i18n.get("ucenter_welcome")))
	        		.append($("<div></div>").addClass("plan"))
	        		.append(info);
	        		
	        		s.elm.ucenter.user.html("");
	        		s.elm.ucenter.user.append(userInfo);
	        		showSubscription(s.elm.ucenter.user.find("div.plan")[0], user);
	        		
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
        
        
        
        const DAY_MS = 24 * 60 * 60 * 1000;
        const LIFETIME_DAYS = -99;
        const SOON_DAYS = 7;
        const ICON_CROWN = "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M2.5 7.5l5 4.2L12 4.5l4.5 7.2 5-4.2-2.1 10.3H4.6L2.5 7.5z\" fill=\"currentColor\"/><rect x=\"4.6\" y=\"19\" width=\"14.8\" height=\"2.2\" rx=\"1.1\" fill=\"currentColor\"/></svg>";

        /**
         * Plan of the logged-in user, worked out from the user info so the card never depends on another request.
         *
         * @returns {{tier: string, expireAt: (number|null)}} tier: free | pro | lifetime | allFree
         */
        const planFromUser = (user) => {
        	const info = user.pluginVipInfo || {};
        	const type = user.vipType || 0;
        	if (type === 2 || info.addDays === LIFETIME_DAYS) {
        		return {tier: "lifetime", expireAt: null};
        	}
        	if (type > 0) {
        		const start = info.startTime ? new Date(info.startTime).getTime() : NaN;
        		return {tier: "pro", expireAt: isNaN(start) ? null : start + info.addDays * DAY_MS};
        	}
        	return {tier: "free", expireAt: null};
        };

        const renderPlan = (box, plan, canManageBilling) => {
        	const i18n = (key, args) => s.helper.i18n.get(key, args || []);
        	const el = (tag, cls, text) => {
        		const node = document.createElement(tag);
        		if (cls) { node.className = cls; }
        		if (text) { node.textContent = text; }
        		return node;
        	};

        	let title = i18n("subscription_free");
        	let desc = i18n("subscription_free_desc");
        	let action = "subscribe_button";
        	let soon = false;
        	if (plan.tier === "allFree") {
        		title = i18n("subscription_all_free");
        		desc = "";
        		action = null;
        	} else if (plan.tier === "lifetime") {
        		title = i18n("subscription_lifetime");
        		desc = "";
        		action = null;
        	} else if (plan.tier === "pro") {
        		title = plan.expireAt ? i18n("subscription_until", [new Date(plan.expireAt).toLocaleDateString()]) : "Pro";
        		const left = plan.expireAt ? Math.max(0, Math.ceil((plan.expireAt - Date.now()) / DAY_MS)) : null;
        		desc = left === null ? "" : i18n("subscription_days_left", [left]);
        		soon = left !== null && left <= SOON_DAYS;
        		action = "subscription_renew";
        	}

        	box.textContent = "";
        	box.setAttribute("data-tier", plan.tier);
        	box.classList.toggle("soon", soon);

        	const badge = el("span", "plan-badge");
        	if (plan.tier === "pro" || plan.tier === "lifetime") {
        		badge.innerHTML = ICON_CROWN;
        		badge.append("PRO");
        	} else {
        		badge.textContent = plan.tier === "allFree" ? "FREE" : i18n("subscription_free").toUpperCase();
        	}

        	const text = el("div", "plan-text");
        	text.append(el("span", "plan-label", i18n("ucenter_subscription")), el("strong", "plan-title", title));
        	if (desc) {
        		text.append(el("span", "plan-desc", desc));
        	}
        	box.append(badge, text);

        	if (action) {
        		const href = s.openVipSug(s.helper.user.getExtensionReturnUrl("#ucenter_basic")).attr("href");
        		const btn = el("a", "plan-action", i18n(action));
        		btn.href = href;
        		btn.target = "_blank";
        		box.append(btn);
        	}
        	if (canManageBilling) {
        		const manage = el("a", "plan-manage", i18n("subscription_manage"));
        		manage.href = $.opts.website.main.official + $.opts.website.scope + "vip/billing/portal";
        		manage.target = "_blank";
        		box.append(manage);
        	}
        };

        const showSubscription = (box, user) => {
        	const plan = planFromUser(user);
        	renderPlan(box, plan, false);

        	s.helper.dao.call("subscription", {force: true}).then((sub) => {
        		if (!sub || !sub.login) {
        			return;
        		}
        		if (!sub.chargeEnabled) {
        			plan.tier = "allFree";
        		} else if (sub.lifetime) {
        			plan.tier = "lifetime";
        		} else if (sub.subscribed) {
        			plan.tier = "pro";
        			plan.expireAt = sub.expireAt || plan.expireAt;
        		} else {
        			plan.tier = "free";
        		}
        		renderPlan(box, plan, !!sub.canManageBilling);
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