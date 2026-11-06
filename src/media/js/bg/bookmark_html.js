($ => {
    "use strict";
	
    $.BookmarkHtmlHelper = function (b){
    	
    	let bookmarkHtml="";
    	
    	let intervalHandler=null;
    	
    	const timer = 5 * 60;//

    	this.init = () => {
           asyBookmarkSchedule();
        };
    	
        
        /***********************书签生成****************/
        /**
		 * 一些生成书签的基础设置
		 */
        const bookmarksHEAD = (title,name) =>{
            let htmlContent = "<!DOCTYPE NETSCAPE-Bookmark-file-1>\n";
            htmlContent += "\t\t<!-- This is an automatically generated file."+"\n"+
							"\t\tIt will be read and overwritten."+"\n"+
							"\t\tDO NOT EDIT! -->"+"\n";
            htmlContent += "<META HTTP-EQUIV=\"Content-Type\" CONTENT=\"text/html; charset=UTF-8\">\n";
            htmlContent += "<TITLE>"+title+"</TITLE>\n";
            htmlContent += "<H1>"+name+"</H1>\n";
            htmlContent += "<DL><p>\n";
            return htmlContent;
        };
        
        const addTab = (level) =>{
        	let tab="";
        	for(let i=0;i<level;i++){
        		tab+="\t";
        	}
        	return tab;
        }
        
        const bookmarksDIR_S = (addDate, lastModified, dirName,personalToolBar,level=0) =>{
        	
        	if(personalToolBar){
        		bookmarkHtml=''.concat(bookmarkHtml,addTab(level),"<DT><H3 ADD_DATE=\""+addDate+"\" LAST_MODIFIED=\""+lastModified+"\"   PERSONAL_TOOLBAR=\""+personalToolBar+"\">"+dirName+"</H3>\n" +addTab(level)+"<DL><p>\n");
        	}
        	else{
        		bookmarkHtml=''.concat(bookmarkHtml,addTab(level),"<DT><H3 ADD_DATE=\""+addDate+"\" LAST_MODIFIED=\""+lastModified+"\">"+dirName+"</H3>\n" +addTab(level)+"<DL><p>\n");
        	}
        };
        
        const bookmarksDIR_E = (level=0) =>{
            bookmarkHtml=''.concat(bookmarkHtml,addTab(level),"</DL><p>\n");
        };
        
        const getFaviconImg = (url) =>{
        	return new Promise((resolve) => {
				b.helper.image.getFavicon({url: url}).then((response) => {
					if (response && response.img) {
                        resolve(response.img);
                    }
                    resolve(null);
				});
            });
        }
        
        const bookmarksDT_A = (addDate, name,url,level=0) =>{

        	return new Promise((resolve) => {
        		getFaviconImg(url).then((icon)=>{
					if(icon){
		               bookmarkHtml=''.concat(bookmarkHtml,addTab(level),"<DT><A HREF=\""+url+"\" ADD_DATE=\""+addDate+"\" ICON=\""+icon+"\">"+name+"</A>\n");
		            }else{
		                bookmarkHtml=''.concat(bookmarkHtml,addTab(level),"<DT><A HREF=\""+url+"\" ADD_DATE=\""+addDate+"\">"+name+"</A>\n");
		            }
		            resolve();
				});
        	});
        };
        
        const jsonToHtmlHelper = async (node,level=1) =>{
        	
        	let nowLevel=level;
        	
        	if(typeof node === "undefined" ){return;}
        	
		    for (const child of node) {
		    	
		    	if(child.url !== undefined && child.url !== null){//bookmark
	        		await bookmarksDT_A(child.dateAdded,child.title,child.url,nowLevel);
	      	    }
		    	
		    	if(child.children){
		    		bookmarksDIR_S(child.dateAdded,child.dateGroupModified,child.title,false,nowLevel);
	        		await jsonToHtmlHelper(child.children,level=level+1)
	        		bookmarksDIR_E(nowLevel);
	        	}
		    }
        }

        this.toHtml = async (opts) =>{
        	
        	 bookmarkHtml=bookmarksHEAD(opts.name,"bookmarkmars.com")
        	 for (const child of opts.node) {
        	 	if(child){
        	 	   bookmarksDIR_S(child.dateAdded,child.dateGroupModified,child.title,true,1);
        		   await jsonToHtmlHelper(child.children,1)
        		   bookmarksDIR_E(1);
        	 	}
        	 }
        	 bookmarksDIR_E();//head中有个<DL><p>
        	 return bookmarkHtml;
        }

		this.createBookmarkHtml = (opts) => { 
            
            return new Promise((resolve) => {
	           	b.helper.bookmarks.getById({id:0}).then((data)=>{
					
					//add node
					const childrens = data.bookmarks[0].children;
	        		opts["node"]=childrens;
	        		this.toHtml(opts).then(()=>{//async 返回promise
	           			resolve(bookmarkHtml);
	           		})
				})
            });
        };
        
        const notifyAutoBackupSuccess = (tabId, type) => {
            $.api.tabs.sendMessage(tabId, {
                action: "autoBackupSuccess",
                reinitialized:null,
                type: type
            },(resp) => {
            	const lastError = $.api.runtime.lastError;
                if (typeof lastError === "undefined") {
                	;//do nothing
                };
            });
        };
        
        //静默同步
        this.stillAsybookmark = (opts)=>{
        	
        	return new Promise((resolve) => {

				Promise.all([
					b.helper.serverExchange.getPrivilegeRemote(),
					b.helper.serverExchange.checkFeature({feature: "autoSync", noRetry: true})
				])
				.then(([data, gate])=>{
					
					$.api.storage.sync.get(["behaviour"], (conf) => {
						
						if(!gate.allowed){
							resolve({success:false,reason:"noSubscription"});
						}
	        			else if(conf.behaviour.autoBackup){
	        				
	        				$.api.storage.local.get(["utility"], (obj) => {//数量判断
	        					
	        					const amount=obj.utility.entryAmounts;
	        					
	        					if(amount && amount.bookmarks.visible <= data.maxAllowNum){
	        						this.createBookmarkHtml(opts)
									.then(data=>{//上传
										opts["data"]=data;
										opts["origin"]="a";
										b.helper.serverExchange.uploadBookmark(opts)
										.then(resolve);
									})
	        					}
	        					else{
	        						resolve({success:false,reason:"tooMany"});
	        					}
	        					
	        				});
	        			}else{
	        				resolve({success:false,reason:"noPermission"});
	        			}
						
					});
				});
        	});
        }
        
        
        //有些用户可能不是通过助手操作书签，这样没法触发同步事件，为了安全，这里定时再同步一次
        const asyBookmarkSchedule = ()=>{
        	
        	if(intervalHandler!=null){
        		clearInterval(intervalHandler);
        	}
        	
        	intervalHandler=setInterval(() => {
                
                b.helper.language.getLangVars().then((lang) => {
	        		this.stillAsybookmark({name:lang.vars.manage_tool_backup_name.message});
	        	});
	        	
            }, timer * 1000);
        }
        
        //书签同步
        this.asyBookmark = (opts) => {
 			
 			return new Promise((resolve) => {
				
				this.stillAsybookmark(opts)
				.then(res=>{
					
					//发送消息
					if(res && res.success){

						$.api.tabs.query({}, (tabs) => {
	                        
	                        tabs.forEach((tab, i) => {
	                            
	                            const delay = tab.active ? 0 : (i * 100); // stagger the reload event for all tabs which are not currently visible
	                           
	                            $.delay(delay).then(() => {
	                            	notifyAutoBackupSuccess(tab.id,"autoBackup");
	                            });
	                        });
	                    });
					}
					resolve(res);
				})
			});
        };
        
        const sendMessage = (tabId, msg) =>{
		    $.api.tabs.sendMessage(tabId,msg,(resp) => {
            	const lastError = $.api.runtime.lastError;
                if (typeof lastError === "undefined") {
                	;//do nothing
                };
            });
		}
        
        const initEvent = ()=>{
        	
        	$.api.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
			    sendMessage(tabId, {msg:"checkBackup"})
			});
        }
    };
})(jsu);