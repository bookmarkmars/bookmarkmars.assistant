(() => {
    
    "use strict";

    /* eslint-disable no-console */
    /* global Func, path */

    global.modulePath = __dirname + "/node_modules/";
    
    try {
        require("../node.js_Build/funcs");
    } catch (e) {
        if (e.code !== "MODULE_NOT_FOUND") {
            throw e;
        }
        console.error("Build script is missing. Please download from https://github.com/Kiuryy/node.js_Build");
        process.exit(1);
    }

    /**
     *
     * @type {Object}
     */
    let packageJson = {};
    
    let release= true;
    
    //demo deploy positon
    const target = "C:/Users/Carmen.Y/Downloads/bookmarkmars_assistant";

    /**
     * Starts building the application
     */
    const Build = () => {
        
        const start = +new Date();
        console.log("Building release...\n");
        
        loadPackageJson()
        .then(()=>{
    		return Func.cleanPre(); //clean
    	})
        .then(()=>{
    		return css();//编译css
    	})
    	.then(()=>{
    		return new Promise((resolve) => {

	    		if(release){
	    			js()
		        	.then(()=>{
				       return mvCss();
			        })
		        	.then(()=>{
		        		return html();
		        	})
		        	.then(()=>{
			        	return img();
			        })
		        	.then(()=>{
			        	return conf();
			        })
		        	.then(()=>{
		        		return worker();
		        	})
		        	.then(() => {
			            return branch();
			        })
		        	.then(resolve);
		        }
		        else{
					dev()
					.then(resolve)
		        }
		    });
    	}).then(()=>{
    		return Func.cleanPost();
    	}).then(()=>{
    		console.log("\nRelease built successfully\t[" + (+new Date() - start) + " ms]");
    	})
    };

	/**
     * Parses the html files and copies them to the dist directory
     *
     * @returns {Promise}
     */
    const html = () => {
        return Func.measureTime((resolve) => {
            Func.replace({
                [path.src + "html/init.html"]: path.tmp + "html/init.html",
                [path.src + "html/manage.html"]: path.tmp + "html/manage.html",
                [path.src + "html/not_found.html"]: path.tmp + "html/not_found.html",
                [path.src + "html/sidepanel.html"]: path.tmp + "html/sidepanel.html",
                [path.src + "html/new_tab.html"]: path.tmp + "html/new_tab.html"
            }, [
                [/<\!\-\-\s*\[START\sREMOVE\]\s*\-\->[\s\S]*?<\!\-\-\s*\[END\sREMOVE\]\s*\-\->/mig, ""],
                [/<\!\-\-\s*\[START\sREPLACE\]\s*\-\->[\s\S]*?<\!\-\-\s*\[END\sREPLACE\]\s*\-\->/mig, "<script src=\"/media/js/m/manage_basic.js\"></script>"],
                [/\/media\/js\/helper\//ig, "/media/js/m/"]
            ]).then(()=>{
            	return new Promise((rslv) => {//延时去压缩
                    setTimeout(rslv, 1500);
                });
            })
            .then(() => {
                return Func.minify([path.tmp + "html/*"], path.dist + "html/");
            }).then(resolve);
        }, "Moved html files to dist directory");
    };
    
    
    
    /**
     * Parses the json files and copies them to the dist directory
     *
     * @returns {Promise}
     */
    const worker = () => {
        return Func.measureTime((resolve) => {
            Func.replace({
                [path.src + "service_worker.js"]: path.tmp + "service_worker.js",
            }, [
                [/\/\*\-\-\s*\[start\]\s*\-\-\*\/[\s\S]*?\/\*\-\-\s*\[end\]\s*\-\-\*\//mig, "import\"./media/js/worker.js\""],
            ]).then(() => {
                return Func.minify([path.tmp + "service_worker.js"], path.dist);
            }).then(resolve);
        }, "Create service worker files to dist directory");
    };
    
    /**
     * Parses the json files and copies them to the dist directory
     *
     * @returns {Promise}
     */
    const json = () => {
        return Func.measureTime((resolve) => {
            Func.replace({ // parse manifest.json
                [path.src + "manifest.json"]: path.tmp + "manifest.json"
            }, [
                [/("content_scripts":[\s\S]*?"js":\s?\[)([\s\S]*?)(\])/mig, "$1\"media/js/lib/jst.js\",\"media/js/lib/jscs.js\",\"media/js/opts.js\",\"media/js/client.js\"$3"],
                [/("version":[\s]*")[^"]*("[\s]*,)/ig, "$1" + packageJson.version + "$2"],
            ])
			.then(resolve);
            
        }, "Replace basic info of manifest.json");
    };

     /**
     * Read the package.json of the project and parse its JSON content into an object
     *
     * @returns {*}
     */
    const loadPackageJson = () => {
        return Func.measureTime((resolve) => {
            const fs = require("fs");

            const rawData = fs.readFileSync("package.json");
            const parsedData = JSON.parse(rawData);

            if (parsedData) {
                packageJson = parsedData;
                packageJson.preamble = `(c) ${packageJson.author} under ${packageJson.license}`;
                resolve();
            } else {
                console.error("Could not load package.json");
                process.exit(1);
            }
        }, "Loaded package.json");
    };
    
    /**
     * Copies the images to the dist directory
     *
     * @returns {Promise}
     */
    const mvCss = () => {
        return Func.measureTime((resolve) => {
        	Func.powerfulCopy(path.tmp+"/media/scss", path.dist+"/media/css").then(resolve);
        }, "Moved css files to dist directory");
    };
    
    /**
     * Copies the images to the dist directory
     *
     * @returns {Promise}
     */
    const img = () => {
        return Func.measureTime((resolve) => {
            Func.copy([path.src + "media/img/**/*"], [], path.dist ,false).then(resolve);
        }, "Moved image files to dist directory");
    };
    
    /**
     * Copies the images to the dist directory
     *
     * @returns {Promise}
     */
    const conf = () => {
        return Func.measureTime((resolve) => {
            Func.minify([
                path.src + "media/conf/*"
            ], path.dist, false, packageJson.preamble).then(resolve);
            
        }, "Moved conf files to dist directory");
    };
    
    /**
     * Parses the scss files and copies the css files to the dist directory
     *
     * @returns {Promise}
     */
    const css = () => {
        return Func.measureTime((resolve) => {
            Func.minify([ // parse scss files
                path.src + "/media/scss/**/*.scss"
            ], path.tmp, false, packageJson.preamble).then(resolve);
        }, "Compile scss to css");
    };
    
    /**
     * Parses the js files and copies them to the dist directory
     *
     * @returns {Promise}
     */
    const js = () => {
        return Func.measureTime((resolve) => {
            Func.concat( // concat extension javascripts
                [
                    path.src + "media/js/helper/**/*.js",
                    path.src + "media/js/client.js"
                ],
                path.tmp + "client-merged.js"
            )
            .then(() => {
                return Func.concat( // concat background javascripts
                    [
                        path.src + "media/js/bg/**/*.js",
                        path.src + "media/js/main.js"
                    ],
                    path.tmp + "worker-merged.js"
                );
            })
            .then(() => {
                return Func.concat( //manage merge
                    [
                        path.src + "media/js/manage/*.js",
                        path.src + "media/js/manage.js"
                    ],
                    path.tmp + "manage-merged.js"
                );
            })
            .then(() => {
                return Func.concat( //new tab merge
                    [
                        path.src + "media/js/new_tab/*.js",
                        path.src + "media/js/new_tab.js"
                    ],
                    path.tmp + "newtab-merged.js"
                );
            })
            .then(() => {
                return Func.concat( //not found merge
                    [
                        path.src + "media/js/not_found/*.js",
                        path.src + "media/js/not_found.js"
                    ],
                    path.tmp + "notfound-merged.js"
                );
            })
            .then(() => {
            	
                return Func.concat( //manage need basic js
                    [
                        path.src + "media/js/helper/i18n.js",
                        path.src + "media/js/helper/font_add.js",
                        path.src + "media/js/helper/style_helper.js",
                        path.src + "media/js/helper/template.js",
                        path.src + "media/js/helper/dao.js",
                        path.src + "media/js/helper/util.js",
                    ],
                    path.tmp + "manage-basic-merged.js"
                );
            })
            .then(() => {
                return Func.replace({
                    [path.tmp + "client-merged.js"]: path.tmp + "client.js",
                    [path.tmp + "worker-merged.js"]: path.tmp + "worker.js",
                    [path.tmp + "manage-merged.js"]: path.tmp + "manage.js",
                    [path.tmp + "notfound-merged.js"]: path.tmp + "not_found.js",
                    [path.tmp + "manage-basic-merged.js"]: path.tmp + "manage_basic.js",
                    [path.tmp + "newtab-merged.js"]: path.tmp + "new_tab.js",
                }, [
                    [/}\)\(jsu\);[\s\S]*?\(\$\s*=>\s*{[\s\S]*?"use strict";/mig, ""]
                ]);
            })
            .then(() => { // delay execution, so the files are created properly before being used to minify
                return new Promise((rslv) => {
                    setTimeout(rslv, 1000);
                });
            })
            .then(() => {
                return Func.minify([
                    path.tmp + "client.js",
                    path.tmp + "worker.js",
                    path.tmp + "manage.js",
                    path.tmp + "not_found.js",
                    path.tmp + "new_tab.js",
                    path.src + "media/js/opts.js",
                    path.src + "media/js/init.js",
                    path.src + "media/js/sidepanel.js",
                ], path.dist + "media/js/", true, packageJson.preamble);
            })
            .then(() => {
                return Func.minify([
                    path.src + "media/js/lib/jst.js",
                    path.src + "media/js/lib/jscs.js",
                    path.src + "media/js/lib/jsbg.js",
                    path.src + "media/js/lib/file_saver.min.js",
                     path.src + "media/js/lib/FileSaver.min.js.map",
                ], path.dist + "media/js/lib/", true, packageJson.preamble);
            })
            .then(() => {
                return Func.minify([
                    path.tmp + "manage_basic.js",
                    path.src + "media/js/helper/confirm.js",
                    path.src + "media/js/helper/subscribe.js",
                    path.src + "media/js/helper/user.js",
                    path.src + "media/js/helper/checkbox.js",
                    path.src + "media/js/helper/bookmark.js",
                    path.src + "media/js/helper/official_website.js",
                    path.src + "media/js/helper/scroll.js",
                    path.src + "media/js/helper/entry.js",
                    path.src + "media/js/helper/privilege.js",
                ], path.dist + "media/js/m/", true, packageJson.preamble);
            })
            .then(resolve);
        }, "Moved js files to dist directory");
    };
    
    /**
     * Copies the images to the dist directory
     *
     * @returns {Promise}
     */
    const dev = () => {
	    return Func.measureTime( async (resolve) => {
	    	
	    	const dealwith = (platform) => {
    			
    			return new Promise((resv) => {//延时去压缩
    			   
    			   const pack=target + "/" + platform.name;
    			   Func.powerfulRemove(pack)
    			   .then(()=>{
    			   	  return Func.powerfulCopy(path.src + "manifest.json",path.tmp+"manifest.json");
    			   })
    			   .then(()=>{
    			   		return Func.replace({ // parse manifest.json
		               		[path.tmp + "manifest.json"]: path.tmp + "manifest.json"
			            	}, [
				                [/("permissions":\s?\[)([\s\S]*?)(\])/mig,"$1"+platform.permissions+"$3"],
				                [/("optional_permissions":\s?\[)([\s\S]*?)(\])/mig,"$1"+platform.optional_permissions+"$3"],
				                [/("minimum_chrome_version":[\s]*")[^"]*("[\s]*,)/ig, "$1" + platform.minimum_chrome_version + "$2"],
				                [/("version_name":[\s]*")[^"]*("[\s]*,)/ig, "$1" + "Dev.{name}.beta".replace("{name}",platform.name) + "$2"],
				                [/("run_at"[\s\S]*}\]\s?)([\s\S]*?)(\s?})/ig, "$1" + platform.update_url + "$3"],
			           	])
    			    })
    			    .then(()=>{
    			   		
    			   		//sidepanel
    			   		if(!platform.side_panel){
	            			
	            			return Func.replace({ // parse manifest.json
				                [path.tmp + "manifest.json"]: path.tmp + "manifest.json"
				            }, [
				                [/"side_panel"\s*:\s*\{[\s\S]*?\}\s*,?/g, ""],
				            ])
	            		}else{
	            			return new Promise((resve)=>resve());
	            		}
    			    })
    			    .then(()=>{
    			    	
    			    	//overrides
    			   		if(!platform.overrides){
    			   			
	            			return Func.replace({ // parse manifest.json
				                [path.tmp + "manifest.json"]: path.tmp + "manifest.json"
				            }, [
				                [/"chrome_url_overrides"\s*:\s*\{[\s\S]*?\}\s*,?/g, ""],
				            ])
	            		}else{
	            			return new Promise((resve)=>resve());
	            		}
    			    })
    			    .then(()=>{
		        		return Func.powerfulCopy(path.src,pack);//copy
		        	})
		        	.then(()=>{
		        		return Func.powerfulRemove(pack+ "/media/scss");//delete scss
		        	})
		        	.then(()=>{
		        		return Func.powerfulCopy(path.tmp+"manifest.json",pack+"/manifest.json");//copy manifest.json
		        	})
		        	.then(()=>{
		        		return Func.powerfulCopy(path.tmp+"/media/scss",pack+"/media/css");//copy new css
		        	})
		        	.then(resv);
                });
    		}
	    	
        	const platforms=getPlatforms();
    		for(let platform of platforms){
    			await dealwith(platform);
    		}
    		resolve();
    		
        }, "dev version deploy successfully");
    };
    
    const getPlatforms = ()=>{
    	
    	//basic
    	let basicPermissions=[
    		"\"storage\"",
	    	"\"contextMenus\"",
	    	"\"unlimitedStorage\"",
    	]
    	
    	//permissions
    	let permissions = JSON.parse(JSON.stringify(basicPermissions));
		permissions.push("\"bookmarks\"");
		permissions.push("\"fontSettings\"");
		permissions.push("\"cookies\"");
		permissions.push("\"search\"");// NTP: chrome.search.query (all platforms)
		
		let optional_permissions =[]
		
		const platforms=[];
		platforms.push({
			name:'compatible',
			permissions:permissions,
			minimum_chrome_version:92,
			optional_permissions:optional_permissions,
			update_url:"",
			side_panel:false,
			overrides:false,
		});
		
		let extendPermissions = JSON.parse(JSON.stringify(permissions));
		extendPermissions.push("\"favicon\"");
		extendPermissions.push("\"sidePanel\"");//新加权限114以上内核
		
		platforms.push({
			name:'edge',
			permissions:extendPermissions,
			minimum_chrome_version:114,
			optional_permissions:optional_permissions,
			update_url:"",
			side_panel:true,
			// Use standard chrome_url_overrides (same as Chrome) — required by Edge policy 1.1.8
			overrides:true,
		});
		
		platforms.push({
			name:'chrome',
			permissions:extendPermissions,
			minimum_chrome_version:114,
			optional_permissions:optional_permissions,
			update_url:"",
			side_panel:true,
			overrides:true,
		});
		
		//360se 浏览器权限分配
		let permissions360Se = JSON.parse(JSON.stringify(permissions));
		permissions360Se.push("\"favicon\"");
		
		platforms.push({
			name:'360se',
			permissions:permissions360Se,
			minimum_chrome_version:104,
			optional_permissions:[],//清除这两个权限
			update_url:"    ,\"update_url\": \"http://upext.chrome.360.cn/intf.php?method=ExtUpdate.query\"",
			side_panel:false,
			overrides:false,
		});
		
		//360x浏览器权限分配
    	let permissions360X = JSON.parse(JSON.stringify(permissions));
		permissions360X.push("\"favicon\"");
		
		platforms.push({
			name:'360x',
			permissions:permissions360X,
			minimum_chrome_version:104,
			optional_permissions:optional_permissions,
			update_url:"    ,\"update_url\": \"http://upext.chrome.360.cn/intf.php?method=ExtUpdate.query\"",
			side_panel:false,
			overrides:true,
		});

		return platforms;
    }
    
    const branch = ()=>{
    	
    	return Func.measureTime( async (resolve) => {

    		const dealwith = (platform) => {
    			
    			return new Promise((rsv) => {//延时去压缩
    				
    				json()
    				.then(()=>{
    					
    					return Func.replace({ // parse manifest.json
		                [path.tmp + "manifest.json"]: path.tmp + "manifest.json"
			            }, [
			                [/("permissions":\s?\[)([\s\S]*?)(\])/mig,"$1"+platform.permissions+"$3"],
			                [/("optional_permissions":\s?\[)([\s\S]*?)(\])/mig,"$1"+platform.optional_permissions+"$3"],
			                [/("minimum_chrome_version":[\s]*")[^"]*("[\s]*,)/ig, "$1" + platform.minimum_chrome_version + "$2"],
			                [/("version_name":[\s]*")[^"]*("[\s]*,)/ig, "$1" + packageJson.versionName.replace("{name}",platform.name) + "$2"],
			                [/("run_at"[\s\S]*}\]\s?)([\s\S]*?)(\s?})/ig, "$1" + platform.update_url + "$3"],
			            ])
    				})
                    .then(()=>{
    			   		
    			   		//sidepanel
    			   		if(!platform.side_panel){
	            			
	            			return Func.replace({ // parse manifest.json
				                [path.tmp + "manifest.json"]: path.tmp + "manifest.json"
				            }, [
				                [/"side_panel"\s*:\s*\{[\s\S]*?\}\s*,?/g, ""],
				            ])
	            		}else{
	            			return new Promise((resve)=>resve());
	            		}
	            		
    			    })
                    .then(()=>{
    			    	
    			    	//overrides
    			   		if(!platform.overrides){
    			   			
	            			return Func.replace({ // parse manifest.json
				                [path.tmp + "manifest.json"]: path.tmp + "manifest.json"
				            }, [
				                [/"chrome_url_overrides"\s*:\s*\{[\s\S]*?\}\s*,?/g, ""],
				            ])
	            		}else{
	            			return new Promise((resve)=>resve());
	            		}
    			    })
		            .then(()=>{
		            	return new Promise((rslv) => {//延时去压缩
		                    setTimeout(rslv, 1000);
		                });
		            })
		            .then(() => { // minify in dist directory
		                return Func.minify([path.tmp +"manifest.json",path.src + "_locales/**/*.json"], path.dist, false);
		            })
		            .then(()=>{
		            	return zip(platform.name);
		            }).then(rsv);
                });
    		}
    		
    		const platforms=getPlatforms();
    		for(let platform of platforms){
    			await dealwith(platform);
    		}
    		resolve();
    		
        }, "Created Diff branch to dist directory");
    }
    
    
    /**
     * Generate zip file from dist directory
     *
     * @returns {Promise}
     */
    const zip = (name) => {
        return Func.measureTime((resolve) => {
            Func.zipDirectory(path.dist, packageJson.name + "_" + packageJson.versionName.replace("{name}",name) + ".zip").then(resolve);
        }, "Created zip file "+name+" from dist directory");
    };
    
    //execute
    Build();
})();