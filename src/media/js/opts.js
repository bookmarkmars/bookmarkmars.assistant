($ => {
    "use strict";
    
    const localHost="http://127.0.0.1:8080/bookmarkchina/";
    
    const serverHost="https://extensions.chatchatstudy.com/";
    
    //这个需要二次配置，如果域名被封
    const official  = "https://www.bookmarkmars.com/";
    
    // eslint-disable-next-line no-undef
    $.api = typeof chrome === "undefined" ? browser : chrome;
    
    const manifest = $.api.runtime.getManifest();
    
    //isDev，单机版
    $.isDev = manifest.version_name.trim().startsWith("Dev");

    const getChromeVersion = () => {
    	
    	let rs=navigator.appVersion.match(/.*Chrome\/([0-9\.]+)/)[1].split(".")[0];
    	if(!rs){
    		rs = navigator.userAgent.match(/.*Chrome\/([0-9\.]+)/)[1].split(".")[0];
    	}
    	
    	return rs;
    }
    
	const getVName = () => {
		
		const supports= manifest.version_name.split(".");
	    const vName=supports[supports.length - 2];
	    
	    return vName;
	}
    
    const is360SeBrowserVersion = () => {
    	
    	if(['360se'].some(e => getVName().indexOf(e)!==-1)){
	    	return true;
	    }
	    return false;
    }
    
    const is360XBrowserVersion = () => {
    	
    	if(['360x'].some(e => getVName().indexOf(e)!==-1)){
	    	return true;
	    }
	    return false;
    }

    $.opts = {
        ids: {
            page: {
                iframe: "lds_be_helper",
                overlay: "lds_be_popup",
                newtab: "lds_be_newtab",
                indicator: "lds_be_ball",
                panel:"lds_be_panel"
            },
            sidebar: {
                sidebar: "helper",
                reloadInfo: "reload_info",
                infoBox: "info_box",
                bookmarkBox: {
                    all: "bookmark_box",
                    sort:"bookmark_sort",
                    search: "bookmark_box_search",
                }
            },
            confirm: {
                urlCheckResult: "results",
                linkCheckModal:"lds_be_linkcheck",
                toast:"lds_be_toast"
            }
        },
        classes: {
            active: "active",
            visible: "visible",
            hidden: "hidden",
            success: "success",
            selected: "selected",
            error: "error",
            info: "info",
            add: "add",
            refresh:"refresh",
            edit: "edit",
            icon: "icon",
            cancel: "cancel",
            remove: "remove",
            close: "close",
            back : "back",
            hover: "hover",
            loading: "loading",
            building: "building",
            initLoading: "init-loading",
            brokenUrl:"lds-be-broken-url",
            notLogin:"not-login",
            notification:"notification",
            result:"result",
            name:"name",
            lock:"lock",
            header:{
            	choose:"choose",
            	notify:"notify",
            },
            page: {
                dark: "dark",
                hideMask: "lds-be-hide-mask",
                hover: "lds-be-hover",
                noscroll: "lds-be-noscroll",
                style: "lds-be-style",
                fullHeight: "lds-be-full-height",
            },
            sidebar: {
                extLoaded: "loaded",
                fadeIn:"helper-fade-in",
                selectionMode: "selection-mode",
                openedOnce: "opened-once",
                permanent: "permanent",
                pinned:"pinned",
                cached: "cached",
                mark: "mark",
                hideRoot: "hide-root",
                dirAnimated: "animated",
                dirOpened: "opened",
                dirArrow: "has-arrow",
                bookmarkDir: "dir",
                dirIcon: "icon",
                separator: "separator",
                bookmarkLink: "link",
                bookmarkLabel: "label",
                star: "star",
                menu: "menu",
                sort: "sort",
                filter:"filter",
                fixed: "fixed",
                lastHover: "last-hover",
                copied: "copied",
                dirBare:"dir-bare",
                search: "search",
                searchBox: "search-box",
                searchClear:"search-clear",
                searchButton: "search-button",
                searchResultBare: "search-result-bare",
                toolBox: "tool-box",
                breadcrumb: "breadcrumb",
                removed: "removed",
                freUsed:"fre-used",
                svgNotice:"be-svg-notice",
            },
            tooltip: {
                wrapper: "tooltip"
            },
            contextmenu: {
                wrapper: "contextmenu",
                top: "top",
                list: "list",
                icons: "icons",
                right: "right",
                separator: "separator"
            },
            toggle:{
            	dragHelper:"indicator-drag-helper",
            	isDragged: "indicator-is-dragged",
            	indicator:"be-indicator",
            	circle:"be-circle",
            	isDragging:"dragging",
            	collect:"collect",
            	logo:"logo",
            	fadeOut:"helper-fade-out"
            	
            },
            drag: {
                trigger: "drag",
                helper: "drag-helper",
                isDragged: "is-dragged",
                cancel: "drag-cancel",
                dragHover: "drag-hover",
                snap: "snap",
                dragInitial: "drag-initial",
                isClick:"is-click"
            },
            scrollBox: {
                wrapper: "scroll-box",
                hideScrollbar: "hide-scrollbar",
                scrolled: "scrolled"
            },
            checkbox: {
                box: "checkbox",
                clicked: "clicked",
                focus: "focus"
            },
            confirm: {
                modal: "modal",
                preview: "preview",
                previewUrl: "preview-url",
                action: "action",
                collect:"collect",
                folder:"folder",
                addFolder:"add-folder",
                progressBar: "progress-bar",
                buttonWrapper: "buttons",
                checkUrlProgressLabel: "progress-label",
                urlCheckLoading: "loading",
                urlCheckCategories: "categories",
                urlCheckAction: "action",
                urlCheckHide: "hide",
                urlCheckResults: "results",
                toastText:"be-show-text",
            },
            onboarding: {
                slide: "slide",
                skip: "skip",
                close: "close",
                finish:"finish",
                settings: "settings",
                toggleArea: "toggle-area",
                appearance: "appearance",
                large: "large",
            },
            newtab: {
                customBackground: "my-bg",
                smallContent: "small",
                suggestions: "suggestions",
                imgChange: "img-change",
                linkChange:"link-change",
                link: "link",
                icon:"icon",
                listening: "listening",
                remove: "remove",
                infoBar: "info-bar",
                upload: "upload",
                save: "save",
                thumbnail:"thumbnail",
                isLogin:"is-login",
                wallpaper:"wallpaper",
                scrollLeft:"scroll-left",
                scrollRight:"scroll-right",
                setting:"setting",
                uploadImg:"upload-img",
                disclaimer:"disclaimer",
            },
            manage: {
                tabs: {
                    content: "tab"
                },
                color: {
                    field: "color",
                    mask: "color-mask",
                },
                radio: {
                    wrapper: "radio-wrapper"
                },
                newtab: {
                    hideable: "hideable"
                },
                bookmarksManage:{
                	domtree:"domtree",	
                	dir:"domtree-dir",
                	open:"open-dir"
                },
                ucenter:{
                	userInfo:"user-info",
                	username:"username",
                	welcome:"welcome",
                	info:"info",
                	openVip:"open-vip",
                	logout:"logout",
                },
                backup: {
                   contentBox:"content-box",
                   authorize:"authorize",
                   autoBackup:"auto-backup",
                   manual:"manual",
                   mask:"mask",
                   recordVisit:"record-visit"
                },
                linkchecker: {
                    powerfulCheck: "powerful-check"
                },
                inactive: "inactive",
                revert: "revert",
                highlight: "highlight",
                lazyloaded: "lazyloaded",
                sub: "sub",
                desc: "desc",
                box: "box",
                dialog: "dialog",
                contentBox: "content-box",
                suggestion: "suggestion",
                logo:"logo",
                loaded:"loaded",
                needLogin:"need-login",
                chargeSug:"charge-sug",
                titleHandler:"title-handler"
            }
        },
        attr: {
            uid: "data-lds-be-uid",
            src: "data-src",
            type: "data-type",
            name: "data-name",
            value: "data-value",
            register: "data-register",
            sort: "data-sort",
            position:"data-pos",
            title: "title",
            hidden:"data-hidden",
            stop: "data-stop",
            overrides:"data-overrides",
            href: "href",
            style: "data-style",
            id: "data-id",
            i18n: "data-i18n",
            origin:"data-origin",
            script:"script-sidebar",
            sidepanel:"sidepanel",
            i18nReplaces: "data-i18nReplaces",
            onboarding: {
                openType: "data-openType",
                surface: "data-surface"
            },
            settings: {
                appearance: "data-appearance",
                success: "data-successtext",
                save: "data-save",
                restore: "data-restore",
                range: {
                    min: "data-min",
                    max: "data-max",
                    step: "data-step",
                    unit: "data-unit",
                    infinity: "data-infinity"
                },
                color: {
                    alpha: "data-alpha",
                    suggestions: "data-suggestions"
                },
                field: {
                    placeholder: "data-placeholder"
                }
            }
        },
        events: {
        	toggleSidebar:"lds-be-toogle-sidebar",
        	overlayClosed: "lds-be-overlay-closed",
            openSidebar: "lds-be-sidebar-open",
            sidebarOpened: "lds-be-sidebar-opened",
            checkboxChanged: "lds-be-checkbox-changed",
            scrollBoxLastPart: "lds-be-scrollbox-lastpart",
            resetBallPosition:"lds-be-reset-ball-position",
        },
        website: {
        	scope:"plugin/",
            main: {
                official: $.isDev?localHost:official,
                extension:$.isDev?localHost:serverHost
            },
            servletExt: {
                api:{
                	remoteConf:"api/remote/conf",
                	remoteDataCache:"api/remote/cache",
                	version:"api/version",
                	bg:"api/bg",
                	privilege:"api/privilege/desc",
                	keyword:"api/keyword"
                },
                statistics:"statistics",
                introduction:"intro",
            },
            servletMain:{
            	user:{
            		isLogin:"user/is/login",
            		userCheck:"user/check",
            		userInfo:"user/login/info",
            		upload: "user/bookmark/upload",
            		shortcutsSave: "user/shortcuts/save",
            		shortcutsLoad: "user/shortcuts/load",
            		
            	},
            	collect:{
	        		folderMine:"collect/folder/mine",
	        		folderGet:"collect/folder/get",
	        		addEditFolder:"collect/folder/addedit",
	        		submit:"collect/submit",
            	},
            	exclude:{
            		login: "login",
                	register: "register",
                	search:"s/search"
            	},
            	privacy:"privacy",
                vip: "vip/privilege",
                live:"server/live",
                uninstall:"uninstall",
                serverBookmark:"api/bookmark/search",
                backup:"backup/record",
                download:"index"
            },
        },
        urlAliases: {
            Edge: {
                "chrome://newtab/": "edge://newtab/",
                "chrome://bookmarks": "edge://favorites",
                "chrome://extensions/shortcuts": "edge://extensions/shortcuts",
                "chrome://settings/syncSetup": "edge://settings/profiles/sync"
            },
            Opera: {
                "chrome://newtab/": "chrome://startpage/",
                "chrome://bookmarks": "opera://bookmarks",
                "chrome://extensions/shortcuts": "opera://settings/keyboardShortcuts"
            },
            Oth360seOrMaxthon: {
                "chrome://newtab/": "se://newtab/",
                "chrome://bookmarks": "se://bookmarks",
                "chrome://extensions/shortcuts": "se://settings/keyboardShortcuts"
            }
        },
        cipher:"bookmarkearth",
        cookie:"be_cookie",
        netWorkError:{
    		code:"error",
    		codeMsg:"networkFail",
    		data:null,
    	},
        manifest: manifest,
        maxAllowAsySize:20,
    };
    
    $.faviconLowestVersion = 104;
    
    $.browserCoreVersion = getChromeVersion();

    $.is360SeBrowserV = is360SeBrowserVersion();
    
    $.is360XBrowserV = is360XBrowserVersion();
    
    $.vName = getVName();
    
    $.copyrightDate = 2020;
    
    $.browserName = "Chrome";
    if (/EDG\//i.test(navigator.userAgent)) {
        $.browserName = "Edge";
    } else if (/OPERA|OPR\//i.test(navigator.userAgent)) {
        $.browserName = "Opera";
    }else if(/QQBrowser\//i.test(navigator.userAgent)){
    	$.browserName = "QQBrowser";
    }
    //纯粹是流氓，没法区分是chrome还是360浏览器，导致其他浏览器bug
    //除非找到明确的区分方式，否则不打开这句话
    //else if(/AppleWebKit|Safari\//i.test(navigator.userAgent)){
	//	$.browserName = "Oth360seOrMaxthon";
	//}

    /**
     * Chrome Web Store policy: NTP search must use the browser default via chrome.search.
     */
    $.usesBrowserSearch = () => {
        const perms = manifest.permissions || [];
        return perms.indexOf("search") > -1
            && $.api.search
            && typeof $.api.search.query === "function";
    };

    $.cl = $.opts.classes;
    $.attr = $.opts.attr;
})(jsu);