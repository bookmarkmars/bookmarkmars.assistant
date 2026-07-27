($ => {
    "use strict";

    /**
     * @param {object} ext
     * @constructor
     */
    $.I18nHelper = function (ext) {

		const aligns={
			'en_US':'en',
			'en_GB':'en',
			'en_AU':'en',
			'en_CA':'en',
			'pt_BR':'pt',
			'pt_PT':'pt',
			'es_MX':'mx',
			'es_CL':'cl',
			'es_419':'es',
			'es_ES':'es',
			'zh':'zh_CN',
			'zh_Hans':'zh_CN',
			'zh_SG':'zh_CN',
			'zh_Hant':'zh_TW',
			'zh_HK':'zh_TW',
			'zh_MO':'zh_TW',
			'hi_IN':'hi',
			'id_ID':'id'
		}
		
        let language = null;
        let langVars = {};
        let dir = null;

        /**
         * Initialises the language file
         *
         * @returns {Promise}
         */
        this.init = () => {
            return new Promise((resolve) => {
                ext.helper.dao.call("langvars").then((obj) => {
                    language = obj.language;
                    langVars = obj.vars;
                    dir = obj.dir;
                    if (typeof document !== "undefined" && document.documentElement) {
                        document.documentElement.setAttribute("dir", dir || "ltr");
                        document.documentElement.setAttribute("lang", (language || "").replace(/_/g, "-"));
                    }
                    resolve();
                });
            });
        };

        /**
         * Returns the language which is used for the language variables
         *
         * @returns {string}
         */
        this.getLanguage = () => {
            return language;
        };

        /**
         * Returns whether the direction of the current language is right-to-left
         *
         * @returns {string}
         */
        this.isRtl = () => {
            return dir === "rtl";
        };

        /**
         * Returns the UI language of the browser in the format "de_DE" or "de"
         *
         * @returns {string}
         */
        this.getUILanguage = () => {
           let lang=$.api.i18n.getUILanguage();
           return aligns[lang.replace(/-/g, "_")]?aligns[lang.replace(/-/g, "_")]:lang.replace(/-/g, "_"); 
        };

        /**
         * Returns the default language of the extension
         *
         * @returns {string}
         */
        this.getDefaultLanguage = () => {
            return  $.opts.manifest.default_locale;
        };

        /**
         * Sorts the Collator for comparing strings
         *
         * @returns {Intl.Collator}
         */
        this.getLocaleSortCollator = () => {

			//base，Only strings that differ in base letters compare as unequal. Examples: a ≠ b, a = á, a = A.
			try{
				return new Intl.Collator($.api.i18n.getUILanguage(),{ sensitivity: 'base' });//当前语言
			}catch(err){
				return new Intl.Collator("zh-CN",{ sensitivity: 'base' });//简体中文
			}
        };

        /**
         * Returns the given date in local specific format
         *
         * @param dateObj
         * @returns {string}
         */
        this.getLocaleDate = (dateObj) => {
            if (typeof dateObj === "number") {
                dateObj = new Date(dateObj);
            }
            
            return dateObj.toLocaleDateString([this.getUILanguage(), this.getDefaultLanguage()], {
                year: "numeric",
                month: "2-digit",
                day: "2-digit"
            });
        };

        /**
         * Parses all language vars in the given html context
         *
         * @param context
         */
        this.parseHtml = (context) => {
        	
        	$(context).find("[" +  $.attr.hidden + "]").forEach((elm) => {
        	 	
        	 	const hidden = $(elm).attr($.attr.hidden);
                
                //影藏部分组件，为不支持new tab的浏览器
                if(!!hidden && hidden.split("|").filter(x => !!x).some(e => $.vName.indexOf(e)!==-1)){
                	$(elm).remove();
                }
        	});
        	
        	//使用overrides属性，全部不再做用户授权
    		if(!!$.opts.manifest.chrome_url_overrides){
    			
    			//无需美化页授权
    			$(context).find("div[" + $.attr.name + "='function'] .auth-newtab").remove();
    			
    			//影藏grant
    			$(context).find("section[" + $.attr.name + "='newtab'] > .grant").remove();
    			$(context).find("section[" + $.attr.name + "='newtab'] > .finish").css("display","block");
    		}

            $(context).find("[" +  $.attr.i18n + "]").forEach((elm) => {
                
                let msg = null;
                const val = $(elm).attr( $.attr.i18n);
                const stop = $(elm).attr($.attr.stop);
                const overrides = $(elm).attr($.attr.overrides);

                if (val) {
                    let replaces = [];
                    const replacesRaw = $(elm).attr( $.attr.i18nReplaces);
                    if (replacesRaw) {
                        replaces = replacesRaw.split(",");
                    }
                    msg = this.get(val, replaces);
                }
                
                //兼容部分不支持new tab的浏览器 或者 强制要求new tab overrides的浏览器
                if(
                	!!stop && stop.split("|").filter(x => !!x).some(e => $.vName.indexOf(e)!==-1)||
                	(
                		overrides &&
                		!!$.opts.manifest.chrome_url_overrides
                	)
                ){
                	msg = this.get($(elm).attr( $.attr.i18nReplaces));
                	$(elm).removeClass("next-step").addClass($.cl.onboarding.finish);
                }
                
                if (msg) {
                    $(elm).removeAttr($.attr.i18n);
                    $(elm).removeAttr($.attr.i18nReplaces);
                    $(elm).removeAttr($.attr.stop);
                    $(elm).removeAttr($.attr.hidden);//delete the mark
                    $(elm).html(msg);
                } else {
                    $(elm).remove();
                }
            });
        };

        /**
         * Returns the translated string matching the given message
         *
         * @param {string} msg
         * @param {Array} replaces
         * @param {boolean} encoded
         * @returns {string}
         */
        this.get = (msg, replaces = [], encoded = false) => {
            let ret = "";
            const langVar = langVars[msg];
            
            if (langVar && langVar.message) {
                ret = langVar.message;

                ret = ret.replace(/\{browserName\}/gi, $.browserName);

                if (replaces && replaces.length > 0) {
                    replaces.forEach((replace, i) => {
                        ret = ret.replace(new RegExp("\\{" + (i + 1) + "\\}"), replace);
                    });
                }

                ret = ret.replace(/\[b\](.*)\[\/b\]/, "<strong>$1</strong>");
                ret = ret.replace(/\[a\](.*)\[\/a\]/, "<a href='#'>$1</a>");
                ret = ret.replace(/\[em\](.*)\[\/em\]/, "<em>$1</em>");
            }

            if (encoded) {
                ret = ret.replace(/'/g, "&#x27;");
            }
            return ret;
        };
    };

})(jsu);