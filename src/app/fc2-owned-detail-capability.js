// @ts-check

/** Provide the shared owned-detail coordinator without exposing its implementation to Features. */
export class Fc2OwnedDetailCapability {
    /** @param {new (options?: Record<string, any>) => any} coordinator */
    constructor(coordinator) { this.coordinator = coordinator; }
    /** @param {Record<string, any>} options */
    create(options) { return new this.coordinator(options); }
}
