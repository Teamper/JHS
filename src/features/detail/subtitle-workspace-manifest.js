// @ts-check
import { subtitleUploadEnabled } from "../../core/enhancement-controls.js";
import { defineFeature } from "../../contracts/manifests.js";
import { PORT, SERVICE } from "../../contracts/tokens.js";
import { SubtitleUploadController } from "./subtitle-upload-controller.js";
import { SubtitleWorkspaceController } from "./subtitle-workspace-controller.js";
import { SUBTITLE_WORKSPACE_STYLES } from "../../ui/detail/subtitle-workspace.js";

export default defineFeature({
    id: "subtitle-workspace", kind: "feature", disableable: true, sites: ["javdb", "javbus"], routes: ["list", "detail", "owned-detail"], startup: "on-command",
    requires: [PORT.style, SERVICE.subtitle, SERVICE.dialog, SERVICE.domUi, SERVICE.subtitleUpload, SERVICE.one115Match, SERVICE.settings], contributes: [], providesCommands: ["subtitle.open"],
    activate: async (/** @type {any} */ deps, /** @type {any} */ runtime) => {
        runtime.scope.addCleanup(deps[PORT.style].register("jhs-subtitle-workspace", SUBTITLE_WORKSPACE_STYLES));
        const uploader = new SubtitleUploadController({ document, dialog: deps[SERVICE.dialog], ui: deps[SERVICE.domUi], settings: deps[SERVICE.settings], matching: deps[SERVICE.one115Match], uploads: deps[SERVICE.subtitleUpload] });
        const controller = new SubtitleWorkspaceController({ document, scope: runtime.scope, subtitle: deps[SERVICE.subtitle], dialog: deps[SERVICE.dialog], ui: deps[SERVICE.domUi], uploadEnabled: () => subtitleUploadEnabled(deps[SERVICE.settings].snapshot()), upload: (/** @type {any} */ input) => uploader.open(input), uploadRecords: (/** @type {any} */ input) => uploader.openRecords(input) });
        return { commands: { "subtitle.open": (/** @type {any} */ movie) => controller.open(movie) } };
    },
});
