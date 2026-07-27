($ => {
    "use strict";

    /**
     * @param {object} ext
     * @constructor
     */
    $.BookmarkHelper = function (ext) {

        /**
         * 删除书签
         *
         * @param {int} id
         * @returns {Promise}
         */
        this.removeEntry = (opts) => {
            return new Promise((resolve) => {
                const data = ext.helper.entry.getDataById(opts.data.id);
                let name="dir";
                if(opts.type==='separator'){
                	name="separator";
                }
                else{
                	if(data && data.url){
                		name="bookmark";
                	}else{
                		name="dir";
                	}
                }
                ext.helper.confirm.create("delete", ext.helper.i18n.get("contextmenu_delete_"+name), data);
                resolve();
            });
        };

        /**
         * 更新数据
         *
         * @param {object} data
         */
        this.editEntry = (data) => {
            return new Promise((resolve) => {
                const additionalInfoList = ext.helper.dao.getData("u/additionalInfo");
                additionalInfoList[data.id] = {
                    desc: data.additionalInfo
                };

                Promise.all([
                    ext.helper.dao.call("updateBookmark", {
                        id: data.id,
                        title: data.title,
                        url: data.url,
                        preventReload: true
                    }),
                    ext.helper.dao.setData({"u/additionalInfo": additionalInfoList})
                ]).then(resolve);
            });
        };

        /**
         * 获取目录中书签的下标
         *
         * @param bookmarkId
         * @param dirId
         * @returns {Promise<number>}
         */
        this.getBookmarkIndexInDirectory = async (bookmarkId, dirId) => {
            const response = await ext.helper.dao.call("bookmarks", {id: dirId});
            if (response.bookmarks && response.bookmarks[0] && response.bookmarks[0].children) { // children are existing
                const sort = ext.helper.dao.getData("u/sort");
                const bookmarkData = ext.helper.entry.getDataById(bookmarkId);
                const entries = response.bookmarks[0].children;

                if (dirId !== bookmarkData.parentId) {
                    entries.push(bookmarkData);
                    bookmarkData.parentId = dirId;
                }

                ext.helper.util.sortEntries(entries, sort);
                const index = entries.findIndex((entry) => {
                    return bookmarkId === entry.id;
                });

                return index;
            } else {
                return -1;
            }
        };
        
        /**
         * Deletes the given entry
         *
         * @param {number} id
         * @param {boolean} preventReload
         * @returns {Promise}
         */
        this.performDeletion = (id, preventReload = false) => {
            return new Promise((resolve) => {
                ext.helper.dao.call("deleteBookmark", {
                    id: id,
                    preventReload: preventReload
                }).then(() => {
                    resolve();
                });
            });
        };
        
        /**
         * Pins the given bookmarks
         *
         * @param {object} data
         * @returns {Promise}
         */
        this.pinEntry = (data) => {
            return new Promise((resolve) => {
                const entries = ext.helper.dao.getData("u/pinnedEntries");
                let idx = -1;
                Object.values(entries).forEach((entry) => { // determine the current highest index
                    idx = Math.max(idx, entry.index);
                });

                entries[data.id] = {index: idx + 1}; // add new entry at the last position

                savePinnedEntries(entries).then(resolve);
            });
        };
        
        /**
         * Unpins the given bookmarks
         *
         * @param {object} data
         * @returns {Promise}
         */
        this.unpinEntry = (data) => {
            return new Promise((resolve) => {
                const entries = ext.helper.dao.getData("u/pinnedEntries");
                delete entries[data.id];

                savePinnedEntries(entries).then(resolve);
            });
        };
        
        /**
         * Changes the index of the given entry,
         * iterates over the other entries and adapts their index if needed
         *
         * @returns {Promise}
         */
        this.reorderPinnedEntries = (opts) => {
            return new Promise((resolve) => {
                const entries = ext.helper.dao.getData("u/pinnedEntries");

                let newIndex = 0;
                if (opts.prevId) {
                    const prevInfo = ext.helper.entry.getDataById(opts.prevId);
                    newIndex = prevInfo.pinnedIndex + 1;
                }

                Object.keys(entries).forEach((id) => { // iterate all entries
                    if (+id === +opts.id) { // changed element -> set index
                        entries[id].index = newIndex;
                        ext.helper.entry.addData(id, "pinnedIndex", newIndex);
                    } else if (entries[id].index >= newIndex) { // index of this entry is higher then the index of the changed entry -> increase
                        entries[id].index++;
                        ext.helper.entry.addData(id, "pinnedIndex", entries[id].index);
                    }
                });

                savePinnedEntries(entries).then(resolve);
            });
        };
        
        /**
         * Saves the given entries in the local storage,
         * Triggers an update of the entries object
         *
         * @param {object} entries
         * @returns {Promise}
         */
        const savePinnedEntries = (entries) => {
            return new Promise((resolve) => {
                Promise.all([
                    ext.helper.dao.call("removeCache", {name: "htmlList"}),
                    ext.helper.dao.setData({"u/pinnedEntries": entries})
                ]).then(resolve);
            });
        };
        
    };
})(jsu);