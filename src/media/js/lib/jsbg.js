(() => {
    
    "use strict";

    class anyName {};


    /**
     * Bind jsu to window object
     */
    (() => {
        const obj = s => new anyName(s);

        Object.entries(jsuTools).forEach(([name, func]) => { // append tools
            obj[name] = func;
        });

        self.jsu = obj;
    })();

})();