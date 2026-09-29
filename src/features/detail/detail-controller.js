// @ts-check

import { HostedDetailSurface } from "../../ui/detail/hosted-detail-surface.js";
import { DetailBrowseLifecycleController } from "./detail-browse-lifecycle-controller.js";
import { DetailSubtitleLinkController } from "./detail-subtitle-link-controller.js";
import { DetailStateActionsController } from "./detail-state-actions-controller.js";
import { DetailWorkspaceController } from "./detail-workspace-controller.js";

export class DetailController {
    /** @param {{hostAdapter: any, scope: import("../../core/lifecycle-scope.js").LifecycleScope, enabledContributions: readonly string[], state: any, settings?: any, diagnostics?: any, movie?: any, ui?: any, pageActions?: {readPageInfo: () => any, ui: any, attach: (controller: DetailStateActionsController) => void, detachWorkspace?: (controller: DetailWorkspaceController) => void, attachWorkspace?: (controller: DetailWorkspaceController) => void} | null, workspaceUi?: any, styles?: any, eventBus?: any, onWorkspaceError?: (error: unknown) => void}} options */
    constructor(options) {
        this.hostAdapter = options.hostAdapter;
        this.scope = options.scope;
        this.enabledContributions = new Set(options.enabledContributions);
        this.surface = new HostedDetailSurface(this.hostAdapter);
        this.stateActions = options.pageActions ? new DetailStateActionsController({ state: options.state, scope: this.scope, page: options.pageActions }) : null;
        if (this.stateActions) options.pageActions?.attach(this.stateActions);
        this.browseLifecycle = this.enabledContributions.has("detail.page-state-actions") && options.settings
            ? new DetailBrowseLifecycleController({
                settings: options.settings, state: options.state, scope: this.scope,
                onError: (error) => options.diagnostics?.recordError({ source: "detail-browse-lifecycle", featureId: "detail", contributionId: "detail.page-state-actions", message: `自动移除新作品标记失败: ${error instanceof Error ? error.message : String(error)}` }),
            })
            : null;
        this.subtitleLinks = this.enabledContributions.has("detail.page-state-actions") && options.movie && options.ui
            ? new DetailSubtitleLinkController({
                document: this.hostAdapter.document, hostAdapter: this.hostAdapter, movie: options.movie, ui: options.ui, scope: this.scope,
                onError: (error) => options.diagnostics?.recordError({ source: "detail-subtitle-link", featureId: "detail", contributionId: "detail.page-state-actions", message: error instanceof Error ? error.message : String(error) }),
            })
            : null;
        this.pageActions = options.pageActions ?? null;
        this.workspaceUi = options.workspaceUi ?? null;
        this.onWorkspaceError = options.onWorkspaceError ?? null;
        this.workspace = this.workspaceUi ? new DetailWorkspaceController({
            hostAdapter: this.hostAdapter, scope: this.scope, styles: options.styles, eventBus: options.eventBus, ui: this.workspaceUi,
        }) : null;
        if (this.workspace) this.pageActions?.attachWorkspace?.(this.workspace);
        this.workspaceFailed = false;
        this.movieRef = null;
    }
    start() {
        this.scope.assertActive();
        this.surface.mount();
        if (this.workspace) {
            try { this.workspace.start(); }
            catch (error) {
                this.workspaceFailed = true;
                this.workspace.dispose();
                this.pageActions?.detachWorkspace?.(this.workspace);
                this.onWorkspaceError?.(error);
            }
        }
        if (this.enabledContributions.has("detail.javdb-native") && this.hostAdapter.site === "javdb") {
            for (const anchor of this.hostAdapter.locateDetailExternalLinks?.() ?? []) {
                const href = anchor.getAttribute("href");
                if (!href) continue;
                try {
                    if (["http:", "https:"].includes(new URL(href, this.hostAdapter.location?.href ?? globalThis.location?.href).protocol)) anchor.setAttribute("target", "_blank");
                } catch { /* Preserve malformed host links unchanged. */ }
            }
        }
        this.movieRef = this.hostAdapter.readMovieRef();
        if (this.browseLifecycle) void this.browseLifecycle.start(this.movieRef);
        this.subtitleLinks?.start();
        const activeContributions = [...this.enabledContributions].filter((id) => !(id === "detail.workspace" && this.workspaceFailed));
        return Object.freeze({ movieRef: this.movieRef, contributions: activeContributions, activeContributions });
    }
    dispose() {
        if (this.workspace) {
            this.workspace.dispose();
            this.pageActions?.detachWorkspace?.(this.workspace);
        }
        this.surface.dispose();
        this.scope.dispose();
    }
}
