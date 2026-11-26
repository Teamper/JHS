export function hasVisualBaseline(info, projects = ["desktop-wide", "mobile"]) {
    return process.env.JHS_VISUAL_REGRESSION === "1" && projects.includes(info.project.name);
}
