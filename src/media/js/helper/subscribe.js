($ => {
    "use strict";

    /**
     * In-page "Pro feature" dialog shared by the manage page and the new tab page
     *
     * @param {object} ext
     * @constructor
     */
    $.SubscribeHelper = function (ext) {

        const PRO_FEATURES = ["sync", "backupExtra", "autoSync", "wallpaper", "linkCheck", "exportHtml"];
        const ICON_CROWN = "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M3 7l4.5 4L12 4l4.5 7L21 7l-2 11H5L3 7z\" fill=\"currentColor\"/><rect x=\"5\" y=\"19.5\" width=\"14\" height=\"2\" rx=\"1\" fill=\"currentColor\"/></svg>";
        const ICON_CHECK = "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M9.5 16.2L5.3 12l-1.4 1.4 5.6 5.6 11-11-1.4-1.4z\" fill=\"currentColor\"/></svg>";

        const i18n = (key, args) => ext.helper.i18n.get(key, args || []);
        const el = (tag, cls, text) => {
            const node = document.createElement(tag);
            if (cls) { node.className = cls; }
            if (text !== undefined) { node.textContent = text; }
            return node;
        };

        /**
         * Shows the dialog; "View plans" opens the given url in a new tab
         *
         * @param {string|null} feature one of PRO_FEATURES, highlighted in the list
         * @param {string} href
         */
        this.show = (feature, href) => {
            if (document.querySelector("div.subscribe-modal")) {
                return;
            }

            const modal = el("div", "subscribe-modal");
            const card = el("div", "subscribe-card");
            card.setAttribute("role", "dialog");
            card.setAttribute("aria-modal", "true");

            const close = el("a", "subscribe-close");
            close.setAttribute("aria-label", i18n("subscribe_later"));
            close.innerHTML = "&times;";

            const hero = el("div", "subscribe-hero");
            const crown = el("span", "subscribe-crown");
            crown.innerHTML = ICON_CROWN;
            hero.append(crown, el("span", "subscribe-badge", "PRO"), el("h3", "", i18n("subscribe_title")));
            if (PRO_FEATURES.indexOf(feature) !== -1) {
                hero.append(el("p", "", i18n("subscribe_locked", [i18n("subscribe_f_" + feature)])));
            }

            const body = el("div", "subscribe-body");
            body.append(el("p", "subscribe-desc", i18n("subscribe_desc")));
            const list = el("ul", "subscribe-features");
            PRO_FEATURES.forEach((f) => {
                const li = el("li", f === feature ? "current" : "");
                const check = el("i");
                check.innerHTML = ICON_CHECK;
                li.append(check, el("span", "", i18n("subscribe_f_" + f)));
                list.append(li);
            });
            body.append(list);

            const actions = el("div", "subscribe-actions");
            const later = el("button", "secondary", i18n("subscribe_later"));
            const go = el("button", "primary", i18n("subscribe_view_plans"));
            actions.append(later, go);
            body.append(actions);

            card.append(close, hero, body);
            modal.append(card);
            document.body.append(modal);

            const onKey = (e) => {
                if (e.key === "Escape") { dismiss(); }
            };
            const dismiss = () => {
                document.removeEventListener("keydown", onKey);
                modal.classList.remove("visible");
                setTimeout(() => modal.remove(), 250);
            };
            modal.addEventListener("click", (e) => {
                if (e.target === modal) { dismiss(); }
            });
            close.addEventListener("click", dismiss);
            later.addEventListener("click", dismiss);
            go.addEventListener("click", () => {
                window.open(href, "_blank");
                dismiss();
            });
            document.addEventListener("keydown", onKey);

            requestAnimationFrame(() => {
                modal.classList.add("visible");
                go.focus();
            });
        };
    };

})(jsu);
