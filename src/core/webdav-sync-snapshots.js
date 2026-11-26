// @ts-check

/** @typedef {Record<string, any>} Dict */
/** @typedef {{model: Dict, data: Dict, eligibility: string[], binding: string, maintenanceAt: number}} VerifiedMerge */

/** @param {Dict} left @param {Dict} right */
export function sameSidecarRevision(left, right) {
    return left.metadataRevision === right.metadataRevision && left.epoch === right.epoch && left.replicaId === right.replicaId;
}

/** @param {Dict} left @param {Dict} right */
export function sameSyncRevision(left, right) {
    return left.generation === right.generation && sameSidecarRevision(left, right);
}

/** Copies writable containers and shares the immutable records. @param {Dict} model @param {Dict} shadow */
function copyGraph(model, shadow) {
    return { model: { records: { ...model.records }, frontiers: { ...model.frontiers } }, shadow: { ...shadow } };
}

/** One detached sidecar snapshot. Only reads made under the mutation lock may seed its graph. */
export class WebDavSyncSnapshots {
    generation = 0;
    /** @type {{revision: Dict, header: Dict, graph: ReturnType<typeof copyGraph> | null} | null} */ current = null;
    /** @type {VerifiedMerge | null} */ verified = null;

    /** @param {Dict} state @param {Dict} revision @param {boolean} [ownGraph] */
    remember(state, revision, ownGraph = false) {
        const { model, shadow, ...header } = state;
        const previous = this.current;
        const graph = ownGraph ? copyGraph(model, shadow)
            : previous && sameSidecarRevision(previous.revision, revision) ? previous.graph : null;
        this.current = { revision: { ...revision }, header: structuredClone(header), graph };
    }

    /** @param {Dict} revision */
    metadata(revision) {
        const current = this.current;
        if (!current || !sameSyncRevision(current.revision, revision)) return null;
        const value = structuredClone(current.header), pending = value.pending;
        if (pending) {
            const { name, seq, createdAt, coveredRevision } = pending;
            value.pending = { name, seq, createdAt, coveredRevision };
        }
        return value;
    }

    /** @param {Dict} revision */
    round(revision) {
        const current = this.current;
        if (!current?.graph || !sameSidecarRevision(current.revision, revision)) return null;
        current.revision = { ...revision };
        return { ...structuredClone(current.header), ...copyGraph(current.graph.model, current.graph.shadow) };
    }

    release() {
        this.generation++;
        this.current = null;
        this.verified = null;
    }
}
