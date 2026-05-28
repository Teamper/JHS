const G = new BroadcastChannel(channel-refresh);

window.refresh = function() {
    G.postMessage({
        type: refresh
    });
};

window.cleanCache_filter_actor_actress_car_list = function() {
    G.postMessage({
        type: cleanCache_filter_actor_actress_car_list
    });
};

window.clean_cacheSettingObj = function() {
    G.postMessage({
        type: clean_cacheSettingObj
    });
};
