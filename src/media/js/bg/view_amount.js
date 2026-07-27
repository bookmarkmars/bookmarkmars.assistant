($ => {
    "use strict";

    $.ViewAmountHelper = function (b) {

        /**
         * Returns the view amounts of all bookmarks
         *
         * @returns {Promise}
         */
        this.getAll = () => {
            return new Promise((resolve) => {
                getClickCounter().then((clickCounter) => {
                    resolve({
                        viewAmounts: clickCounter,
                        counterStartDate: b.helper.dao.getData("installationDate")
                    });
                });
            });
        };
        
        this.isInbookmarkFolder = (opts)=>{
        	
        	return new Promise((resolve) => {
	        	
	        	b.helper.bookmarks.api.search({url:opts.url}).then((bookmarks) => {
	                bookmarks.some((bookmark) => {
	                    if (bookmark.url === opts.url) {
	                        resolve({yes:true,bookmark:bookmark});
	                    }
	                });
	                resolve({yes:false,bookmark:null});
	            });
	            
	        });
        }
        
        this.tryToGetFavicon = (url,yes) =>{

        	return new Promise((resolve) => {
        		

        		if(!yes){resolve(null);}//由于权限限制，只有在书签中，才可以获得图标，所以必须判断
        		
                b.helper.image.getFavicon({url: url}).then((response) => {
					
					if(response && response.img){
						resolve(response.img);
					}
					
					resolve(null);
				});
            });
        }

        /**
         * Determines whether a bookmark to the given url exists and if so increases the view counter,
         * only if the tab was not previously opened or changed from the extension (these clicks are counted alreay)
         *
         * @param {object} opts
         * @returns {Promise}
         */
        this.addByUrl = (opts) => {
            
            return new Promise((resolve) => {

                this.isInbookmarkFolder(opts).then(res => {
                	
                	const openedByExtension = b.helper.dao.getData("openedByExtension");
                	
            		if(opts.referrer === "" && openedByExtension === null && res.yes){
            			this.addByEntry(res.bookmark);
            		}
            		
            		//必须检查授权情况
            		$.api.storage.sync.get(["behaviour"], (conf) => {
						
						//是否同意记录浏览器记录
						const recordVisit=conf&&conf.behaviour?conf.behaviour.recordVisit:null;
						
						if(recordVisit){
							
							const user=b.helper.serverExchange.getUser();
            		
		            		this.tryToGetFavicon(opts.url,res.yes).then(base64Icon=>{
		            			
		            			b.helper.statistics.track({
				                    name: "record",
				                    value: {name: "view", value:{
				                    	url:opts.url,
				                    	title:opts.title,
				                    	visitTime:new Date().getTime(),
				                    	userId:user?user.id:null,
				                    	base64Icon:base64Icon,
				                    	browserName:$.browserName
				                    }}
				                });
		            		})

						}
					});

            		b.helper.dao.setData("openedByExtension", null);
            		
            	});
            });
        };

        /**
         * Increases the Click Counter of the given bookmark
         *
         * @param {object} bookmark
         */
        this.addByEntry = (bookmark) => {
            if (bookmark.id) {
                getClickCounter().then((clickCounter) => {
                    if (typeof clickCounter[bookmark.id] === "undefined" || typeof clickCounter[bookmark.id] !== "object") {
                        clickCounter[bookmark.id] = {c: 0};
                    }

                    clickCounter[bookmark.id].c++;
                    clickCounter[bookmark.id].d = +new Date();

                    $.api.storage.local.set({
                        clickCounter: clickCounter
                    });
                });
            }
        };

        /**
         * Retrieves infos about the views of the bookmarks
         *
         * @returns {Promise}
         */
        const getClickCounter = () => {
            return new Promise((resolve) => {
                $.api.storage.local.get(["clickCounter"], (obj) => {
                    let ret = {};

                    if (typeof obj.clickCounter !== "undefined") { // data available
                        ret = obj.clickCounter;
                    }

                    resolve(ret);
                });
            });
        };
    };

})(jsu);