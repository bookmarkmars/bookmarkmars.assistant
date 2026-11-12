($ => {
    "use strict";

    /**
     * @param {object} ext
     * @constructor
     */
    $.FreUsedHelper = function (ext) {
    	
    	let sort={};
    	
    	let inited=false;
    	
    	this.init = async (list) => {
	 		sort = ext.helper.dao.getData("u/sort");
    	 	await initFrequentlyUsed(list);
    	}

        /**
         * Repaint Frequently use from the current pin list.
         * Leaves the rest of the bookmark tree on screen.
         */
        this.refresh = () => {
            sort = ext.helper.dao.getData("u/sort") || {};
            const root = ext.elm.bookmarkBox && ext.elm.bookmarkBox.all;
            const list = root && root.children("ul");
            if (!list || list.length() === 0) {
                return ext.helper.dao.call("removeCache", {name: "htmlList"}).then(() => false);
            }

            const folder = list.children("li." + $.cl.sidebar.freUsed);
            if (!folder || folder.length() === 0) {
                return initFrequentlyUsed(list).then(() => rememberList());
            }

            ext.elm.freUsed = folder.eq(0);
            const title = ext.helper.i18n.get("sidebar_fre_used_folder", [ext.helper.entry.getAmount("pinned")], false);
            const link = ext.elm.freUsed.children("a");
            link.children("span." + $.cl.sidebar.bookmarkLabel).text(title);
            link.attr($.attr.title, title);
            ext.elm.freUsed.children("ul").remove();
            addFreUsed();
            return rememberList();
        };

        const rememberList = () => {
            const sortNow = ext.helper.dao.getData("u/sort") || {};
            if (!sortNow.name || sortNow.name === "default") {
                return ext.helper.list.cacheList().then(() => true);
            }
            return Promise.resolve(true);
        };
    	
    	 const initFrequentlyUsed = (list) =>{
        	
        	//获取数据
        	return new Promise((resolve) => {
        		$.fetch($.api.runtime.getURL("media/conf/frequent.json")).then((res) => {
	                res.text().then((data)=>{
	                	let jsonData=JSON.parse(data);
	                	
	                	//添加文件夹
	                	const pinnedAmount = ext.helper.entry.getAmount("pinned");
	                	jsonData.title=ext.helper.i18n.get("sidebar_fre_used_folder",[pinnedAmount],false);
	                	ext.helper.list.addEntryToList(jsonData, list, {
			                asTree: true,
			                freUsed:true,
			            });

						//添加书签
						ext.elm.freUsed=list.find("li."+$.cl.sidebar.freUsed);
			            addFreUsed();
			            
			            resolve();
	                });
	           	}).catch(err => {resolve();});
        	});
        }
    	 
    	const addFreUsed=()=>{
    		
    		//添加书签
	        let a=ext.elm.freUsed.find(" > a");
	        let ul=$("<ul></ul>").insertAfter(a);//加内容

            const pinnedEntries = ext.helper.entry.getAllDataByType("pinned");
            
            ext.helper.util.sortEntries(pinnedEntries, sort);

            for(let bookmark of pinnedEntries){
            	ext.helper.list.addEntryToList(bookmark, ul, {
	                asTree: true,
	                freUsed:true,
	            });
            }
            ext.helper.list.expandCollapseDir(a,ul,true, 0);
    	}
    	
    	const pin=(id)=>{
    		return new Promise((resolve) => {
    			ext.helper.bookmark.pinEntry({id:id}).then(()=>{
    				resolve();
    			});
    		});
    	}
    	
    	const addBookmark= (obj,entries)=>{
	
			return new Promise((resolve) => {

				let nodes=[];

				if(obj.isDir){
	               		
               		obj["parentId"]=entries[0].id;
               		
               		const bookmarkBar=entries[0].children;
               		if(bookmarkBar && bookmarkBar.some(e => e.title === obj.title)){
               			for(let item of bookmarkBar){
               				if(item.title===obj.title){
               					if(item && item.children&& item.children[0]){
               						nodes.push(item.children[0].id);
               						break;
               					}
               				}
               			}
               			return resolve(nodes);
               		}
               			
           			ext.helper.dao.call("createBookmark", obj)
           			.then(async (result) => {

           				if (result.created && obj.children) {
			               		
		               		for(let elm of obj.children){
		               			
		               			elm["parentId"]=result.created;
		               			
		               			await ext.helper.dao.call("createBookmark", elm).then((res)=>{
		               				nodes.push(res.created);
		               			})
		               		}
		                }
           				resolve(nodes);//返回第一个
		            })
                }
			});
		}

    	//初始化事件
    	this.addRecommend=(entries)=>{

			return new Promise((resolve) => {

				const recommend = ext.helper.dao.getData("u/recommend");

				if(entries && entries[0] && entries[0] && !recommend){
							               						
					//立马认为成功
					ext.helper.dao.setData({"u/recommend":true}).then(()=>{
						
						ext.helper.dao.call("getRemoteConf",{name:'recommend'}).then((res)=>{

							if(res.codeMsg !== "undefined" && res.codeMsg==="networkFail"){
						
								$.fetch($.api.runtime.getURL("media/conf/recommend.json")).then((r) => {
					            	r.json().then((obj)=>{
					            		addBookmark(obj,entries)
					            		.then((nodes)=>{
					            			nodes && nodes[0]?pin(nodes[0]).then(resolve):resolve();
					            		})
					            	});
					            }).catch(err => {});
							}else{
								
								//必须删除这个属性，不然pin会出错
								delete res['updateNo'];
			            		addBookmark(res,entries)
			            		.then((nodes)=>{
			            			nodes && nodes[0]?pin(nodes[0]).then(resolve):resolve();
			            		})
							}
						});
					})
				}
		    });
    	}
    }
    
})(jsu);