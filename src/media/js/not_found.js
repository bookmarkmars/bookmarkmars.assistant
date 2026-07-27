($ => {
    "use strict";

    const NotFound = function () {

        this.elm = {
            body: $("body"),
            title: $("head > title"),
            content: $("section#content"),
            fallbackInfo: $("div#fallback"),
        };

        /**
         * Constructor
         */
        this.run = () => {
            
            initHelpers();

            const loader = this.helper.template.loading().appendTo(this.elm.body);
            this.elm.body.addClass($.cl.initLoading);

            this.helper.dao.init()
            .then(() => {
                
                this.helper.fontAdd.init();
                this.helper.fontAdd.addStylesheet($(document));//添加字体

				//语言+css
                return Promise.all([
                    this.helper.i18n.init(),
                    this.helper.styleHelper.addStylesheets(["not_found"], $(document))
                ]);
            }).then(() => {
            
                this.helper.i18n.parseHtml(document);

                return Promise.all(
                    [
                        this.helper.fallback.init(),
                        initEvents()
                    ]
                );
            }).then(() => {
                loader.remove();
                this.elm.body.removeClass([$.cl.building, $.cl.initLoading]);
            });
        };

      
        /*
         * ################################
         * PRIVATE
         * ################################
         */

        /**
         * Initialises the helper objects
         */
        const initHelpers = () => {
            this.helper = {
                dao: new $.DaoHelper(this),
                template: new $.TemplateHelper(this),
                i18n: new $.I18nHelper(this),
                fontAdd: new $.FontAddHelper(this),
                styleHelper: new $.StyleHelper(this),
                fallback: new $.FallbackHelper(this),
                util:new $.UtilHelper(this),
            };
        };

        /**
         * Initialises the eventhandler
         */
        const initEvents = async () => {
            
        };
    };

    new NotFound().run();
})(jsu);