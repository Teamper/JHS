// @ts-check

/** @param {any} value */
export function isPersonalRating(value) {
    return !!value && typeof value === "object" && !Array.isArray(value)
        && Number.isInteger(value.rating) && value.rating >= 1 && value.rating <= 5
        && typeof value.updatedAt === "string" && Number.isFinite(Date.parse(value.updatedAt))
        && Object.keys(value).every(key => ["rating", "updatedAt"].includes(key));
}
