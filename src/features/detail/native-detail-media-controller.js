// @ts-check
import { LifecycleScope } from "../../core/lifecycle-scope.js";

export const NATIVE_DETAIL_MEDIA_CSS = `
    [data-jhs-native-gallery] { display:grid!important; grid-template-columns:repeat(auto-fill,minmax(min(100%,112px),144px)); justify-content:start; align-content:start; align-items:start; gap:var(--jhs-space-2)!important; padding:var(--jhs-space-3)!important; margin:var(--jhs-space-4) 0; box-sizing:border-box; width:100%; max-width:100%; height:auto!important; min-height:0!important; border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-md); background:var(--jhs-surface); }
    [data-jhs-gallery-wrapper] { display:contents!important; }
    [data-jhs-gallery-item] { display:block!important; position:relative!important; box-sizing:border-box; float:none!important; width:100%!important; max-width:144px!important; height:auto!important; min-height:0!important; aspect-ratio:3/2; margin:0!important; padding:0!important; overflow:hidden; border:0; border-radius:var(--jhs-radius-sm); background:var(--jhs-surface-2); }
    [data-jhs-gallery-item] img { display:block!important; position:static!important; box-sizing:border-box; width:100%!important; max-width:100%!important; height:100%!important; max-height:215px; object-fit:contain!important; margin:0!important; }
    [data-jhs-gallery-item].screen-container { aspect-ratio:auto; max-height:215px; }
    [data-jhs-gallery-item].screen-container img { height:auto!important; }
    .jhs-native-gallery-state { grid-column:1/-1; margin:0; padding:var(--jhs-space-3); color:var(--jhs-text-muted); font:inherit; font-size:var(--jhs-font-size-sm); }
    [data-jhs-recommendation-panel] { margin:var(--jhs-space-4) 0!important; padding:var(--jhs-space-4)!important; border:1px solid var(--jhs-border)!important; border-radius:var(--jhs-radius-md)!important; background:var(--jhs-surface)!important; color:var(--jhs-text); font-family:var(--jhs-font); }
    /* Outrank JavDB's :root[data-theme="dark"] .message-header !important rule only on owned panels. */
    :root [data-jhs-recommendation-panel].jhs-detail-owned-slot > .jhs-panel-header { display:flex!important; min-height:var(--jhs-control-height); align-items:center; gap:var(--jhs-space-3); margin:0!important; padding:0 0 var(--jhs-space-3)!important; border:0!important; border-bottom:1px solid var(--jhs-border)!important; border-radius:0!important; background:var(--jhs-surface)!important; color:var(--jhs-text)!important; font-size:var(--jhs-font-size-lg)!important; font-weight:var(--jhs-font-weight-semibold)!important; line-height:var(--jhs-line-height-ui)!important; }
    [data-jhs-recommendation-panel] .jhs-panel-header :is(h2,h3,p) { margin:0!important; color:inherit!important; font:inherit!important; }
    [data-jhs-recommendation-panel] .message-body { padding:0!important; border:0!important; background:var(--jhs-surface)!important; }
    [data-jhs-recommendation-panel] [data-jhs-native-recommendations] { padding:var(--jhs-space-3) 0 0!important; border:0!important; border-radius:0; }
    [data-jhs-native-recommendations] { display:grid!important; grid-template-columns:repeat(var(--jhs-recommendation-columns,5),minmax(0,1fr))!important; gap:var(--jhs-space-3)!important; padding:var(--jhs-space-3)!important; border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-md); background:var(--jhs-surface); font-family:var(--jhs-font); }
    [data-jhs-native-recommendations] > a.tile-item { display:flex!important; flex-direction:column; gap:var(--jhs-space-2); min-width:0; width:100%!important; height:auto!important; margin:0!important; padding:var(--jhs-space-2)!important; border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-sm); background:var(--jhs-surface-2); color:var(--jhs-text)!important; text-decoration:none; }
    [data-jhs-native-recommendations] > a.tile-item:hover { border-color:var(--jhs-accent); }
    [data-jhs-native-recommendations] > a.tile-item:focus-visible { outline:2px solid var(--jhs-accent); outline-offset:2px; }
    [data-jhs-native-recommendations] > a.tile-item img { display:block!important; width:100%!important; height:auto!important; aspect-ratio:2/3; object-fit:contain; background:var(--jhs-surface); }
    [data-jhs-native-recommendations] > a.tile-item .video-number { color:var(--jhs-text)!important; font-size:var(--jhs-font-size-sm); font-weight:var(--jhs-font-weight-semibold); }
    [data-jhs-native-recommendations] > a.tile-item .video-title { display:-webkit-box!important; height:auto!important; min-height:0!important; color:var(--jhs-text-muted)!important; font-size:var(--jhs-font-size-sm); line-height:var(--jhs-line-height-ui); overflow:hidden; overflow-wrap:anywhere; -webkit-line-clamp:3; -webkit-box-orient:vertical; }

    [data-jhs-native-recommendations] > .item { display:flex!important; flex-direction:column; min-width:0; width:100%!important; max-width:none!important; margin:0!important; padding:var(--jhs-space-2)!important; box-sizing:border-box; border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-sm); background:var(--jhs-surface-2); color:var(--jhs-text)!important; }
    [data-jhs-native-recommendations] > .item > a { display:block; min-width:0; color:var(--jhs-text)!important; text-decoration:none; }
    [data-jhs-native-recommendations] > .item:hover { border-color:var(--jhs-accent); }
    [data-jhs-native-recommendations] > .item a:focus-visible { outline:2px solid var(--jhs-accent); outline-offset:2px; }
    [data-jhs-native-recommendations] > .item .video-title { display:-webkit-box!important; height:auto!important; min-height:0!important; margin-top:var(--jhs-space-2); color:var(--jhs-text-muted)!important; font-size:var(--jhs-font-size-sm); line-height:var(--jhs-line-height-ui); overflow:hidden; overflow-wrap:anywhere; -webkit-line-clamp:3; -webkit-box-orient:vertical; }
    [data-jhs-native-recommendations] > .item .video-title strong { display:block; color:var(--jhs-text)!important; font-weight:var(--jhs-font-weight-semibold); }
    [data-jhs-native-recommendations] > .item :is(.meta,.score) { margin-top:var(--jhs-space-1); color:var(--jhs-text-muted)!important; font-size:var(--jhs-font-size-sm); line-height:var(--jhs-line-height-ui); }

`;

/** Own only native media geometry and feedback, without replacing host nodes. */
export class NativeDetailMediaController {
    /** @param {{hostAdapter:any,scope:import('../../core/lifecycle-scope.js').LifecycleScope,ui?:any}} options */
    constructor(options) {
        this.host = options.hostAdapter;
        this.ui = options.ui;
        this.scope = new LifecycleScope("native-detail-media");
        this.releaseOwner = options.scope.addCleanup(() => this.scope.dispose());
        /** @type {Map<Element,()=>void>} */ this.regions = new Map();
        /** @type {Map<Element,()=>void>} */ this.galleries = new Map();
        /** @type {Set<Element>} */ this.marked = new Set();
        this.scheduled = false;
    }
    start() {
        const root = this.host.locateDetailRoot();
        if (!root) return;
        const scrollRoot = root.ownerDocument.scrollingElement;
        if (scrollRoot && !scrollRoot.classList.contains('jhs-scrollbar')) {
            scrollRoot.classList.add('jhs-scrollbar');
            this.scope.addCleanup(() => scrollRoot.classList.remove('jhs-scrollbar'));
        }
        if (this.ui?.openImageViewer) this.scope.listen(root.ownerDocument, "click", event => this.openImage(/** @type {MouseEvent} */ (event)), true);
        if (this.host.site !== "javdb") return;
        this.scope.observe(root, () => this.schedule(), {childList:true});
        if (root.parentElement) this.scope.observe(root.parentElement, () => this.schedule(), {childList:true});
        this.scope.addCleanup(() => { for(const stop of this.galleries.values()) stop(); for(const stop of this.regions.values()) stop(); for(const node of this.marked) { for(const name of ["data-jhs-native-gallery","data-jhs-gallery-item","data-jhs-gallery-wrapper","data-jhs-native-recommendations","data-jhs-recommendation-panel"]) node.removeAttribute(name); } });
        const region = this.host.getNativeGalleryRegion?.();
        if (region) this.observeRegion(region);
        this.refresh();
    }
    /** @param {MouseEvent} event */
    openImage(event) {
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.defaultPrevented) return;
        const target = /** @type {Element} */ (event.target);
        if (target.closest(".screen-container")) return;
        const entries = this.host.getDetailImageSequence?.() ?? [];
        const index = entries.findIndex((/** @type {any} */ entry) => entry.trigger.contains(target));
        if (index < 0 || !target.closest("img,a,button") || target.closest(".retry-link,.check-link")) return;
        event.preventDefault(); event.stopImmediatePropagation();
        const entry = entries[index];
        this.ui.openImageViewer(entry.image, { imageKind:"photo", images: entries.map((/** @type {any} */ item) => ({ url:item.url,alt:item.image.alt })), initialViewIndex:index, owner:entry.trigger, trigger:entry.trigger, scope:this.scope });
    }
    schedule() {
        if(this.scheduled || this.scope.disposed) return;
        this.scheduled = true;
        queueMicrotask(() => { this.scheduled = false; if(!this.scope.disposed) this.refresh(); });
    }
    refresh() {
        /** @type {Array<{root:Element,region:Element,items:Element[]}>} */
        const galleries = this.host.getDetailGalleryBoundaries?.() ?? [];
        const galleryRoots = new Set(galleries.map(boundary => boundary.root));
        for(const [root,stop] of this.galleries) if(!root.isConnected || !galleryRoots.has(root)) {
            stop(); this.galleries.delete(root);
            for (const node of [root, ...root.querySelectorAll('[data-jhs-gallery-item],[data-jhs-gallery-wrapper]')]) {
                for (const name of ['data-jhs-native-gallery','data-jhs-gallery-item','data-jhs-gallery-wrapper']) node.removeAttribute(name);
            }
        }
        for(const [region,stop] of this.regions) if(!region.isConnected) { stop(); this.regions.delete(region); }
        for(const boundary of galleries) {
            const root = /** @type {Element} */ (boundary.root);
            this.mark(root,"data-jhs-native-gallery"); this.observeRegion(boundary.region);
            if(!this.galleries.has(root)) {
                const observer = this.scope.observe(root, records => { if(records.some(record => !/** @type {Element} */(record.target).closest?.('.jhs-native-gallery-state'))) this.schedule(); }, {childList:true,subtree:true,attributes:true,attributeFilter:["src","srcset","data-src","data-original"]});
                const load = this.scope.listen(root,"load",() => this.updateState(root),true);
                const error = this.scope.listen(root,"error",() => this.updateState(root),true);
                this.galleries.set(root,() => { this.scope.releaseObserver(observer); load(); error(); root.querySelector('.jhs-native-gallery-state')?.remove(); });
            }
            for(const item of boundary.items) {
                this.mark(item,"data-jhs-gallery-item");
                let parent = item.parentElement;
                while(parent && parent !== root) { this.mark(parent,"data-jhs-gallery-wrapper"); parent = parent.parentElement; }
            }
            this.updateState(root);
        }
        for(const boundary of this.host.getDetailRecommendationBoundaries?.() ?? []) {
            this.mark(boundary.root,"data-jhs-native-recommendations");
            if (boundary.panel) {
                this.mark(boundary.panel,'data-jhs-recommendation-panel');
                for (const name of ['jhs-ui','jhs-detail-owned-slot']) this.markClass(boundary.panel,name);
            }
            if (boundary.heading) this.markClass(boundary.heading,'jhs-panel-header');
            const columns = this.host.locateDetailRoot()?.style.getPropertyValue("--jhs-recommendation-columns");
            if (columns) boundary.root.style.setProperty("--jhs-recommendation-columns", columns);
            this.observeRegion(boundary.region);
        }
    }
    /** @param {Element} node @param {string} name */
    mark(node,name) { node.setAttribute(name,"true"); this.marked.add(node); }
    /** @param {Element} node @param {string} name */
    markClass(node,name) {
        if (node.classList.contains(name)) return;
        node.classList.add(name); this.scope.addCleanup(() => node.classList.remove(name));
    }
    /** @param {Element} region */
    observeRegion(region) {
        if(this.regions.has(region)) return;
        const observer = this.scope.observe(region, records => {
            if (records.some(record => [...record.addedNodes, ...record.removedNodes].some(node => {
                if (node.nodeType !== 1) return false;
                const element = /** @type {Element} */ (node);
                return this.host.isDetailMediaBoundary(element);
            }))) this.schedule();
        }, {childList:true,subtree:true});
        this.regions.set(region,() => this.scope.releaseObserver(observer));
    }
    /** @param {Element} root */
    updateState(root) {
        if(this.scope.disposed || !root.isConnected) return;
        const images = [...root.querySelectorAll('img')];
        const loaded = images.some(image => image.complete && image.naturalWidth > 0);
        const message = loaded || root.querySelector('.preview-video-container') ? "" : !images.length ? "暂无图集" : images.every(image => image.complete && !image.naturalWidth) ? "图集加载失败，可点击缩略图重新查看来源" : "加载中…";
        let state = root.querySelector('.jhs-native-gallery-state');
        if(!message) { state?.remove(); return; }
        if(!state) { state=root.ownerDocument.createElement('p');state.className='jhs-native-gallery-state';state.setAttribute('role','status');root.append(state); }
        if(state.textContent !== message) state.textContent=message;
    }
    dispose() { this.releaseOwner(); this.scope.dispose(); }
}
