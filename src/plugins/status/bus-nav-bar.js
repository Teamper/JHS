import { BasePlugin } from "../../core/plugin-manager.js";

export class BusNavBarPlugin extends BasePlugin {
    getName() {
        return "BusNavBarPlugin";
    }
    handle() {
        $("#navbar > div > div > span").append('\n            <button class="jhs-btn btn btn-default jhs-layout-638cb2c9" id="search-img-btn">识图</button>\n       '),
        $("#search-img-btn").on("click", (() => {
            this.getDependency("SearchByImagePlugin").open();
        }));
    }
}
