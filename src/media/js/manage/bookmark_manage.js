($ => {
    "use strict";
	
    /**
	 * @param {Object} s
	 * 书签管理
	 */
    $.BookmarkManagerHelper = function (s) {


        const defaultIcon = "data:image/png;base64,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";
		const showLevelFirst = 3;
		let ignore = [];
		
        /**
         * Initialises the behaviour settings
         *
         * @returns {Promise}
         */
        this.init = async () => {
        	showAllBookmarks().then(()=>{
        		initEvent();
        	})
        };
		
        /**
		 * 导入书签
		 */
        this.bookmarImport = () => {
        	let url=s.helper.util.getParsedUrl("chrome://bookmarks/");
			$.api.tabs.create({url:url});
        };

        /**
		 * 添加所有书签的预览
		 */
        const showAllBookmarks = () => {
        	return new Promise((resolve) => {
        		
        		const bookmarkAmount = s.helper.entry.getAmount("bookmarks");
        		const maxAllow=s.helper.privilege.isLargeBookmark(bookmarkAmount);
        		s.elm.bookmarkManager.content.find("span.stress").remove();
        		
        		if(maxAllow.rs){//提醒用户
        			$("<span></span>")
          			.addClass("stress")
          			.text(s.helper.i18n.get("manage_tool_bookmark_too_large_tip",[maxAllow.max],false))
          			.prependTo(s.elm.bookmarkManager.content);
        		}
        		
	            s.helper.dao.call("bookmarks", {id: 0}).then((data) => {
	            	//太大的书签只展示文件夹
	            	showBookmark(data.bookmarks,maxAllow.rs).then(()=>{
	            		resolve();
	            	})
	            });
	        });
        };
        
        const createBookmark = (id,title,url,li) =>{	
  	    	return new Promise((resolve) => {
        		let img="";
            	s.helper.dao.call("getFavicon",{url: url,icon:{size:32,title:title}}).then((response) => {
                    if (response && response.img) {
                        img="<img src='"+response.img+"'/>";
                    }
                    let ret=addCheckbox(id)+"<a target='_blank' href='"+url+"'>"+img+title+"</a>";
                    li.attr($.attr.type,"bookmark").html(ret);	
                    resolve();
                });
           });
        }
        
  	    const addCheckbox = (id) =>{
  	    	return "<input type='checkbox' value='"+id+"' checked/>";
  	    }
  	    
  	    const addDirIcon = (color="") =>{
  	    	let svg='<svg t="1662274332781" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="10195" width="48" height="48"><path d="M885.333333 168.533333h-448L341.333333 110.933333c-6.4-4.266667-14.933333-6.4-21.333333-6.4H134.4c-51.2 0-93.866667 42.666667-93.866667 93.866667v622.933333c0 51.2 42.666667 93.866667 93.866667 93.866667h750.933333c51.2 0 93.866667-42.666667 93.866667-93.866667V262.4c0-51.2-40.533333-93.866667-93.866667-93.866667z m-738.133333 21.333334h160l96 57.6c6.4 4.266667 14.933333 6.4 21.333333 6.4h445.866667c12.8 0 21.333333 8.533333 21.333333 21.333333V298.666667c0 12.8-8.533333 21.333333-21.333333 21.333333h-725.333333c-12.8 0-21.333333-8.533333-21.333334-21.333333V211.2c2.133333-10.666667 12.8-21.333333 23.466667-21.333333z" fill="${color}" p-id="10196"></path></svg>';
  	    	return svg.replace("${color}",color);
  	    }
  	    
  	    const getTree = async (show,childrens,level,onlyFolder=false) =>{//返回一定是个promise
  	    	
  	    	if(typeof childrens === "undefined" ){return;}
	
        	let ul=$('<ul></ul>');
        	let li;
        	
        	for (const item of childrens) {
				   
		   		li =$("<li></li>").attr($.attr.id,item.id);

    			if(item.url !== undefined && item.url !== null) {//书签
    				
    				if(!onlyFolder){
    					await createBookmark(item.id,item.title,item.url,li);
    				}
    				
    			}else{
    				
    				li.attr($.attr.type,"dir");
    				let icon=addDirIcon();
    				
    				if(level<showLevelFirst){
					   li.addClass($.cl.manage.bookmarksManage.open);
					}
    				let title="<span>"+item.title+"</span>"
    				li.html(icon+addCheckbox(item.id)+title);
    			}

            	if(item.children){
            	   await getTree(li,item.children,level=level+1,onlyFolder);
            	}
            	
            	if(li.html()!==""){
            		ul.append(li);
            	}
			}
        	ul.appendTo(show);
        }

        const showBookmark = (bookmarks,onlyFolder=false) => {
        	
           return new Promise((resolve) => {
	           	if(bookmarks[0].children){
	           		
	           		s.elm.bookmarkManager.content.find("div.show").remove();//清空
	           		let showBox=$("<div></div>")
	           			.addClass("show")
	           			.appendTo(s.elm.bookmarkManager.content);

	           		if(!showBox.hasClass($.cl.manage.loaded)){
	           			getTree(showBox,bookmarks[0].children,0,onlyFolder).then(()=>{
		            		showBox.addClass($.cl.manage.loaded);
		            		resolve();
		            	});
	           		}
	            }
           });
        };

		const noChild = (arr) =>{
			
			for(let item of arr){
				if(item!=null){
					return false;
				}
			}
			return true;
		}
		
		//递归做标记
		const removeNode = (node) => {

		    if(typeof node === "undefined" ){return;}
		    
		    for (const child of node) {
			    
			    if(child.children){
	            	removeNode(child.children);//递归，深度优先
	            }
			    
			    if(child.url !== undefined && child.url !== null || (child.children && noChild(child.children))) { //书签或者目录且空
		        	if(ignore.some(e => e.id === child.id)) {
		        		delete node[node.indexOf(child)];
		        	}
		        }
			    
			    if(child.children){//过滤掉空节点
			    	child.children=child.children.filter(value => JSON.stringify(value) !== '[]');
			    }
		    }
		}

        const ignoreNodes = () => {
            
            ignore=[];
            
            s.elm.bookmarkManager.content.find("div.show input[type='checkbox']").forEach((elm) => {
                if (elm.checked === false){
                    ignore.push({
                    	id:elm.value,
                    	type:$(elm).parent("li").attr($.attr.type)
                    });
                }
            });
            return ignore;
        };
        

        /**
		 * 导出书签
		 */
        this.bookmarExport = () => {
            const loader = s.helper.template.loading().appendTo(s.elm.body);
 			s.helper.dao.call("bookmarks", {id: 0}).then((data) => {
            	
            	let childrens = data.bookmarks[0].children;
            	
            	removeNode(childrens);

            	s.helper.dao.call("toHtml",{node:childrens,name:s.helper.i18n.get("extension_name")}).then((res)=>{
            		const blob = new Blob([res], {type: "text/html;charset=utf-8"});
                    const fileName = s.helper.i18n.get("manage_tool_iexport_downloadname") + (new Date()).getTime() + ".html";
                    saveAs(blob, fileName); //次方法来自fileSaver.js暴露出来的方法
            	}).then(()=>{
            		loader.remove();
            	})
            	
            });
        };
        
        const folderIsBare= (elm)=>{
   		
    		//清除历史
      		elm.children("span." + $.cl.sidebar.dirBare).remove();
            const bareNotice = $("<span></span>").addClass($.cl.sidebar.dirBare).html(s.helper.i18n.get("sidebar_folder_is_bare")).appendTo(elm);

            $.delay(100).then(() => {
                elm.addClass($.cl.sidebar.dirBare);
                return $.delay(1000);
            }).then(() => {
                elm.removeClass($.cl.sidebar.dirBare);
                return $.delay(100);
            }).then(() => {
                bareNotice.remove();
            });
        }

        const initEvent = () => {
        	
        	//常量
        	const showBox=s.elm.bookmarkManager.content;
        	const operateBox=s.elm.bookmarkManager.operate;
        	const ieportBox=s.elm.bookmarkManager.ieport;
        	
        	operateBox.on("click", "> span", (e) => {
    			const name = $(e.currentTarget).attr($.attr.name);
    			switch (name) {
	                case "all": {
	                    showBox.find("div.show input[type='checkbox']").forEach((elm) => {
		                    elm.checked = true;
		                });
	                    break;
	                }
	                case "clear": {
	                    showBox.find("div.show input[type='checkbox']").forEach((elm) => {
		                    elm.checked = false;
		                });
	                    break;
	                }
	                case "refresh": {
	                	const loader = s.helper.template.loading().appendTo(s.elm.body);
	                	$.delay(200).then(()=>{
	                		return showAllBookmarks();
	                	}).then(()=>{
	                		loader.remove();
	                	})
	                    break;
	                }
	            }
    		});

    		const toggle = (e)=>{
    			
    			const li=$(e.currentTarget).parent("li");
    			let id=li.data($.attr.id);
    			if(!li.hasClass($.cl.manage.bookmarksManage.open)){//open
    				li.addClass($.cl.manage.bookmarksManage.open);
    				
    				//如果为空则提示
    				let childrenList = li.find("ul");
    				if(childrenList && childrenList.children("li") && childrenList.children("li").length()<1){
    					folderIsBare(li);
    				}
    			}else{//close
    				li.removeClass($.cl.manage.bookmarksManage.open);
    			}
    		}
    		
    		showBox.on("click","div.show li[" + $.attr.type + "='dir'] > span",(e)=>{
    			toggle(e);
    		});
    		
    		showBox.on("click","div.show li[" + $.attr.type + "='dir'] > svg",(e)=>{
    			toggle(e);
    		});
    		
    		showBox.on("change","div.show li > input[type='checkbox']",(e)=>{
    			
    			const checked = e.target.checked;
    			const parentLi = $(e.target).parent("li");
    			
    			if (!checked){//not checked
                    parentLi.find("input[type='checkbox']").forEach((elm) => {
                        elm.checked = false;
                    });
    			}else{//checked
    				parentLi.find("input[type='checkbox']").forEach((elm) => {
                        elm.checked = true;
                    });
    			}
    		});
    		
    		ieportBox.on("click", "> span", (e) => {
    			
    			const name = $(e.currentTarget).attr($.attr.name);
    			switch (name) {
	                case "import": {
	                   this.bookmarImport();
	                    break;
	                }
	                case "export": {
	                    
	                    let ignore=ignoreNodes();
	                    this.bookmarExport();
	                    break;
	                }
	            }
    		});
       };
    };
})(jsu);