($ => {
    "use strict";

    $.LanguageHelper = function (b) {

        const allLanguages = {
            en: "English",
            es: "Español",
            fr: "Français",
            pt: "Português",
            ru: "Русский",
            ja: "日本語",
            de: "Deutsch",
            ko: "한국어",
            it: "Italiano",
            id: "Bahasa Indonesia",
            tr: "Türkçe",
            pl: "Polski",
            uk: "Українська",
            nl: "Nederlands",
            vi: "Tiếng Việt",
            th: "ไทย",
            ar: "العربية",
            cl: "Español (Chile)",
            he: "עברית",
            hi: "हिन्दी",
            mx: "Español (México)",
            zh_CN: "中文(简体)",
            zh_TW: "中文(繁體)",
        };

        const rtlLangs = ["ar", "fa", "he"];
        // Map browser / regional codes to our locale folders
        const aliasLangs = {
            en_US: "en",
            en_GB: "en",
            en_AU: "en",
            en_CA: "en",
            pt_PT: "pt",
            pt_BR: "pt",
            es_MX: "mx",
            es_CL: "cl",
            es_419: "es",
            es_ES: "es",
            es_AR: "es",
            zh: "zh_CN",
            zh_Hans: "zh_CN",
            zh_CN: "zh_CN",
            zh_SG: "zh_CN",
            zh_Hant: "zh_TW",
            zh_TW: "zh_TW",
            zh_HK: "zh_TW",
            zh_MO: "zh_TW",
            hi_IN: "hi",
            id_ID: "id",
            nb: "en",
            nn: "en",
            no: "en",
        };
        let language = null;
        let langVars = {};
        let isRtl = false;

        /**
         * Normalise a browser / stored language code to our locale folder name when possible
         *
         * @param {string} code
         * @returns {string|null}
         */
        const normalizeLangCode = (code) => {
            if (!code || code === "default") {
                return null;
            }
            let lang = String(code).replace(/-/g, "_");
            if (aliasLangs[lang]) {
                lang = aliasLangs[lang];
            }
            return lang;
        };

        /**
         * Resolve browser UI language (sync getUILanguage, then accept-languages)
         *
         * @returns {Promise<string|null>}
         */
        const resolveBrowserLanguage = () => {
            return new Promise((resolve) => {
                try {
                    const ui = $.api.i18n.getUILanguage();
                    if (ui) {
                        resolve(normalizeLangCode(ui));
                        return;
                    }
                } catch (err) {
                    // some browsers may not support getUILanguage
                }

                try {
                    $.api.i18n.getAcceptLanguages((langs) => {
                        if (langs && langs.length) {
                            resolve(normalizeLangCode(langs[0]));
                        } else {
                            resolve(null);
                        }
                    });
                } catch (err) {
                    resolve(null);
                }
            });
        };

        /**
         * Initialises the language file
         *
         * @returns {Promise}
         */
        this.init = () => {
            return new Promise((resolve) => {
            	
            	$.api.storage.sync.get(["language"], (data) => {
            		    
                    const defaultLang = $.opts.manifest.default_locale;
                    let lang = data.language || "default";
                    let fallbackLang = null;

                    const finishInit = (resolvedLang) => {
                        lang = normalizeLangCode(resolvedLang) || defaultLang;
                        fallbackLang = null;

                        //匹配短语言，这个很重要
                        if (lang.indexOf("_") > -1) { // search for a language file with short language code, too (e.g. de_DE -> de)
                            fallbackLang = lang.replace(/_.*$/, "");
                            if (aliasLangs[fallbackLang]) {
                                fallbackLang = aliasLangs[fallbackLang];
                            }
                        }

                        this.getAvailableLanguages().then((obj) => {
                    	
                            const found = [lang, fallbackLang, defaultLang].some((name) => { // check if user language exists, if not fallback to default language
                                if (name !== null && obj && obj.infos && obj.infos[name] && obj.infos[name].available) {
                                    language = name;
                                    isRtl = rtlLangs.indexOf(language) > -1 || rtlLangs.some((r) => language.indexOf(r + "_") === 0);

                                    //取出所有语言
                                    getVars(name, defaultLang).then((data) => { // load language variables from model
                                        if (data && data.langVars) {
                                        
                                            langVars = data.langVars;

                                            Object.keys(allLanguages).forEach((code) => {
                                                const key = "language_" + code.toLowerCase();
                                                if (langVars[key] && langVars[key].message) {
                                                    allLanguages[code] = langVars[key].message;
                                                }
                                            });

                                            resolve();
                                        }
                                    });
                                    return true;
                                }
                                return false;
                            });

                            if (!found) {
                                resolve();
                            }
                        });
                    };

                    if (lang === "default") {
                        resolveBrowserLanguage().then((uiLanguage) => {
                            finishInit(uiLanguage || defaultLang);
                        });
                    } else {
                        finishInit(lang);
                    }
                });
            });
        };

        /**
         * Returns the UI language of the browser in the format "de_DE" or "de"
         *
         * @returns {string}
         */
        this.getUILanguage = () => {
            try{
        		let ret = $.api.i18n.getUILanguage();//部分浏览器这个接口是不能用的，所以try catch
	            ret = normalizeLangCode(ret);
	            return ret;
        	}catch(err){
        		;
        	}
            return null;
        };

        /**
         * Returns the language which is used for the language variables
         *
         * @returns {string}
         */
        this.getLanguage = () => language;

        /**
         *
         * @returns {Promise}
         */
        this.getRtlLanguages = async () => rtlLangs;

        /**
         * Returns the name and the language variables of the user language
         *
         * @returns {Promise}
         */
        this.getLangVars = () => {
            return new Promise((resolve) => {
                resolve({
                    language: language,
                    dir: isRtl ? "rtl" : "ltr",
                    vars: langVars
                });
            });
        };

        /**
         * Returns the information about the all languages
         *
         * @returns {Promise}
         */
        this.getAvailableLanguages = () => {
            return new Promise((resolve) => {
                $.api.storage.local.get(["languageInfos"], (obj) => {
                    const expected = Object.keys(allLanguages).sort().join(",");
                    const cachedKeys = obj && obj.languageInfos && obj.languageInfos.infos
                        ? Object.keys(obj.languageInfos.infos).sort().join(",")
                        : null;
                    const cacheValid = obj && obj.languageInfos
                        && (+new Date() - obj.languageInfos.updated) / 36e5 < 8
                        && cachedKeys === expected;

                    if (cacheValid) { // cached
                       
						//替换下label
                        Object.keys(obj.languageInfos.infos).forEach((lang) => {
                        	obj.languageInfos.infos[lang].label=allLanguages[lang];
                        });
                        
                        resolve({infos: obj.languageInfos.infos});
                        
                    } else { // not cached -> determine available languages
                        
                        const total = Object.keys(allLanguages).length;
                        let loaded = 0;
                        const infos = {};
						

                        Object.keys(allLanguages).forEach((lang) => {
                            infos[lang] = {
                                name: lang,
                                label: allLanguages[lang],
                                available: false
                            };

                            const fetchDone = () => {
                                if (++loaded === total) {
                                    $.api.storage.local.set({
                                        languageInfos: {infos: infos, updated: +new Date()}
                                    });
                                    resolve({infos: infos});
                                }
                            };

							//test whether is available
                            $.fetch($.api.runtime.getURL("_locales/" + lang + "/messages.json"), {method: "HEAD"}).then(() => {
                               infos[lang].available = true;
                               fetchDone();
                            }, fetchDone).catch(err => {});
                        });
                    }
                });
            });
        };

        /**
         * Determines all languages with incomplete translations
         *
         * @returns {Promise}
         */
        this.getIncompleteLanguages = () => {
            return new Promise((resolve) => {
                $.xhr($.opts.website.translation.info).then((xhr) => {
                    const infos = JSON.parse(xhr.responseText);
                    const incompleteLangs = [];

                    if (infos && infos.languages && infos.categories) {
                        let totalVars = 0;
                        Object.values(infos.categories).forEach((cat) => { // determine the total amount of language variables
                            totalVars += cat.total;
                        });

                        infos.languages.forEach((lang) => { // add all languages with incomplete amount of variables to list
                            if (lang.varsAmount < totalVars) {
                                incompleteLangs.push(lang.name);
                            }
                        });
                    }

                    resolve(incompleteLangs);
                });
            });
        };

        /**
         * Returns the language variables for the given language
         *
         * @param {string} lang
         * @param {string} defaultLang
         * @returns {Promise}
         */
        const getVars = (lang, defaultLang = null) => {
            return new Promise((resolve) => {
                if (lang) {
                    const sendXhr = (obj) => {
                        const langVars = obj.langVars;

                        $.fetch($.api.runtime.getURL("_locales/" + lang + "/messages.json")).then((res) => {
                          
                            res.json().then(data=>{
                            	Object.assign(langVars, data); // override all default variables with the one from the language file
                            	resolve({langVars: langVars});
                            })
                        }).catch(err => {});
                    };

                    if (defaultLang && defaultLang !== lang) { // load default language variables first and replace them afterwards with the language specific ones
                        getVars(defaultLang, null).then(sendXhr);
                    } else {
                        sendXhr({langVars: {}});
                    }
                }
            });
        };
    };

})(jsu);
