($ => {
    "use strict";

    /**
     * @param {object} ext
     * @constructor
     */
    $.BallHelper = function (ext) {
    	
        const delta = 3;
        const timeout = {};
        const toggleArea = {};//不可改变
        const defaultArea= {};//存储召唤球的默认值

		let startX = null;
		let startY = null;
        let hoveredOnce = false;
        let preventPageScroll = null;
        let preventWindowed = null;
        let preventWebapp = null;
        let sidebarWidth = null;
        let sidebarPos = null;

        // Cached drag session (avoids DOM queries / layout work on every mousemove)
        let dragSession = null;
        let dragRafId = null;
        let pendingDragPos = null;

        /**
         * Initializes the sidebar toggle
         *
         * @returns {Promise}
         */
        this.init = async () => {
            
            const data = ext.helper.dao.getData(["b/toggleArea","b/openWay","b/preventPageScroll","b/preventWindowed", "b/preventWebapp", "b/position"]);
			const toggleData=ext.helper.dao.getData("b/toggleArea",true);
			const pageType = ext.helper.util.getPageType();
			
			//位置
            sidebarPos = pageType === $.opts.attr.sidepanel ? "right" : data.position;

            ext.elm.indicator = $("<div></div>")
                .attr("id", $.opts.ids.page.indicator)
                .addClass("notranslate")
                .appendTo($(ext.elm.shadow));
                
            //影藏召唤球
            if(pageType === $.opts.attr.sidepanel){
            	ext.elm.indicator.addClass([$.cl.hidden]);
            }
            
            ext.elm.indicator.ball=$("<div></div>")
            .attr("draggable",false)
            .addClass($.cl.toggle.indicator)
            .appendTo(ext.elm.indicator);

			[0,1,2,3].forEach((val) => {
				ext.elm.indicator.ball.append('<div class="'+$.cl.toggle.circle+'" style="animation-delay: '+val+'s"></div>');
			});
			
			ext.elm.indicator.ball.append($("<div></div>").addClass([$.cl.toggle.collect,$.cl.hidden]));
			
			//影藏召唤球
            if (['all','ball'].indexOf(data.openWay) === -1){
            	ext.elm.indicator.css("display","none");
            }
			
			//防止body的滚动条鼓动
			preventPageScroll = data.preventPageScroll;
     	
        	//提取默认值
        	Object.entries(toggleData).forEach(([key, val]) => {
	            defaultArea[key] = val;
            });

            //展示位置：默认右下角（left/top 为视口比例；null 表示尚未设置）
            let wHObj=ext.helper.util.getWindowWH();
            let wW=wHObj.wW;
            let hH=wHObj.hH;
            data.toggleArea["left"]=data.toggleArea["left"]==null?(wW-data.toggleArea.width) * 1000000000/ (wW* 1000000000):data.toggleArea["left"]; //换算成比例，相对宽度（默认靠右）
			data.toggleArea["top"]=data.toggleArea["top"]==null?(hH-data.toggleArea.height) * 1000000000/ (hH* 1000000000):data.toggleArea["top"]; //换算成比例，相对高度（默认靠下）

            Object.entries(data.toggleArea).forEach(([key, val]) => {
	            toggleArea[key] = val;
            });
            
            //短暂影藏，重启浏览器或者召唤球复位则恢复
            ext.helper.dao.call("getBallState").then(res=>{
            	
            	ext.elm.indicator.ball.css("display","flex");
            	
            	//暂时影藏
            	if(res.hide){
            		ext.elm.indicator.ball.css("display","none");
            	}
            	
            	ext.elm.indicator.ball.css(this.toStyle(toggleArea,true));
            });
            
            //事件监听
            initEvents();
        };
        
        this.toStyle = (obj,scale)=>{
        	
        	let eleStyle={};
        	Object.entries(obj).forEach(([key, val]) => {
        		
        		if(scale && (key==='top' || key==='left')){
        			eleStyle[key] = val * 100 + "%";
        		}
        		else{
        			eleStyle[key] = val + "px";
        		}
            });
            
            //ext.log("-----toggle info-----");
            //ext.log(eleStyle);

            return eleStyle;
        }
        
        this.forceUpgrade = () =>{
        	
        	return new Promise((resolve,reject) => {
        	
		   		ext.helper.dao.call("getValue",{key:"newVersionFound"})
				.then((res)=>{
					
					if(res && res.upgrade){
						
						const timeUpdate=new Date(res.updateDate.replace(
						    /^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)$/,
						    '$4:$5:$6 $2/$3/$1'
						 )).getTime();
						 
						const timeNow=new Date().getTime();
						const diff= parseInt((timeNow-timeUpdate)/1000);//1s=1000ms

						if((res.force ===1 &&  diff > parseInt(res.forceMaxAllowSeconds)) || diff > parseInt(res.upgradeMaxAllowSeconds)){
							resolve(true);
							return;
						}
					}
					
					resolve(false);
				});
			});
        }
        
        const setBallPositionWindowsChange = ()=>{
        	
        	  /*let myWidth = 0, myHeight = 0;
        	  const toggleArea=ext.helper.dao.getData("b/toggleArea",false);
	    	  
	    	  if (typeof (window.innerWidth) == 'number') {
			    myWidth = window.innerWidth;
			    myHeight = window.innerHeight;
			  } else {
			    if (document.documentElement && (document.documentElement.clientWidth || document.documentElement.clientHeight)) {
			      myWidth = document.documentElement.clientWidth;
			      myHeight = document.documentElement.clientHeight;
			    } else {
			      if (document.body && (document.body.clientWidth || document.body.clientHeight)) {
			        myWidth = document.body.clientWidth;
			        myHeight = document.body.clientHeight;
			      }
			    }
			  }
			  
			  //当前位置
			  let left=toggleArea.left;
			  let top=toggleArea.top;
			  let width=toggleArea.width;
			  let height=toggleArea.height;
			  
			  //坐标找不到的情况
			  if(top+height>myHeight || left+width>myWidth){
			  	  
			  	  toggleArea.left=myWidth-width;
			  	  toggleArea.top=myHeight-top;
			  	  
			  	  //重新set位置
			  	  ext.elm.indicator.ball.css(this.toStyle(toggleArea));
			  }
			*/
        }
        
        this.refreshBallPosition = ()=>{
        	
        	const data = ext.helper.dao.getData(["b/openWay"]);
			if (['all','ball'].indexOf(data.openWay) === -1){
	        	ext.helper.util.createToast(ext.helper.i18n.get("extension_ball_not_open"));
	        	return;
	        }
        	
        	//确保不隐藏
        	const defaultData=ext.helper.dao.getData("b/toggleArea",true);
        	const toggleArea=ext.helper.dao.getData("b/toggleArea",false);
        	
        	//恢复默认右下角
        	let wHObj=ext.helper.util.getWindowWH();
        	let wW=wHObj.wW;
        	let hH=wHObj.hH;
        	const ballW=!!toggleArea.width?toggleArea.width:defaultData.width;
        	const ballH=!!toggleArea.height?toggleArea.height:defaultData.height;
      
        	toggleArea["left"]=(wW-ballW) * 1000000000 / (wW * 1000000000);
        	toggleArea["top"]=(hH-ballH) * 1000000000 / (hH * 1000000000);
        	
        	//展示
        	ext.elm.indicator.ball.css(this.toStyle(toggleArea,true));
        	
        	//存储位置
            ext.helper.dao.setData({"b/toggleArea":toggleArea});
            
            ext.helper.dao.call("setBallState", {hide:false}).then(()=>{
            	ext.elm.indicator.ball.css("display","flex");
            })
        }
        
        this.hideBallTemporarily = ()=>{
        	
        	const data = ext.helper.dao.getData(["b/openWay"]);
			if (['all','ball'].indexOf(data.openWay) !== -1){
	        	ext.helper.dao.call("setBallState", {hide:true})
	        	.then(()=>{
	        		ext.elm.indicator.ball.css("display","none");
	        	})
	        }else{
	        	ext.helper.util.createToast(ext.helper.i18n.get("extension_ball_not_open"));
	        }
        }
        
        this.refreshBallSize = () => {
        	
        	const toggleData=ext.helper.dao.getData("b/toggleArea",false);
        	ext.elm.indicator.ball.css(this.toStyle(toggleArea,true));
        };

        /**
         * Closes the sidebar
         */
        this.closeSidebar = () => {
        	
        	ext.helper.contextmenu.close();//关闭contextmenu
        	
        	if(!ext.elm.iframe){return;}
        	
            ext.elm.iframe.removeClass($.cl.sidebar.extLoaded);
            ext.elm.iframe.removeClass($.cl.sidebar.fadeIn);
            ext.elm.panel.removeClass($.cl.toggle.fadeOut)
            
            ext.helper.dao.call("setSidebarState",{state:"close"})
            .then(()=>{
            	$.delay(200).then(()=>{
	            	if(!ext.elm.iframe.hasClass($.cl.sidebar.extLoaded)){
	            		
	            		//打开ball
	            		ext.elm.indicator.removeClass($.cl.hidden);
	            		
	            		$("body").removeClass($.cl.page.noscroll);
	            		
	            		//恢复ucenter图标，如果用户下线则恢复
	            		const user=ext.helper.user.getUser();
	            		if(user===null){
	            			const ucenter=ext.elm.header.toolBox.find("a[" + $.attr.name + "='ucenter']");
			                const img=ucenter.find("> img");
			                	
		                	ucenter.attr($.attr.title,ext.helper.i18n.get("header_toolbox_ucenter"));
		                	img.attr("src",$.api.runtime.getURL("media/img/icon/header/ucenter.png"));
		                	
		                	ucenter.find("> span").remove();//踢除
	            		}
	            	}
	            })
            });
        };

        /**
         * Opens the sidebar
         */
        this.openSidebar = () => {

        	if(!ext.elm.iframe){return;}

        	if (ext.helper.panel && ext.helper.panel.finishEdgeGuide) {
        		ext.helper.panel.finishEdgeGuide();
        	}
        	
        	ext.elm.iframe
        	.addClass([$.cl.sidebar.extLoaded,$.cl.sidebar.fadeIn]);
        	
    		ext.elm.panel.removeClass($.cl.page.hover);//确保不要打开
        	if(ext.elm.iframe.hasClass($.cl.sidebar.extLoaded)){
        		ext.elm.indicator.addClass($.cl.hidden);//立马消失
        		ext.elm.panel.addClass($.cl.toggle.fadeOut);//逐渐消失
        	}
        	
        	ext.initImages();//对于没有加载的图片，重新加载一遍
        	
        	ext.helper.dao.call("setSidebarState",{state:"open"})
            .then(()=>{
            	$.delay(100)
	        	.then(()=>{
	        		return ext.helper.entry.initOnce();//同步一次数据
	        	}).then(()=>{
	        		return ext.helper.user.asyUserInfo();//用户信息更新，减少消耗
	        	}).then(()=>{
		        	if (ext.elm.iframe.hasClass($.cl.sidebar.extLoaded)) {
		                
		                $("body").addClass($.cl.page.noscroll);
		                
		                //开始改变头像，vip标识等
		                const user=ext.helper.user.getUser();
		                if(user!=null){
		                	
		                	if(ext.helper.util.getNoticeFromBall()===ext.helper.i18n.get("not_login_notice")){
		                		ext.helper.util.removeNoticeFromBall();
		                	}
		                	
		                	const ucenter=ext.elm.header.toolBox.find("a[" + $.attr.name + "='ucenter']");
		                	const img=ucenter.find("> img");
		                	
		                	ucenter.attr($.attr.title,user.username);
		                	img.attr("src",user.avatar);
		                	
		                	ucenter.find("> span").remove();//踢除
		                	if(ext.helper.user.isVip()){

		                		$("<span></span>")
		                		.attr($.attr.title,user.vipTypeDesc)
		                		.attr($.attr.type,user.vipType===1?"vip":"supervip")
		                		.addClass($.cl.header.notify)
		                		.insertBefore(img);
		                	}
		                }
		                
		                ext.helper.dao.call("statistics", {
	                        name: "action",
	                        value: {name: "open", value: ext.helper.util.getPageType()}
	                    });

		            }
		        })
            });
        };

        /**
         * Adds the hover class to the iframe,
         * will expand the width of the iframe to 100%, when the mask is hidden (e.g. on the newtab page)
         */
        this.addSidebarHoverClass = () => {
            ext.elm.iframe.addClass($.cl.page.hover);
            ext.elm.iframe.css("width", "");
            hoveredOnce = true;
        };

        /**
         * Removes the hover class from the iframe,
         * will collapse the width of the iframe back to the width of the sidebar, when the mask is hidden (e.g. on the newtab page)
         */
        this.removeSidebarHoverClass = () => {
            
            const contextmenus = ext.elm.iframeBody.find("div." + $.cl.contextmenu.wrapper);
            if (
                contextmenus.length() === 0 &&
                !ext.elm.iframeBody.hasClass($.cl.drag.isDragged)
            ) {
                ext.elm.iframe.removeClass($.cl.page.hover);

                const dataWidth = ext.elm.iframe.data("width");
                if (dataWidth) { // user dragged the sidebar width -> don't take the iframe width of the css file, but from the data attribute
                    ext.elm.iframe.css("width", dataWidth + "px");
                }
            }
        };
        
        /**
         * Start dragging an element (bookmark or directory)
         *
         * @param {Element} node
         * @param {int} x
         * @param {int} y
         */
        const dragstart = (node, x, y) => {

        	const start=(node)=>{
        		
        		const boundClientRect = $(node)[0].getBoundingClientRect();
	        	//删除重复的内容
	        	ext.elm.indicator.find("div."+$.cl.toggle.dragHelper).remove();
	      	    $(node).removeClass($.cl.toggle.isDragged);
	      	    
	      	    const clone=$(node).clone();
	        	const helper = clone.insertBefore($(node));
	      	   
	        	helper.css({
	                top: boundClientRect.top + "px",
	                left: boundClientRect.left + "px",
	                width: toggleArea.width + "px",
	                height: toggleArea.height + "px",
	                opacity: 0,
	                pointerEvents: "none"
	            }).data({
	            	elm: $(node),
	                startPos: {
	                    top: y - boundClientRect.top,
	                    left: x - boundClientRect.left
	                }
	            }).addClass($.cl.toggle.dragHelper);
	            
	            $(node).addClass($.cl.toggle.isDragged);

	            const win = ext.helper.util.getWindowWH();
	            dragSession = {
	            	helper: helper,
	            	ball: $(node),
	            	ballEl: node,
	            	startPos: {
	                    top: y - boundClientRect.top,
	                    left: x - boundClientRect.left
	                },
	            	width: parseInt(toggleArea.width, 10) || boundClientRect.width,
	            	height: parseInt(toggleArea.height, 10) || boundClientRect.height,
	            	wW: win.wW,
	            	hH: win.hH,
	            	hasDraggingClass: false
	            };
	            pendingDragPos = null;
	            if (dragRafId) {
	            	cancelAnimationFrame(dragRafId);
	            	dragRafId = null;
	            }
        	}

        	if(!!node){
        		start(node);//开始移动
        	}
        };
        
        /**
         * Drag an element (bookmark or directory or something external (a link, an image, ...))
         *
         * @param {int} x
         * @param {int} y
         */
        const dragmove = (x, y) => {
        	if (!dragSession || !dragSession.ballEl) {
        		return;
        	}

        	const topVal = y - dragSession.startPos.top;
        	const leftVal = x - dragSession.startPos.left;

        	if (!isMousePosInPixelTolerance(leftVal, topVal, dragSession)) {
        		return;
        	}

        	pendingDragPos = { top: topVal, left: leftVal };

        	if (dragRafId) {
        		return;
        	}

        	dragRafId = requestAnimationFrame(() => {
        		dragRafId = null;
        		if (!dragSession || !pendingDragPos) {
        			return;
        		}

        		const { top, left } = pendingDragPos;
        		const el = dragSession.ballEl;
        		// Direct style + transform compositing path (smoother than jQuery .css each move)
        		el.style.top = top + "px";
        		el.style.left = left + "px";
        		el.style.width = dragSession.width + "px";
        		el.style.height = dragSession.height + "px";
        		el.style.right = "auto";
        		el.style.bottom = "auto";

        		if (!dragSession.hasDraggingClass) {
        			dragSession.ball.addClass($.cl.toggle.isDragging);
        			dragSession.hasDraggingClass = true;
        		}
        	});
        };
        
        const setBallPosition = (top,left)=>{
    		
    		//展示位置
            let wHObj=ext.helper.util.getWindowWH();
            let wW=wHObj.wW;
            let hH=wHObj.hH;
            
            
            //修正部分值，保证不超过边界
            //如果超过边界，强制弹回
            let topR=top / hH;
            if(topR<0){topR=0;}
            if(topR>0.97){topR=0.97;}
            
            let leftR=left / wW;
            if(leftR<0){leftR=0;}
            if(leftR>0.97){leftR=0.97;}
            
            //保存位置
           	return {
        	   top:topR,
               left:leftR,
               width:toggleArea.width,
               height:toggleArea.height,
            };
        }
        
        
        /**
         * Stop dragging an element
         */
        const dragend = async () => {
        	
        	if (dragRafId) {
        		cancelAnimationFrame(dragRafId);
        		dragRafId = null;
        	}

        	let draggedElm = dragSession && dragSession.helper
        		? dragSession.helper
        		: ext.elm.indicator.find("div."+$.cl.toggle.dragHelper);
        	let isDraggedElm = dragSession && dragSession.ball
        		? dragSession.ball
        		: draggedElm.data("elm");
        	
        	$.delay().then(() => {
                
                const boundClientRect = (dragSession && dragSession.ballEl
                	? dragSession.ballEl
                	: draggedElm[0]).getBoundingClientRect();
                let top=boundClientRect.top;
                let left=boundClientRect.left;

            	//getBoundingClientRect可以获取到相关信息，则从球上面获取
                if(top===0 && left===0){
                	top=ext.elm.indicator.find("div.indicator").css("top").replace("px","");
                	left=ext.elm.indicator.find("div.indicator").css("left").replace("px","");
                }
                
                let eleData=setBallPosition(top,left);
                
                ext.log(eleData);
                
                isDraggedElm.css(this.toStyle(eleData,true));

                //存储位置
                ext.helper.dao.setData({"b/toggleArea":Object.assign({},eleData,{min:defaultArea.min})});

                return $.delay(10);
         }).then(() => {
                isDraggedElm.removeClass($.cl.toggle.isDragged);
                isDraggedElm.removeClass($.cl.toggle.isDragging);
                if (draggedElm && draggedElm.remove) {
                	draggedElm.remove();
                }
                dragSession = null;
                pendingDragPos = null;
                reactiveBubble();
            });
        };
        
        const reactiveBubble = ()=>{
        	let content=ext.elm.indicator.ball.html();
    		ext.elm.indicator.ball.html("").html(content);
        };
        
        /*
         *text 固定为5个字，不然会难看 
         */
        this.insertTextSvg = (text)=>{
        	
        	const notification='<svg viewBox="0 0 100 100" class="'+$.cl.sidebar.svgNotice+'">'+
			  '<path id="circle" stroke="transparent" fill="none" d="M20 42 C30 10 80 20 80 42"></path>'+
			  '<text class="caption">'+
			    '<textPath href="#circle">'+text+'</textPath>'+
			  '</text>'+
			'</svg>';
			
			return notification;
        }
        
        /*
         *text 固定为3个字，不然会难看 
         */
        this.insertTextSpan = (text,fontSize)=>{
        	
        	let fontSizeNum=parseInt(fontSize.replace("px",""));
        	
        	return $("<span></span>")
        	.css("font-size","16px")//大部分浏览器默认字体为16px，这里以16px为基准
        	.css("zoom",fontSizeNum/100)
        	.addClass($.cl.notification)
        	.html(text);
        }
        
         /**
         * Cancels the dragging and resets the position of the dragged element
         */
        this.cancel = () => {
        	if (dragRafId) {
        		cancelAnimationFrame(dragRafId);
        		dragRafId = null;
        	}
            let draggedElm = dragSession && dragSession.helper
            	? dragSession.helper
            	: ext.elm.indicator.find("div."+$.cl.toggle.dragHelper);
        	if(draggedElm){
	    		if(dragSession && dragSession.ball){
	    			dragSession.ball.removeClass($.cl.toggle.isDragged);
	    			dragSession.ball.removeClass($.cl.toggle.isDragging);
	    		} else if(draggedElm.data("elm")){
	    			draggedElm.data("elm").removeClass($.cl.toggle.isDragged);
	    		}
	        	draggedElm.remove();
            }
        	ext.elm.indicator.find("div."+$.cl.toggle.isDragging).removeClass($.cl.toggle.isDragging);
        	dragSession = null;
        	pendingDragPos = null;
        };
        
        const hideCollectButt = ()=>{
        	
        	//影藏收藏按钮
        	if(!ext.elm.indicator.ball.find("div."+$.cl.toggle.collect).hasClass($.cl.hidden)){
        		ext.elm.indicator.ball.find("div."+$.cl.toggle.collect).addClass($.cl.hidden);
        	}
        }

        /**
         * Initializes the events to show and hide the bookmark sidebar
         *
         * @returns {Promise}
         */
        const initEvents = async () => {

            ext.elm.indicator.ball.on("mousedown pointerdown",(e) => { // drag start
				
            	// Ignore non-primary button / collect button / duplicate pointer+mouse
            	if (e.which && e.which !== 1) {
            		return;
            	}
            	if (e.type === "mousedown" && window.PointerEvent) {
            		return; // pointerdown already handled
            	}
            	if ($(e.target).hasClass($.cl.toggle.collect) || $(e.target).parents("div."+$.cl.toggle.collect).length() > 0) {
            		return;
            	}
            	if (dragSession) {
            		return;
            	}

				//用来区分是click还是move
				startX = e.pageX;
  				startY = e.pageY;
  				
  				//影藏收藏按钮
  				hideCollectButt();
				
				dragstart(e.currentTarget,e.pageX, e.pageY);
            });

            // Prevent native HTML5 drag from fighting custom drag
            ext.elm.indicator.ball.on("dragstart", (e) => {
            	e.preventDefault();
            });
            
            //鼠标滑过
            ext.elm.indicator.ball.on("mouseover",(e) => { 
				$(e.target).find("div."+$.cl.toggle.collect).removeClass($.cl.hidden);
            });
            
            //鼠标滑过
            ext.elm.indicator.ball.on("mouseover","div."+$.cl.toggle.collect,(e) => { 
            	$(e.currentTarget).removeClass($.cl.hidden);
            });
            
            //鼠标离开
            ext.elm.indicator.ball.on("mouseout","div."+$.cl.toggle.collect,(e) => { 
            	$(e.currentTarget).addClass($.cl.hidden);
            });
            
            //鼠标离开
            ext.elm.indicator.ball.on("mouseout",(e) => { 
            	$(e.target).find("div."+$.cl.toggle.collect).addClass($.cl.hidden);
            });
            
            //鼠标点击
            ext.elm.indicator.ball.on("click","div."+$.cl.toggle.collect,(e) => { 
            	
            	//先同步登录信息
            	ext.helper.user.asyUserInfo().then(()=>{
            		
            		const user=ext.helper.user.getUser();
		        
			        if(user==null){//没有登录
			         	
			         	ext.helper.util.toLogin(ext.helper.i18n.get("collect_need_login"));
			         	
			         	return;
			        }
			        
			        let data={};
			        ext.helper.confirm.create("collect", ext.helper.i18n.get("contextmenu_add_website"), data);
	
	            	if(ext.elm.indicator.ball.hasClass($.cl.toggle.isDragged)){
	            		this.cancel();//如果触动了拖拽，释放掉
	            	}
	            	
            	})
            });

            $(document).on("mousemove dragover", (e) => { // drag move

                if (ext.elm.indicator.ball.hasClass($.cl.toggle.isDragged) && e.which === 1) {
                	
                	e.preventDefault();
                	e.stopPropagation();

                    dragmove(e.pageX, e.pageY);
                }
            });
            
            ext.elm.indicator.on("mouseup drop","> div."+$.cl.toggle.indicator,(e) => { // drag end
            	
        		const diffX = Math.abs(e.pageX - startX);
				const diffY = Math.abs(e.pageY - startY);
				let isClick = false;

				if (diffX < delta && diffY < delta) {
					isClick=true;
					
				}

				//记录是否是点击
				ext.elm.indicator.ball.attr($.cl.drag.isClick,isClick);
				
				if(ext.elm.indicator.ball.hasClass($.cl.toggle.isDragged)){
					
					//影藏收藏按钮
                	hideCollectButt();
					
					if (e.which === 1 && !isClick) { // only perform rearrangement of elements when the left mouse button is released
                        dragend();
                    } else { // cancel drag
                       this.cancel();
                    }
				}
				
				if (isClick) {
				    
				    // Click!
				    if(!ext.elm.indicator.ball.hasClass($.cl.toggle.isDragging)){
				    	
			            this.forceUpgrade().then(upgrade=>{
			            	
			            	if(upgrade){//需要强制升级
			            		
                                ext.helper.dao.call("openLink", {
			                        href:$.opts.website.main.official + $.opts.website.scope + $.opts.website.servletMain.download+"?upgrade=1",
                                    newTab: true,
			                    });
                                
			            	}else{

			            		//toggle
			            		if(!ext.elm.iframe.hasClass($.cl.sidebar.extLoaded)){
			            			this.openSidebar();
			            		}
			            		else{
			            			this.closeSidebar();
			            		}
			            	}
			            });
	            	}
				}
            });
            
            //监听鼠标up事件，及时存储召唤球位置
            $(document).on("mouseup drop",(e) => {
            	
            	let isClick=ext.elm.indicator.ball.attr($.cl.drag.isClick);
            	if(ext.elm.indicator.ball.hasClass($.cl.toggle.isDragged)){
            		$.delay(100).then(()=>{
	            		if(!!isClick && isClick==false){
							//影藏收藏按钮
		                	hideCollectButt();
							
							if (e.which === 1) { // only perform rearrangement of elements when the left mouse button is released
		                        dragend();
		                    } else { // cancel drag
		                       this.cancel();
		                    }
	            		}
	            	});
            	}
            });
            

            ext.elm.iframeBody.on("click", (e) => { // click outside the sidebar -> close
                
                if (e.clientX) {
                    
                    let clientX = e.clientX;
                    const curSidebarWidth = ext.elm.sidebar.realWidth();

                    if (sidebarPos === "right") {
                        clientX = ext.elm.iframe.realWidth() - clientX;
                    }
                    

                    if (
                        clientX > curSidebarWidth &&
                        ext.elm.iframe.hasClass($.cl.sidebar.extLoaded) &&
                        ext.elm.iframeBody.hasClass($.cl.drag.isDragged) === false
                    ) {
                        this.closeSidebar();
                    }
                }
            });
            
            $(document).on($.opts.events.openSidebar + ".be", () => { // open sidebar when someone triggers the according event
                
                ext.log("Trigger open sidebar event.");
                
                this.openSidebar();
            });
            
            //窗口改动后，设置球的位置
            window.addEventListener('resize', setBallPositionWindowsChange);
        };
        
        /**
         * Checks whether the given mouse position is in the configured pixel tolence
         *
         * @param {int} clientX
         * @param {int} clientY
         * @returns {boolean}
         */
        const isMousePosInPixelTolerance = (clientX, clientY, session = null) => {
            
            const width = session ? session.width : parseInt(toggleArea.width, 10);
            const height = session ? session.height : parseInt(toggleArea.height, 10);
            
            const wW = session ? session.wW : ext.helper.util.getWindowWH().wW;
            const hH = session ? session.hH : ext.helper.util.getWindowWH().hH;
            
            return !(clientX < 0 || (clientX + width) > wW || clientY < 0 || (clientY + height) > hH);
        };

        /**
         * Clears the given timeout
         *
         * @param {string} name
         */
        const clearSidebarTimeout = (name) => {
            if (timeout[name]) {
                clearTimeout(timeout[name]);
                timeout[name] = null;
            }
        };
    };

})(jsu);