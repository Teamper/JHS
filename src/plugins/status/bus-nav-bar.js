class Fe extends X {
    getName() {
        return "BusNavBarPlugin";
    }
    handle() {
        $("#navbar > div > div > span").append('\n            <button class="btn btn-default" style="color: #0d9488" id="search-img-btn">识图</button>\n       '),
        $("#search-img-btn").on("click", (() => {
            this.getBean("SearchByImagePlugin").open();
        }));
    }
}
