($ => {
    "use strict";
    
    /**
     * @param {object} ext
     * @constructor
     */
    $.powerfulCheckHelper = function (ext) {
    	
    	
    	let checkList = [
	    	"https://www.baidu.com",
	    	"https://www.qq.com/",
	    	"https://www.douyin.com/"
	    ]
    	
    	const CHUNK_SIZE = 3; //一条一条的判断，否则cpu会很高
    	
    	const MAX_ALLOW = 45;
    	
 		/**
         * Initialises the behaviour settings
         *
         * @returns {Promise}
         */
        this.init = () => {
        	removeInstallExtNotice();
        	check();
        };
        
        const removeInstallExtNotice = ()=>{
        	
        	if(ext.helper.official.isOfficialWeb()){
        		$("body").find("[data-be-notice='ext']").forEach((elm)=>{
        			$(elm).remove();
        		});
        	}
        }
        
        const netWorkIsOk=async ()=>{
        	
        	let i=0;
        	for(let url of checkList){
        		await ext.helper.dao.call("checkUrl", {url: url,all:false}).then((response) => {
        			if(response.httpInfo.ok){
        				i++;
        			}
        		});
        	}
        	return i>=checkList.length * 0.5;
        }
        
        const ignore = [
		    //images
		    'mng', 'pct', 'bmp', 'gif', 'jpg', 'jpeg', 'png', 'pst', 'psp', 'tif',
		    'tiff', 'ai', 'drw', 'dxf', 'eps', 'ps', 'svg',
		
		    //audio
		    'mp3', 'wma', 'ogg', 'wav', 'ra', 'aac', 'mid', 'au', 'aiff',
		
		    //video
		    '3gp', 'asf', 'asx', 'avi', 'mov', 'mp4', 'mpg', 'qt', 'rm', 'swf', 'wmv',
		    'm4a',
		
		    //other
		    'css', 'pdf', 'doc', 'exe', 'bin', 'rss', 'zip', 'rar',
		]
        
        const validURL = (str) => {
		  let pattern = new RegExp('^(https?:\\/\\/)?'+ // protocol
		    '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // domain name
		    '((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
		    '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // port and path
		    '(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
		    '(\\#[-a-z\\d_]*)?$','i'); // fragment locator
		  return !!pattern.test(str);
		}

        const analysisAtag=()=>{
        	
        	let all = [];
        	$("body").find("a").forEach((elm)=>{
        		
        		let url=$(elm).attr("data-url") || $(elm).attr("data-ext");
        		if(!!url){
        			url=url.trim();
        			let suffix=url.substr(url.lastIndexOf('.'));

	        		if(all.length<MAX_ALLOW && validURL(url)&&!ignore.some(e => suffix.indexOf(e) != -1 )&&!ext.helper.util.isUrlOnBlacklist(url)){
	        			
	        			let rs=ext.helper.util.isFamousWebsite(url);
	        			if(JSON.stringify(rs)==="{}" ||  !rs.yes){//非著名网站
	        				
	        				$(elm).removeClass($.cl.brokenUrl);
	        				
	        				all.push({url:url,elm:elm});
	        			}
	        		}
        		}
        	});
        	return all;
        }
        
        const mark= (dom,response)=>{
        	
        	$(dom).addClass($.cl.brokenUrl);
        	
        	/************************记录,track*****************/
        	ext.helper.dao.call("statistics", {
                name: "check",
                value: {name: "broken", value:{
                	url:response.httpInfo.url,
                	status:response.httpInfo.status,
                	foundTime:new Date()
                }}
            });
        }
        
        const checkChunk = (chunk) => {
        	
            return new Promise((rslv) => {
                
                let resolved = 0;
                for (const item of chunk) {
                	
                	let done = false;
                    
                    const callback = () => {
                        
                        if (done) {
                            return;
                        }
                        
                        done = true;
                        resolved++;

                        if (resolved >= chunk.length) {
                            rslv();
                        }
                    };
                    
                    ext.helper.dao.call("checkUrl", {url:item.url,timeout:7000},false).then((response) => {
   
                        if (response.httpInfo.ok === false && response.httpInfo.status !=null ) {

						   ext.log(response.httpInfo);

                           mark(item.elm,response);
                        }
                        
                    })["finally"](callback);
                }
            });
        };

        const check=async ()=>{
        	
        	const powerfulCheck = ext.helper.dao.getData("b/powerfulCheck");
        	if (!powerfulCheck || !ext.helper.official.isOfficialWeb() || !netWorkIsOk()){return;}//没打开或者网断了

			//保证服务器是通的
			ext.helper.dao.call("serverState").then(async res=>{
        		if(res){
        			
        			let all=analysisAtag();
		        	let i=0;
		        	
					let chunk = [];
		        	for(let item of all){
		
			      		i++;
			      		chunk.push(item);
		                if (Object.keys(chunk).length >= CHUNK_SIZE || i === all.length) { // check multiple urls at once
		                	
		                    await checkChunk(chunk);
		                    
		                    chunk = [];
		                }
		        	}       	
        		}
        	})			
        }
    };

})(jsu);