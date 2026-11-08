/** JSDOM has no layout. Give visibility-sensitive fixtures a concrete visible box. */
export function installVisibleLayout(window) {
    const prototype = window.HTMLElement.prototype;
    const bounds = Object.getOwnPropertyDescriptor(prototype,"getBoundingClientRect"), visibility = Object.getOwnPropertyDescriptor(window.document,"visibilityState");
    Object.defineProperty(prototype,"getBoundingClientRect",{configurable:true,writable:true,value:() => new window.DOMRect(10,10,200,30)});
    Object.defineProperty(window.document,"visibilityState",{configurable:true,get:() => "visible"});
    return () => {
        if (bounds) Object.defineProperty(prototype,"getBoundingClientRect",bounds); else delete prototype.getBoundingClientRect;
        if (visibility) Object.defineProperty(window.document,"visibilityState",visibility); else delete window.document.visibilityState;
    };
}
