($ => {
    "use strict";

    /**
     * @param {object} ext
     * @constructor
     */
    $.DragmoveHelper = function (ext) {

        let sidebarPos = null;
        let showCreationDialog = false;
        let oldAboveElm = null;
        let oldTopVal = 0;
        let dirOpenTimeout = null;
        let sort = null;

        const edgeScroll = {
            running: false,
            posY: null,
            previousDelta: 0,
            fpsLimit: 30
        };

        /**
         * Initializes the events for the drag n drop functionality
         *
         * @returns {Promise}
         */
        this.init = async () => {
            sidebarPos = ext.helper.dao.getData("b/sidebarPosition");
            showCreationDialog = ext.helper.dao.getData("b/dndCreationDialog");
            initEvents();
        };

        /**
         * Cancels the dragging and resets the position of the dragged element
         */
        this.cancel = () => {
            const draggedElm = ext.elm.iframeBody.children("a." + $.cl.drag.helper);
            const dragInitialElm = ext.elm.bookmarkBox.all.find("li." + $.cl.drag.dragInitial);
            const entryElm = draggedElm.data("elm");

            if (entryElm && entryElm[0] && dragInitialElm && dragInitialElm[0] && entryElm[0] !== dragInitialElm[0]) {
                entryElm.insertAfter(dragInitialElm).removeClass($.cl.drag.isDragged);
            } else if (entryElm) {
                entryElm.removeClass($.cl.drag.isDragged);
            }

            dragInitialElm.remove();
            draggedElm.remove();
            ext.elm.iframeBody.removeClass([$.cl.drag.isDragged, $.cl.drag.cancel]);
            ext.elm.iframeBody.find("li." + $.cl.drag.dragHover).removeClass($.cl.drag.dragHover);

            $.delay(500).then(() => {
                ext.helper.ball.removeSidebarHoverClass();
            });
        };

        /**
         * Checks if the dragged element is outside of the sidebar, so the mouseup will cause an abort and not a repositioning
         *
         * @param {jsu|int} elm
         * @returns {boolean}
         */
        const isDraggedElementOutside = (elm) => {
            
            let offset = 0;
            let top=0;

            if (typeof elm === "object") {
                const boundClientRect = elm[0].getBoundingClientRect();
                offset = boundClientRect.left;
                top=boundClientRect.top;
            } else {
                offset = +elm;
                top = + elm;
            }

            if (typeof elm === "object") {
                return (elm.realWidth() * 0.6 + offset > ext.elm.sidebar.realWidth() || top < ext.elm.header.realHeight()) ;
            } else {
                return (offset > ext.elm.sidebar.realWidth() || top < ext.elm.header.realHeight());
            }
        };

        /**
         * Returns the type of the element which is dragged
         *
         * @param {jsu|string} elm
         */
        const getDragType = (elm) => {
            let type = "bookmark";

            if (elm === "selection") { // element is text
                type = elm;
            } else if (elm.data("type")) { // element type is cached in data obj
                type = elm.data("type");
            } else { // determine type of given element
                if (elm.hasClass($.cl.sidebar.bookmarkDir)) {
                    type = "directory";
                }
                elm.data("type", type);
            }

            return type;
        };

        /**
         * Start dragging an element (bookmark or directory)
         *
         * @param {Element} node
         * @param {int} x
         * @param {int} y
         */
        const dragstart = (node, x, y) => {

            const elm = $(node).parent("a").removeClass($.cl.sidebar.dirOpened);
            const id = elm.attr($.attr.id);
            const data = ext.helper.entry.getDataById(id);

            if (data === null) {
                return false;
            }

            sort = ext.helper.dao.getData("u/sort");
            const elmParent = elm.parent("li");
            const parentTrigger = elmParent.parent("ul").prev("a");

            ext.elm.iframeBody.addClass($.cl.drag.isDragged);
            elmParent.clone().addClass($.cl.drag.dragInitial).insertAfter(elmParent);

            const helper = elm.clone().appendTo(ext.elm.iframeBody);
            const boundClientRect = elm[0].getBoundingClientRect();

            let index = 0;
            elmParent.prevAll("li").forEach((entry) => {
                if (!$(entry).hasClass($.cl.drag.dragInitial)) {
                    index++;
                }
            });

            helper.removeAttr("title").css({
                top: boundClientRect.top + "px",
                left: boundClientRect.left + "px",
                width: elm.realWidth() + "px"
            }).data({
                elm: elmParent,
                isDir: !!(data.isDir),
                parentId: parentTrigger.length() > 0 ? parentTrigger.attr($.attr.id) : null,
                index: index,
                startPos: {
                    top: y - boundClientRect.top,
                    left: x - boundClientRect.left
                }
            }).addClass($.cl.drag.helper);

            elmParent.addClass($.cl.drag.isDragged);

            if (!edgeScroll.running) {
                window.requestAnimationFrame(edgeScrolling);
            }
        };

        /**
         * Scrolls the bookmark list automatically when the user drags an element near the top or bottom of the list
         *
         * @param {int} currentDelta
         */
        const edgeScrolling = (currentDelta) => {
            window.requestAnimationFrame(edgeScrolling);
            const delta = currentDelta - edgeScroll.previousDelta;

            if (edgeScroll.fpsLimit && delta < 1000 / edgeScroll.fpsLimit) {
                return;
            }

            if (edgeScroll.posY !== null) {
                const bookmarkBoxTopOffset = ext.elm.bookmarkBox.all[0].offsetTop;
                const bookmarkBoxHeight = ext.elm.bookmarkBox.all[0].offsetHeight;
                const scrollPos = ext.helper.scroll.getScrollPos(ext.elm.bookmarkBox.all);
                let newScrollPos = null;

                if (edgeScroll.posY - bookmarkBoxTopOffset < 60) {
                    newScrollPos = scrollPos - Math.pow((50 - edgeScroll.posY + bookmarkBoxTopOffset) / 10, 2);
                } else if (edgeScroll.posY + 60 > bookmarkBoxHeight) {
                    newScrollPos = scrollPos + Math.pow((edgeScroll.posY + 50 - bookmarkBoxHeight) / 10, 2);
                }

                if (newScrollPos) {
                    ext.helper.scroll.setScrollPos(ext.elm.bookmarkBox.all, newScrollPos);
                }
            }

            edgeScroll.previousDelta = currentDelta;
        };

        /**
         * Stop dragging an element (bookmark or directory)
         */
        const dragend = async () => {
            clearDirOpenTimeout();
            const draggedElm = ext.elm.iframeBody.children("a." + $.cl.drag.helper);
            
            let isPinned=draggedElm.hasClass($.cl.sidebar.pinned);

            if (!draggedElm.length() || isDraggedElementOutside(draggedElm)) {// cancel drop if mouse position is outside the sidebar
                this.cancel();
            } else { // animate the helper back to the new position and save it
                
                draggedElm.addClass($.cl.drag.snap);

                const dragInitialElm = ext.elm.bookmarkBox.all.find("li." + $.cl.drag.dragInitial);
                
                //被移动的原始元素>li
                let entryElm = draggedElm.data("elm");

                if (!entryElm || !entryElm[0] || !entryElm[0].isConnected) {
                    this.cancel();
                    return;
                }
                
                //子元素>li > a
                const elm = entryElm.children("a");
                
                //父节点、li的
                const parentList = entryElm.parent("ul");
                
                //父节点id
                const parentId = parentList.prev("a").attr($.attr.id);
                if(!isPinned && parentId < -1 || isPinned && parentId > -1){//非常用书签到了常用目录，取消，常用书签，到了非常用目录
                	this.cancel();
                	return;
                }

                //移动节点的id
                const elmId = elm.attr($.attr.id);
                
                //初始位置0
                let index = 0;

                try {
                    if (!sort || sort.name === "default") {
                        // Default sort draws folders and separators above bookmarks, so
                        // the visual row is not Chrome's child index. Save "after the
                        // previous sibling" using that sibling's real index; Chrome then
                        // decrements when the same-parent move goes downward.
                        let prev = entryElm.prev("li");
                        while (prev.length() && prev.hasClass($.cl.drag.dragInitial)) {
                            prev = prev.prev("li");
                        }
                        if (prev.length()) {
                            const prevData = ext.helper.entry.getDataById(prev.children("a").attr($.attr.id));
                            if (prevData && prevData.index !== undefined && prevData.index !== null) {
                                index = +prevData.index + 1;
                            } else {
                                entryElm.prevAll("li").forEach((node) => {
                                    if (!$(node).hasClass($.cl.drag.dragInitial)) {
                                        index++;
                                    }
                                });
                            }
                        }
                    } else {
                        index = await ext.helper.bookmark.getBookmarkIndexInDirectory(elmId, parentId);

                        if (index === -1) {
                            entryElm = entryElm.appendTo(parentList);
                        } else {
                            const prevElm = parentList.children("li:not(." + $.cl.drag.dragInitial + ")").eq(index);
                            if (prevElm.length() > 0 && prevElm[0] !== entryElm[0]) {
                                entryElm = entryElm.insertAfter(prevElm);
                            } else if (prevElm.length() === 0) {
                                entryElm = entryElm.appendTo(parentList);
                            }

                            const sameParent = String(parentId || "") === String(draggedElm.data("parentId") || "");
                            const startIndex = +draggedElm.data("index") || 0;
                            if (sameParent && index > startIndex) {
                                index++;
                            }
                        }
                    }

                    if (!entryElm || !entryElm[0] || !entryElm[0].isConnected) {
                        this.cancel();
                        return;
                    }

                    if (parentId < -1) { // save position of pinned entry
                        let prevEntry = entryElm.prev("li");
                        if (prevEntry.hasClass($.cl.drag.dragInitial)) {
                            prevEntry = prevEntry.prev("li");
                        }
                        await ext.helper.bookmark.reorderPinnedEntries({
                            id: elmId,
                            prevId: prevEntry.length() > 0 ? prevEntry.children("a").attr($.attr.id) : null
                        });//必须清空缓存
                    } else { // save bookmark/directory position
                        const moved = await ext.helper.dao.call("moveBookmark", {
                            id: elmId,
                            parentId: parentId,
                            index: index
                        });//必须清空缓存，会在事件监听中处理
                        if (!moved || moved.error) {
                            this.cancel();
                            return;
                        }
                    }
                } catch (e) {
                    this.cancel();
                    return;
                }

                ext.elm.iframeBody.removeClass($.cl.drag.isDragged);
                ext.elm.iframeBody.find("li." + $.cl.drag.dragHover).removeClass($.cl.drag.dragHover);

                $.delay().then(() => {
                    const boundClientRect = entryElm[0].getBoundingClientRect();

                    draggedElm.css({
                        top: boundClientRect.top + "px",
                        left: boundClientRect.left + "px"
                    });

                    return $.delay(200);
                }).then(() => {
                    entryElm.removeClass($.cl.drag.isDragged);
                    dragInitialElm.remove();
                    draggedElm.remove();

                    return $.delay(300);
                }).then(() => {
                    ext.helper.ball.removeSidebarHoverClass();
                });
            }
        };

        /**
         * Clears the directory open timeout
         *
         * @param {jsu} checkElm
         */
        const clearDirOpenTimeout = (checkElm = null) => {
            if (dirOpenTimeout !== null && (checkElm === null || dirOpenTimeout.id !== checkElm.attr($.attr.id))) {
                dirOpenTimeout.elm.removeClass($.cl.drag.dragHover);
                clearTimeout(dirOpenTimeout.instance);
                dirOpenTimeout = null;
            }
        };

        /**
         * Drag an element (bookmark or directory or something external (a link, an image, ...))
         *
         * @param {string} eventType
         * @param {int} x
         * @param {int} y
         */
        const dragmove = (eventType, x, y) => {
            let draggedElm = null;
            let bookmarkElm = null;
            let topVal = 0;
            let leftVal = 0;

            if (eventType === "dragover") { // dragging anything (e.g. a link, an image, ...)
                topVal = y - 20;
                leftVal = x;
                if (topVal === oldTopVal) {
                    return false;
                }
                oldTopVal = topVal;
                ext.elm.bookmarkBox.all.find("li." + $.cl.drag.isDragged).remove();
                bookmarkElm = $("<li></li>").html("<a>&nbsp;</a>").addClass($.cl.drag.isDragged);
            } else { // dragging bookmark or directory
                draggedElm = ext.elm.iframeBody.children("a." + $.cl.drag.helper);
                const startPos = draggedElm.data("startPos");
                topVal = y - startPos.top;
                leftVal = x - startPos.left;

                draggedElm.css({
                    top: topVal + "px",
                    left: leftVal + "px"
                });

                bookmarkElm = draggedElm.data("elm");
            }

            ext.elm.iframeBody.find("li." + $.cl.drag.dragHover).removeClass($.cl.drag.dragHover);

            if (isDraggedElementOutside(draggedElm || leftVal)) { // dragged outside the sidebar -> mouseup will cancel
                clearDirOpenTimeout();
                ext.elm.iframeBody.addClass($.cl.drag.cancel);
                return false;
            } else {
                ext.elm.iframeBody.removeClass($.cl.drag.cancel);
            }

            const type = getDragType(bookmarkElm.children("a"));
            let newAboveElm = {elm: null};
            let elmLists = [
                ext.elm.bookmarkBox.all.find("a." + $.cl.sidebar.dirOpened + " + ul > li"),
                ext.elm.bookmarkBox.all.find("> ul > li > a." + $.cl.sidebar.dirOpened).parent("li")
            ];

            elmLists.some((list) => {
                list && list.forEach((node) => { // determine the element which is above the current drag position
                    const elmObj = $(node);

                    // A folder contains its own open children. Dropping onto one of
                    // them inserts the folder into itself and leaves a second copy behind.
                    if (bookmarkElm[0] && !bookmarkElm[0].contains(elmObj[0]) && !elmObj.hasClass($.cl.drag.dragInitial)) {
                        const boundClientRect = elmObj[0].getBoundingClientRect();
                        const diff = topVal - boundClientRect.top;

                        if (boundClientRect.top > topVal) {
                            return false;
                        } else if (newAboveElm.elm === null || newAboveElm.diff > diff) {
                            const isDir = elmObj.children("a").eq(0).hasClass($.cl.sidebar.bookmarkDir);

                            if (sort.name !== "default" && !isDir) { // every other sorting than "custom" is only folder-based -> determine parent folder of the element
                                newAboveElm = {elm: elmObj.parents("li").eq(0), height: elmObj[0].offsetHeight, diff: diff};
                            } else {
                                newAboveElm = {elm: elmObj, height: elmObj[0].offsetHeight, diff: diff};
                            }
                        }
                    }
                });
            });

            if (newAboveElm.elm && newAboveElm.elm !== oldAboveElm) {
                oldAboveElm = newAboveElm.elm;
                const newAboveLink = newAboveElm.elm.children("a").eq(0);
                const parentElm = newAboveElm.elm.parents("li").eq(0);
                const isTopLevel = !parentElm || parentElm.length() === 0;
                const aboveIsDir = newAboveLink.hasClass($.cl.sidebar.bookmarkDir);
                const hoverPosPercentage = newAboveElm.diff / newAboveElm.height * 100;

                clearDirOpenTimeout(newAboveLink);

                if (newAboveElm.elm.nextAll("li:not(." + $.cl.drag.isDragged + "):not(." + $.cl.drag.dragInitial + ")").length() === 0 && hoverPosPercentage > 80) { // drag position is below the last element of a directory -> placeholder under the current directory
                    if (draggedElm && parentElm && parentElm.length() > 0 && parentElm.parents("ul")[0] !== ext.elm.bookmarkBox.all.find("> ul")[0]) {
                        setDataElement(draggedElm, placeEntry(bookmarkElm, "after", parentElm));
                    }
                } else if (aboveIsDir && (hoverPosPercentage < 60 || sort.name !== "default")) { // directory is hovered
                    if (newAboveLink.hasClass($.cl.sidebar.dirOpened)) { // opened directory
                        setDataElement(draggedElm, placeEntry(bookmarkElm, "prepend", newAboveLink.next("ul")));
                    } else if (!newAboveLink.hasClass($.cl.sidebar.dirAnimated)) { // closed directory
                        if (dirOpenTimeout === null) {
                            dirOpenTimeout = {
                                id: newAboveLink.attr($.attr.id),
                                elm: newAboveLink.addClass($.cl.drag.dragHover)
                            };

                            const dndOpenDirDelayRaw = ext.helper.dao.getData("b/dndOpenDirDelay");
                            dirOpenTimeout.instance = setTimeout(() => { // open closed directory after short delay -> possibility for user to cancel timeout
                                ext.helper.list.toggleBookmarkDir(newAboveLink);
                            }, +dndOpenDirDelayRaw * 1000);
                        }
                    } else if (newAboveLink.next("ul").length() === 0) { // empty directory
                        newAboveLink.addClass($.cl.sidebar.dirOpened);
                        $("<ul></ul>").insertAfter(newAboveLink);
                    }
                } else if (!isTopLevel || type === "pinned") { // drag position is below a bookmark
                    clearDirOpenTimeout();
                    setDataElement(draggedElm, placeEntry(bookmarkElm, "after", newAboveElm.elm));
                }
            }
        };

        /**
         * Moves the dragged row only when the destination actually changes.
         * insertAfter/prependTo clone the node, so repeating the same move
         * leaves the previous copy in the list.
         *
         * @param {jsu} entry
         * @param {string} where
         * @param {jsu} target
         * @returns {jsu}
         */
        const placeEntry = (entry, where, target) => {
            const node = entry && entry[0];
            const dest = target && target[0];

            if (!node || !dest || node === dest || node.contains(dest)) {
                return entry;
            }

            if (where === "after") {
                if (node.previousElementSibling === dest) {
                    return entry;
                }
                return entry.insertAfter(target);
            }

            if (dest.firstElementChild === node) {
                return entry;
            }

            return entry.prependTo(target);
        };

        const setDataElement = (draggedElm, dataElm) => {
            if (!dataElm || !dataElm[0]) {
                return;
            }
            if (draggedElm) {
                draggedElm.data("elm", dataElm);
            }
            dataElm.parents("li").eq(0).addClass($.cl.drag.dragHover);
        };

        /**
         * Initializes the eventhandlers for the dragDrop functionality of the bookmarks
         *
         * @returns {Promise}
         */
        const initEvents = async () => {

            ext.elm.bookmarkBox.all.on("mousedown", "span." + $.cl.drag.trigger, (e) => { // drag start
                
                ext.helper.contextmenu.close();//关闭contextmenu
                ext.helper.ball.addSidebarHoverClass();
                
                dragstart(e.currentTarget, e.pageX, e.pageY);
                dragmove(e.type, e.pageX, e.pageY);
            });
            
            ext.elm.iframeBody.on("mousemove dragover", (e) => { // drag move
                
                e.preventDefault();
                e.stopPropagation();
                
                if (ext.elm.iframeBody.hasClass($.cl.drag.isDragged) && e.which === 1) {
                    dragmove(e.type, e.pageX, e.pageY);
                }
            });

            ext.elm.iframeBody.on("mouseup", (e) => { // drag end
                
                edgeScroll.posY = null;
                
                e.preventDefault();
                e.stopPropagation();
                
                if (ext.elm.iframeBody.hasClass($.cl.drag.isDragged)) { // bookmark has been dragged

                    if (e.which === 1) { // only perform rearrangement of elements when the left mouse button is released
                        dragend();
                    } else { // cancel drag
                        $.delay(0).then(() => {
                            this.cancel();
                        });
                    }
                }
            });

            ext.elm.iframeBody.on("wheel", (e) => { // scroll the bookmark list
                if (ext.elm.iframeBody.hasClass($.cl.drag.isDragged)) {
                    e.stopPropagation();
                    const scrollPos = ext.elm.bookmarkBox.all[0].scrollTop;
                    ext.helper.scroll.setScrollPos(ext.elm.bookmarkBox.all, scrollPos - e.wheelDelta, 300);
                }
            }, {passive: true});

            ext.elm.iframeBody.on("contextmenu", "a." + $.cl.drag.helper, (e) => { // disable right click or the drag handle
                e.preventDefault();
                e.stopPropagation();
            });
        };
    };

})(jsu);
