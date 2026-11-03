($ => {
    "use strict";

    $.ConnectHelper = function (b) {

        this.init = async () => {

            const mapping = {
                
                langvars: b.helper.language.getLangVars,
                reinitialize: b.reinitialize,
                bookmarks: b.helper.bookmarks.getById,
                viewAmounts: b.helper.viewAmount.getAll,
                searchBookmarks:b.helper.bookmarks.getBySearchVal,
                searchHistory:b.helper.util.getHistoryBySearchVal,
                setCache: b.helper.cache.set,
                getCache: b.helper.cache.get,
                removeCache: b.helper.cache.remove,
                openLink: b.helper.util.openLink,
                openLogin: b.helper.util.openLogin,
                clearNotWorkingTimeout: b.helper.action.clearTimeout,
                languageInfos: b.helper.language.getAvailableLanguages,
                reload: b.reload,
                createBookmark: b.helper.bookmarks.create,
                moveBookmark: b.helper.bookmarks.move,
                updateBookmark: b.helper.bookmarks.update,
                deleteBookmark: b.helper.bookmarks.remove,
                checkUrl: b.helper.linkchecker.check,
                setNotWorkingReason: b.helper.action.setReason,
                setSidebarState:b.helper.action.setSidebarState,
                statistics:b.helper.statistics.track,
                addViewAmount: b.helper.viewAmount.addByUrl,
                inbookmarkFolder:b.helper.viewAmount.isInbookmarkFolder,
                setValue:b.helper.dao.setValue,
                getValue:b.helper.dao.getValue,
                cacheRemote:b.helper.serverExchange.cacheRemote,
                createBookmarkHtml:b.helper.bookmarkHtml.createBookmarkHtml,
                toHtml:b.helper.bookmarkHtml.toHtml,
                getFavicon:b.helper.image.getFavicon,
                reloadIcon: b.helper.icon.init,
                iconImageData: b.helper.icon.getImageData,
                writeCharacterOnImage:b.helper.icon.writeCharacterOnImage,
                getBallState:b.helper.action.getBallState,
                setBallState:b.helper.action.setBallState,

              	//服务器交互
              	bookmarkmarsIntro:b.helper.serverExchange.getIntro,
              	getRemoteConf:b.helper.serverExchange.getRemoteConf,
              	isLogin:b.helper.serverExchange.isLogin,
              	userInfo:b.helper.serverExchange.getUserInfo,
              	serverState:b.helper.serverExchange.isServerAvaliable,
              	getBg:b.helper.serverExchange.getBg,
              	logout:b.helper.serverExchange.userLogout,
              	getPrivilegeRemote:b.helper.serverExchange.getPrivilegeRemote,
              	uploadBookmark:b.helper.serverExchange.uploadBookmark,
              	saveShortcuts:b.helper.serverExchange.saveShortcuts,
              	loadShortcuts:b.helper.serverExchange.loadShortcuts,
              	searchBookmarkServer:b.helper.serverExchange.searchBookmarkFromServer,
              	getKeyword:b.helper.serverExchange.getKeyword,
              	asyBookmark:b.helper.bookmarkHtml.asyBookmark,
              	checkNewVersion:b.helper.serverExchange.checkNewVersion,
              	getAllCollectFolders:b.helper.serverExchange.getAllCollectFolders,
              	getCollectFolder:b.helper.serverExchange.getCollectFolder,
              	addEditCollectFolder:b.helper.serverExchange.addEditCollectFolder,
              	submitCollect:b.helper.serverExchange.submitCollect,
            };
            
            const deleteTimer= (port) => {
			  if (port._timer) {
			    clearTimeout(port._timer);
			    delete port._timer;
			  }
			}
            
            const forceReconnect= (port)=>{
			  deleteTimer(port);
			  port.disconnect();//断开后，client会重新连接
			}
            
            const onMessage = (message, port) =>{

            	try{
            		port.postMessage({uid: message.uid,result: "Yes, I am here"});
            	}catch(err){
            		;
            	}
            }
          
            $.api.runtime.onConnect.addListener((port) => {
            	
            	if (port.name && port.name !== "keepalive") {return;}
            	
            	port.onMessage.addListener(onMessage);
            	port.onDisconnect.addListener(deleteTimer);//如果断开，删除计时器
            	
            	// force reconnect after 25s. After 30s the browser would terminate the connection by itself
            	port._timer = setTimeout(forceReconnect,25 * 1000, port);
            });
            
            let c = 0;

            //传输数据
            $.api.runtime.onMessage.addListener((message, sender, callback) => {
                
                if (mapping[message.type]) { // function for message type exists
                   	
                   	if (c % 100 ===0 ) { //检测今天的数据是否需要及时传输
                   		b.helper.statistics.trackUserData();
                   	}

                    message.tabId = sender.tab ? sender.tab.id : null;
                    
                    mapping[message.type](message).then((result) => {
                        
                        callback(result);
                    
                    })["catch"]((error) => {
                        
                        b.log(error);
                        callback();
                        
                    });
                    
                    c++;
                    
                } else {
                   
                    b.log("Unknown message type:" + message.type);
                    callback();
                    
                }
                return true;
            });
        };
    };

})(jsu);