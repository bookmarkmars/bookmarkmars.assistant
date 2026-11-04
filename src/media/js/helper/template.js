($ => {
    "use strict";

    /**
     * @param {object} ext
     * @constructor
     */
    $.TemplateHelper = function (ext) {

        /**
         * Returns the html for the loading indicator
         *
         * @returns {jsu}
         */
        this.loading = () => {
            return $('<svg t="1661829219371" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="4255" width="36" height="36"><path d="M144.205 202.496a136.678 136.678 0 1 0 273.357 0 136.678 136.678 0 1 0-273.357 0zM41.728 492.902a119.578 119.578 0 1 0 239.155 0 119.578 119.578 0 1 0-239.155 0zM144.23 749.158a102.502 102.502 0 1 0 205.005 0 102.502 102.502 0 1 0-205.005 0zM435.2 861.926a89.6 89.6 0 1 0 179.2 0 89.6 89.6 0 1 0-179.2 0z m289.843-95.666a85.427 85.427 0 1 0 170.855 0 85.427 85.427 0 1 0-170.855 0z m136.704-290.433a68.326 68.326 0 1 0 136.653 0 68.326 68.326 0 1 0-136.653 0zM759.22 219.571a51.251 51.251 0 1 0 102.502 0 51.251 51.251 0 1 0-102.503 0zM512 85.376a34.176 34.176 0 1 0 68.352 0 34.176 34.176 0 1 0-68.352 0z" p-id="4256" fill="#ffffff"></path></svg>').addClass($.cl.loading);
        };

        /**
         * Creates a new overlay and returns the html elements
         *
         * @param {string} type
         * @param {string} title
         * @returns {jsu}
         */
        this.overlay = (type, title,id=null) => {
            const ret = {};

            const shell = ext.elm && ext.elm.shadow ? $(ext.elm.shadow) : "body";
            ret.overlay = $("<iframe></iframe>")
                .attr("id", id!=null?id:$.opts.ids.page.overlay)
                .addClass("notranslate") // 'notranslate' prevents Google translator from translating the content of the overlay
                .appendTo(shell);

            if (ret.overlay[0]) {
                // Same compositing as the sidebar frame, so clicks are delivered to this frame.
                ret.overlay[0].style.transform = "translate3d(0,0,0)";
            }

            ext.helper.styleHelper.addStylesheets(["popup"], ret.overlay,id!=null?true:false);

            const iframeBody = ret.overlay.find("body");

            ret.modal = $("<div></div>")
                .attr($.attr.type, type)
                .addClass($.cl.confirm.modal)
                .appendTo(iframeBody);

            const header = $("<header></header>").appendTo(ret.modal);
            $("<h1></h1>").text(title).appendTo(header);
            $("<a></a>").addClass($.cl.close).appendTo(header);

            ret.buttonWrapper = $("<menu></menu>").addClass($.cl.confirm.buttonWrapper).appendTo(ret.modal);
            $("<a></a>")
                .addClass($.cl.close)
                .appendTo(ret.buttonWrapper);

            ret.overlay[0].focus();

            $.delay(100).then(() => {
                ret.modal.addClass($.cl.visible);
                ret.overlay.addClass($.cl.visible);
            });

            return ret;
        };
    };

})(jsu);