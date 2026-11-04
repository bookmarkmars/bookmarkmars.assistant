($ => {
    "use strict";

    /**
     * @param {object} ext
     * @constructor
     */
    $.PanelHelper = function (ext) {
        
        const panel = {};
        const timeout = {};

        let openDelay = 0;
        let mouseNotTopLeft = false;
        let panelPos = null;
        let preventPageScroll = null;
        let preventWindowed = null;
        let preventWebapp = null;
        let panelWidth = null;
        let sidebarWidth = null;
        let inPixelToleranceTime = null;
        let keypressed = null;

        /**
         * Initializes the sidebar toggle
         *
         * @returns {Promise}
         */
        this.init = async () => {
            
            const data = ext.helper.dao.getData(["b/panel","b/panelPos","b/openWay","b/showPanelIcon","b/openAction","b/openDelay","b/position","b/preventPageScroll", "a/styles","b/preventWindowed","b/preventWebapp"]);
            const pageType = ext.helper.util.getPageType();

            ext.elm.panel = $("<div></div>")
                .attr("id", $.opts.ids.page.panel)
                .addClass("notranslate")
                .appendTo($(ext.elm.shadow));

            Object.entries(data.panel).forEach(([key, val]) => {
                panel[key] = +val;
            });

            openDelay = +data.openDelay * 1000;
            panelPos = data.panelPos;
            preventPageScroll = data.preventPageScroll;
            preventWindowed = data.preventWindowed;
            preventWebapp = data.preventWebapp;

            ext.elm.panel.css({
                height: panel.height + "%",
                top: panel.top + "%"
            });
            
            //100%
            if (panel.height === 100) {
                ext.elm.panel.addClass($.cl.page.fullHeight);
            }

            if (data.styles) {
                
                if (data.styles.panelWidth) {
                    panelWidth = parseInt(data.styles.panelWidth);
                }
                if (data.styles.sidebarWidth) {
                    sidebarWidth = parseInt(data.styles.sidebarWidth);
                }
            }
           
			//data.openWay，以哪种方式打开助手
            if (['all','panel'].indexOf(data.openWay) !== -1 && pageType !== $.opts.attr.sidepanel && data.openAction !== "icon" && data.openAction !== "mousemove") { // show indicator
                
                ext.elm.panel.html("<div></div>").attr($.attr.position, panelPos);

                if (data.showPanelIcon) { // show indicator icon
                    $("<span></span>")
                    .addClass($.cl.toggle.logo)
                    .appendTo(ext.elm.panel.children("div"));
                    
                     $("<span></span>")
                    .addClass("direct-"+panelPos)
                    .appendTo(ext.elm.panel.children("div"));
                }
                
                 $.delay(50).then(() => { // delay to prevent indicator beeing visible initial
                    ext.elm.panel.addClass($.cl.visible);
                });
                
                //有召唤面板再监听事件
                initEvents();
            }
        };


        /**
         * Initializes the events to show and hide the bookmark sidebar
         *
         * @returns {Promise}
         */
        const initEvents = async () => {
            
            ext.elm.sidebar.on("mouseleave", (e) => {

                //使用 `mouseleave`事件的延迟属性来解决 Edge 浏览器和 Chrome 浏览器中行为不同的问题 
                if (e.originalEvent?.type === "mouseleave" && (e.toElement || e.relatedTarget)) { // prevent false positive triggering to close the sidebar (seems to be a bug in Chrome)

					$.delay(150).then(() => {
                        ext.helper.ball.removeSidebarHoverClass();
                    });

                    if (ext.elm.iframeBody.hasClass($.cl.drag.isDragged) === false) {
                        
                        const closeTimeoutRaw = ext.helper.dao.getData("b/closeTimeout");

                        if (+closeTimeoutRaw !== -1) { // timeout only if value > -1
                            timeout.close = setTimeout(() => {
                                if (
                                	ext.elm.iframeBody.hasClass($.cl.drag.isDragged) === false &&
                                	ext.elm.iframe.hasClass($.cl.sidebar.extLoaded)
                                ) {
                                     ext.helper.ball.closeSidebar();
                                }
                            }, +closeTimeoutRaw * 1000);
                        }
                    }

                }
            }).on("mouseenter", () => {
                clearSidebarTimeout("close");
            });

            $(document).on("mouseleave.be", (e) => {
            	
            	//使用 `mouseleave`事件的延迟属性来解决 Edge 浏览器和 Chrome 浏览器中行为不同的问题
            	if (e.originalEvent?.type === "mouseleave") {
			      clearSidebarTimeout("open");
                  clearSidebarTimeout("panel");
                  ext.elm.panel.removeClass($.cl.page.hover);
			    }
            })
            .on("mousemove.be", (e) => { // check mouse position
            	
                if (e.isTrusted && isMousePosInPixelTolerance(e.clientX, e.clientY) && !ext.elm.iframe.hasClass($.cl.sidebar.extLoaded)) {
                    const inPixelToleranceDelay = +new Date() - (inPixelToleranceTime || 0);

                    if (!(timeout.panel)) {
                        timeout.panel = setTimeout(() => { //等待面板延时，后打开面板
                            ext.elm.panel.addClass($.cl.page.hover);
                        }, Math.max(openDelay - inPixelToleranceDelay, 0));
                    }
                } else {
                    clearSidebarTimeout("panel");
                    ext.elm.panel.removeClass($.cl.page.hover);
                }
            }, {passive: true});

			//default is click
            const openAction = ext.helper.dao.getData("b/openAction");

            if (openAction !== "icon") {
                $(document).on(openAction + ".be dragover.be", (e) => {
                    
                    let openByType = false;
        			
        			if (e.type === "mousedown") { // mousedown -> only open when the left mouse button is pressed
                        openByType = e.button === 0;//左键
                    } else {
                        openByType = true;
                    }

                    if (e.isTrusted && openByType && isMousePosInPixelTolerance(e.clientX, e.clientY)) { // check mouse position and mouse button
                        
                        //停止冒泡
                        e.stopPropagation();
                        e.preventDefault();

                        if (openAction === "mousemove") {
                            if (!(timeout.open)) {
                                timeout.open = setTimeout(() => {
                                    ext.helper.ball.openSidebar();
                                }, openDelay);
                            }
                        } else if (openDelay === 0 || inPixelToleranceTime === null || +new Date() - inPixelToleranceTime > openDelay) { // open delay = 0 or cursor is longer in pixel tolerance range than the delay -> open sidebar
                            ext.helper.ball.openSidebar();
                        }
                        
                    } else {
                    	
                    	//消除延时
                        clearSidebarTimeout("open");
                    }
                });
            }
        };

        /**
         * Checks whether the given mouse position is in the configured pixel tolence
         *
         * @param {int} clientX
         * @param {int} clientY
         * @returns {boolean}
         */
        const isMousePosInPixelTolerance = (clientX, clientY) => {
            
            let ret = false;

            if (preventWebapp && ext.helper.util.isWebapp()) {
                // prevent opening the sidebar in a PWA with the according option set to true
            } else if (preventWindowed && ext.helper.util.isWindowed()) {
                // prevent opening the sidebar in window mode with the according option set to true
            } else if (document.fullscreen || document.webkitIsFullScreen) {
                // don't open the sidebar when the website requested fullscreen (will be false when a user browses with F11 fullscreen)
            } else if (keypressed !== null && +new Date() - keypressed < 500) {
                // a key is pressed -> prevent opening the sidebar
            } else if (typeof clientX !== "undefined" && clientX !== null) {
                if ((clientX > 0 || clientY > 0) || mouseNotTopLeft) { // protection from unwanted triggers with x = 0 and y = 0 on pageload
                    mouseNotTopLeft = true;

					//根据位置判断坐标
                    if (panelPos === "right") {
                        clientX = window.innerWidth - clientX - 1;
                    }

                    let w = parseInt(panel.width);
                    
                    if (ext.helper.util.isWindowed()) { // return different values for the panel area width in window mode
                        w = parseInt(panel.widthWindowed);
                    }

                    const area = {
                        w: w,
                        h: clientY / window.innerHeight * 100
                    };

                    if (ext.elm.panel.hasClass($.cl.page.hover) && panelWidth > area.w) { // indicator is visible -> allow click across the indicator width if it is wider then the pixel tolerance
                        area.w = panelWidth;
                    }

                    ret = clientX < area.w && (area.h >= panel.top && area.h <= panel.top + panel.height);
                }
            }

            if (ret === false) {
                inPixelToleranceTime = null;
            } else if (inPixelToleranceTime === null) { // set the time when the cursor was in pixel tolerance the last time
                inPixelToleranceTime = +new Date();
            }

            return ret;
        };

        /**
         * Clears the given timeout
         *
         * @param {string} name
         */
        const clearSidebarTimeout = (name) => {
            if (timeout[name]) {
                clearTimeout(timeout[name]);
                timeout[name] = null;
            }
        };
    };

})(jsu);