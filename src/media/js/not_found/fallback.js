($ => {
    "use strict";

    $.FallbackHelper = function (n) {

        /**
         *
         * @returns {Promise}
         */
        this.init = async () => {
            
            const url = new URL(location.href);
            const typeParam = url.searchParams.get("cat");

            if (typeParam !== null) {
            	
                n.elm.fallbackInfo.addClass($.cl.active);

                initDescription(typeParam);
                initEvents(typeParam);
            }
        };
        

        /**
         * 事件处理
         *
         * @param {string} type
         */
        const initEvents = (type) => {
            n.elm.fallbackInfo.children("a").on("click", (e) => {
                e.preventDefault();
                
                n.helper.util.setAsNewtab(true, $.api.runtime.getURL("html/new_tab.html"));
                
            });
        };

        /**
         * Initialises the description texts
         *
         * @param {string} type
         */
        const initDescription = (opts) => {
           
           const texts = {
                headline: "not_found_headline",
                desc: "not_found_fallback_desc",
                link: "more_link",
                suggestion:"friendly_suggestion"
            };
            
            $("<h2></h2>").text(n.helper.i18n.get(texts.headline)).appendTo(n.elm.fallbackInfo);
            $("<p></p>").text(n.helper.i18n.get(texts.desc)).appendTo(n.elm.fallbackInfo);

            const nosug=n.elm.fallbackInfo.attr("data-nosug");
            if(nosug==="undefined" || nosug===null || !nosug.split("|").filter(x => !!x).some(e => $.vName.indexOf(e)!==-1)){
            	$("<a></a>").text(n.helper.i18n.get(texts.suggestion)).appendTo(n.elm.fallbackInfo);
            }
        };
    };

})(jsu);