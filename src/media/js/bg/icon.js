($ => {
    "use strict";

    $.IconHelper = function (b) {

        let currentIcon = null;

        /**
         *
         * @returns {Promise}
         */
        this.init = () => {
            return new Promise((resolve) => {
                Promise.all([
                    getInfo(),
                    b.helper.language.getLangVars(),
					b.helper.serverExchange.isUpdate()//启动更新检查
                ]).then(([info, lang, version]) => {
                    currentIcon = null;
                    initExtensionIcon(info, lang, version);
                    resolve();
                });
            });
        };

        /**
         * Initialises the extension icon, which is displayed right of the address bar (or in the extension menu)
         *
         * @param info
         * @param lang
         */
        const initExtensionIcon = (info, lang, version) => {
            
            this.setExtensionIcon({
                name: info.name,
                color: info.color
            });
			
			let title= lang.vars.extension_name.message+" ";
			title+=lang.vars.extension_version.message + version.currentVersion;
			
			//升级提醒
			if(version && version.upgrade){

				title+=" "+lang.vars.extension_new_version.message + version.newVersion;

				$.api.action.setBadgeBackgroundColor({color: [227, 11, 32, 255]});
				$.api.action.setBadgeText({text:lang.vars.extension_upgrade.message});
			}
			
			//小图标提醒文字
			$.api.action.setTitle({title:title });
        };

        /**
         * Returns information about the extension icon
         *
         * @returns {Promise}
         */
        const getInfo = () => {
            return new Promise((resolve) => {
                
                let name = "bookmarkearth";
                let color = "auto";

                resolve({
                    name: name,
                    color: color
                });
            });
        };
        
        /**
         * Returns the icon image
         *
         * @param {object} opts
         * @returns {Promise}
         */
        this.writeCharacterOnImage = (opts) => {
            
            return new Promise((resolve) => {
                
                const size = opts.size || 32;
                const canvas = new OffscreenCanvas(size, size);
                const ctx = canvas.getContext("2d");
                const ch = (opts.c != null && String(opts.c).length) ? String(opts.c) : "N";
                // CJK / non-Latin need a font stack — Arial alone often draws blank
                const isAsciiLetter = /^[A-Za-z0-9]$/.test(ch);
                const fontSize = isAsciiLetter ? Math.round(size * 0.7) : Math.round(size * 0.56);
                const fontFamily = isAsciiLetter
                    ? "Arial, Helvetica, sans-serif"
                    : "'Segoe UI', 'Microsoft YaHei', 'PingFang SC', 'Noto Sans SC', 'Hiragino Sans GB', 'Apple Color Emoji', sans-serif";

                if (opts.background) {
                    ctx.arc(size / 2, size / 2, size / 2, 0, 2 * Math.PI, false);
                    ctx.fillStyle = opts.background;
                    ctx.fill();
                }
                
                ctx.font = "bold " + fontSize + "px " + fontFamily;
                ctx.textBaseline = "middle";
                ctx.textAlign = "center";
                ctx.fillStyle = opts.color || "#444";
				ctx.fillText(ch, size / 2, size / 2 + (isAsciiLetter ? 2 : 1));
				
				canvas[
				    canvas.convertToBlob 
				      ? 'convertToBlob'
				      : 'toBlob'
			    ]()
			    .then(blob => {
			        const reader = new FileReader();
				    reader.onload = function(){ 
				    	resolve({img: this.result});
				    }; 
				    reader.readAsDataURL(blob);
			    }).catch(() => {
			    	resolve(null);
			    });
            });
        };

        /**
         * Returns the icon image data of the extension icon with the given shape and given color
         *
         * @param {object} opts
         * @returns {Promise}
         */
        this.getImageData = (opts) => {
            
            return new Promise((resolve) => {
                
                const size = 128;
                const canvas = new OffscreenCanvas(size, size);
                const ctx = canvas.getContext("2d");
             
                if (opts.background) {
                    
                    ctx.beginPath();
                    ctx.fillStyle = opts.background;
                    ctx.arc(size / 2, size / 2, size / 2, 0, 2 * Math.PI, false);
                    ctx.fill();
                }
                
                $.fetch($.api.runtime.getURL("media/img/icon/action/icon-" + opts.name + ".png"))
                .then(r => r.blob())
            	.then(blob => createImageBitmap(blob))
            	.then(img=>{
            		
            		const pad = opts.padding || 0;
            		ctx.drawImage(img, pad, pad, size - (pad * 2), size - (pad * 2));

                    let imageData = null;
                    if (opts.asDataURL) { //返回base64
						 
						   canvas[
						    canvas.convertToBlob 
						      ? 'convertToBlob' // specs
						      : 'toBlob'        // current Firefox
						   ]()
						    .then(blob => {
						        const reader = new FileReader() ;
							    reader.onload = function(){ 
							    	resolve(this.result);
							    }; 
							    reader.readAsDataURL(blob) ;
						    });
                        
                    } else { // return an ImageData object
                        imageData = ctx.getImageData(0, 0, size, size);
                        resolve(imageData);
                    }
            	 })
            	.catch(err=>{
            		resolve(null);
            	});
            });
        };

        /**
         * Sets the extension icon to the given shape with the given color
         *
         * @param {object} opts
         * @returns {Promise}
         */
        this.setExtensionIcon = (opts) => {
            
            return new Promise((resolve) => {
                
                const onlyCurrentTab = opts.onlyCurrentTab || false;

                if (currentIcon && !onlyCurrentTab && currentIcon === opts.name + "_" + opts.color) { // icon is the same -> do nothing
                    resolve();
                } else { // icon is different
                    
                    this.getImageData(opts).then((imageData) => {
                    	
                    	//有图片，否则用默认
                    	if(imageData){
                    		
                    		$.api.action.setIcon({
	                            imageData: imageData,
	                            tabId: onlyCurrentTab && opts.tabInfo ? opts.tabInfo.id : null
	                        });
	
	                        if (!onlyCurrentTab) {
	                            currentIcon = opts.name + "_" + opts.color;
	                        }
                    	}
                    });
                }
            });
        };
    };

})(jsu);