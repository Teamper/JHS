const DEFAULT_JAVDB_PLUGINS = [
    Ie, Be, le, de, Ce,
    xe, Ae, fe, pe, ue,
    Ee, Ue, Oe, Q, $e,
    He, ye, ce, ae, ke,
    he, be, Ze, ze,
    Re, Ve, Se, Xe, pt,
    et, mt, StatsPlugin
];

const DEFAULT_JAVBUS_PLUGINS = [
    Ie, Ce, Ae,
    xe, Be, Ee, Fe, Ue,
    Qe, we, ye, $e,
    ke, ce, je, Re, Ve,
    be, Ze, Se, et, StatsPlugin
];

const DEFAULT_SHARED_PLUGIN_RULES = [
    {
        shouldRegister: hostname => r || l || hostname.includes("123pan.com"),
        plugins: [ OneTwoThreeOfflinePlugin ]
    },
    {
        shouldRegister: hostname => hostname.includes("javtrailers"),
        plugins: [ oe ]
    },
    {
        shouldRegister: hostname => hostname.includes("subtitlecat"),
        plugins: [ re ]
    }
];

function registerPluginGroup(pluginManager, plugins) {
    plugins.forEach((pluginClass => pluginManager.register(pluginClass)));
}

function registerSitePlugins(pluginManager, hostname = window.location.hostname) {
    DEFAULT_SHARED_PLUGIN_RULES.forEach((rule => {
        rule.shouldRegister(hostname) && registerPluginGroup(pluginManager, rule.plugins);
    }));
    r && registerPluginGroup(pluginManager, DEFAULT_JAVDB_PLUGINS);
    l && registerPluginGroup(pluginManager, DEFAULT_JAVBUS_PLUGINS);
}
