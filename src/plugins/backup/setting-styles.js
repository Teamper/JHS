/** Generate the settings page CSS based on container config and site type. */
function buildSettingCss(containerWidth, containerColumns, isJavBus, isJavDB) {
    let base;
    if (isJavBus) {
        base = `
                .container-fluid .row{
                    max-width: 1000px !important;
                    min-width: ${containerWidth}%;
                    margin: auto auto;
                }

                .container {
                    max-width: 1000px !important;
                    min-width: 80%;
                    margin: auto auto;
                }

                .masonry {
                    grid-template-columns: repeat(${containerColumns}, minmax(0, 1fr));
                }
            `;
    } else {
        base = `
            section .container{
                max-width: 1000px !important;
                min-width: ${containerWidth}%;
            }
            .movie-list, .movie-list.v{
                grid-template-columns: repeat(${containerColumns}, minmax(0, 1fr));
            }
        `;
    }
    return `
            <style>
                ${base}
                .nav-btn::after {
                    content:none !important;
                }

                #cache-data-display pre {
                    font-family: Consolas, Monaco, 'Andale Mono', monospace;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                    line-height: 1.5;
                    color: #333;
                    border: 1px solid #ddd;
                }

                .cache-item {
                    transition: all 0.2s ease;
                }
                .cache-item:hover {
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    transform: translateY(-2px);
                }

                .tooltip-icon {
                    display: inline-block;
                    width: 16px;
                    height: 16px;
                    line-height: 16px;
                    text-align: center;
                    border-radius: 50%;
                    background-color: #ccc;
                    color: white;
                    font-size: 12px;
                    margin-right: 5px;
                    cursor: help;
                }
                .setting-item {
                    display: flex;
                    align-items: baseline;
                    justify-content: space-between;
                    margin-bottom: 6px;
                    padding: 4px 0;
                }
                .simple-setting .setting-item{
                    align-items:center;
                }
                .setting-label {
                    font-size: 14px;
                    min-width: 180px;
                    font-weight: bold;
                    margin-right: 10px;
                }
                .form-content{
                    max-width: 200px;
                    min-width: 180px;
                }
                .form-content * {
                    width: 100%;
                    padding: 5px;
                    margin-right: 10px;
                    text-align: left;
                }

                .keyword-label {
                    display: inline-flex;
                    align-items: center;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 14px;
                    position: relative;
                    margin-left: 8px;
                    margin-bottom: 5px;
                }
                .keyword-remove {
                    margin-left: 6px;
                    cursor: pointer;
                    font-size: 12px;
                    line-height: 1;
                }
                .keyword-input {
                    padding: 6px 12px;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    font-size: 14px;
                    float:right;
                }
                .add-tag-btn {
                    padding: 6px 12px;
                    background-color: #e2e8f0;
                    color: #334155;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                    margin-left: 8px;
                    float:right;
                }
                .add-tag-btn:hover {
                    background-color: #cbd5e1;
                }
                .tag-box {
                    margin-top:15px;
                }


                #saveBtn,#moreBtn,#helpBtn,#clean-all {
                    padding: 8px 20px;
                    background-color: #4CAF50;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 16px;
                    margin-top: 10px;
                }
                #saveBtn:hover {
                    background-color: #45a049;
                }
                #moreBtn {
                    background-color: #5cb85c;
                    color: white;
                }
                #moreBtn:hover {
                    background-color: #4cae4c;
                }
                #helpBtn {
                    background-color: #e67e22;
                    color: white;
                }
                #helpBtn:hover {
                    background-color: #d35400;
                }
                .simple-setting, .mini-simple-setting {
                    display: none;
                    background: rgba(255,255,255,1);
                    position: absolute;
                    top: ${isJavDB ? "35px" : "25px"};
                    right: ${isJavDB ? "-300%" : "0"};
                    z-index: 1000;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                    padding: 0;
                    margin-top: 5px;
                    color: #333;
                }

                .mini-switch {
                  appearance: none;
                  -webkit-appearance: none;
                  width: 40px;
                  height: 20px;
                  background: #e0e0e0;
                  border-radius: 20px;
                  position: relative;
                  cursor: pointer;
                  outline: none;
                }

                .mini-switch:checked {
                  background: #4CAF50;
                }

                .mini-switch::before {
                  content: "";
                  position: absolute;
                  width: 16px;
                  height: 16px;
                  border-radius: 50%;
                  background: white;
                  top: 2px;
                  left: 2px;
                  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                }

                .mini-switch:checked::before {
                  left: calc(100% - 18px);
                }

                .side-menu-item {
                    padding: 12px 12px;
                    cursor: pointer;
                    color: #333;
                    border-left: 3px solid transparent;
                    transition: all 0.2s;
                    display: flex;
                    gap: 5px;
                }

                .side-menu-item .icon {
                     height: 24px;
                     width: 24px;
                }

                .side-menu-item:hover {
                    background-color: #e9e9e9;
                }

                .side-menu-item.active {
                    background-color: #e0e0e0;
                    border-left: 3px solid #5d87c2;
                    font-weight: bold;
                }

                .content-panel {
                    display: none;
                    margin-top:20px;
                    padding: 0 10px 10px 0;
                    height: 100%;
                    overflow-x: hidden;
                    overflow-y: auto;
                }

                .content-panel.active {
                    display: block;
                }

                input[type="checkbox"]:disabled {
                    opacity: 0.6;
                    cursor: default !important;
                }
            </style>
        `;
}

/** Toggle between vertical (cover-fit) and normal (contain) image display modes. */
async function applyImageMode() {
    $("#verticalImgStyle").remove();
    if (await storageManager.getSetting("enableVerticalModel", C) === _) {
        let e = "100% 50% !important";
        window.location.href.includes("/advanced_search?type=100") && (e = "50% 50% !important");
        const t = `
                .cover {
                    min-height: 350px !important;
                    overflow: hidden !important;
                    padding-top: 142% !important;
                }

                .cover img {
                    object-fit: cover !important;
                    object-position: ${e};
                }

                /* bus的 */
                .masonry .movie-box img {
                    min-height: 500px !important;
                    object-fit: cover !important;
                    object-position: top right;
                }
            `;
        $("<style>").attr("id", "verticalImgStyle").text(t).appendTo("head");
    } else {
        const e = `
                .cover {
                    min-height:auto !important;
                    padding-top: 67% !important;
                }
                .cover img {
                    object-fit: contain !important;
                    object-position: 50% 50% !important
                }

                /* bus的 */
                 .masonry .movie-box img {
                    min-height:auto !important;
                    object-fit: contain !important;
                    object-position: top;
                }
            `;
        $("<style>").attr("id", "verticalImgStyle").text(e).appendTo("head");
    }
    l && window.getBeanForSetting("BusImgPlugin").logImageHeightsByRow();
}
