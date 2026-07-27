($ => {
    "use strict";

    $.AboutHelper = function (s) {
    	
        this.init = () => {
			
			intro().then((content)=>{
				
				if(content){
					s.elm.about.html(content);
				}
				return Promise.resolve();
			}).then(()=>{
				blockWebsite().then((list)=>{
					
					if(list && list.length > 0){
						const blacklist=$("<div></div>").addClass("blacklist");
						list.forEach((url)=>{
							blacklist.append($("<p></p>").append($("<span></span>").text(url)))
						});
						
						$("<div></div>")
						.addClass("row")
						.append("<h1>"+s.helper.i18n.get("about_bookmarkmars_blacklist_pub")+"</h1>")
						.append(blacklist)
						.appendTo(s.elm.about);
					}
				})
			})
        };

        const intro=()=>{
        	
        	return new Promise((resolve) => {
        		s.helper.dao.call("bookmarkmarsIntro").then((res)=>{
					if(res.codeMsg === "undefined" || res.codeMsg !=="networkFail"){
						if(res.content){
							resolve(res.content);
						}
					}
					resolve(null);
				});
        	});
        }
        
        const blockWebsite = () =>{
        	
        	return new Promise((resolve) => {
	        	s.helper.dao.call("getValue",{key:"blacklist"})
	            .then((res)=>{
	            	resolve(res&&res.list?res.list:null);
	            });
	        });
        }
    };
    
})(jsu);