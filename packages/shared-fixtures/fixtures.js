export const actors = ["林夏", "许舟", "江遥", "周禾", "陈野", "顾眠", "孟秋", "程雨"];
export const categories = ["风景", "旅程", "日常", "建筑"];
export const collections = {
    empty: { name: "以后再看", members: [] },
    ordinary: { name: "周末放映", members: [0, 1, 2, 3] },
    large: { name: "年度样片", members: Array.from({ length: 28 }, (_, index) => index + 8) },
};
export const followLabels = { pending: "待办", snoozed: "暂缓", done: "已处理", ignored: "已忽略" };
export const taskLabels = { queued: "等待", running: "进行中", done: "已完成", failed: "失败", cancelled: "已取消" };

const titles = [
    "沿河的午后", "小镇的夏天", "海岸线尽头的白塔", "走进傍晚的山林",
    "漫长的夏日散步：从第一班电车出发，沿着河岸和旧街道走到海风停下的地方 — 夏の記憶",
    "没有海报的档案", "星期日的书店", "港湾晨光", "风开始的时候", "无人站台",
    "北窗", "雨中的石桥", "夜航", "白色小径", "两封来信", "蓝色公路",
    "薄雾里的船", "深秋公园", "老钟楼", "起风的车站", "白昼尽头", "山谷回声",
    "慢车", "向海而行", "纸上地图", "路灯仍亮着", "十三号渡口", "冬日花房",
    "橙色的天空", "远处的风铃", "过客", "街角咖啡", "灯塔以北", "白墙与树影",
    "钟声过后", "湖边小屋", "静水", "金色阶梯", "向山而行", "合上的日记",
];
const palettes = [
    ["#315072", "#9dd9d4"], ["#965640", "#ffd995"], ["#594f81", "#e0bbec"], ["#3d685f", "#e2efd3"],
    ["#715b24", "#f0d489"], ["#474861", "#b4d2f4"], ["#7b4e5d", "#f2b49a"], ["#2b6170", "#a4e0e4"],
];
export const works = titles.map((title, index) => ({
    id: String(index),
    title,
    carNum: "样片-" + ([10, 2, 7, 4, 5, 6, 3, 8, 9, 1][index] ?? index + 1),
    releaseDate: new Date(Date.UTC(2025, 5, 28 - index * 2)).toISOString().slice(0, 10),
    category: categories[index % categories.length],
    actors: index % 3 === 0 ? [actors[index % 8], actors[(index + 1) % 8]] : [actors[index % 8]],
    origins: index < 16,
    duration: 76 + index % 29,
    ratingValue: index === 5 ? null : (42 + (index * 13) % 9) / 10,
    voteCount: index === 5 ? null : 24 + (index * 37) % 280,
    palette: palettes[index % palettes.length],
    cover: index !== 5,
    trailer: index % 4 !== 3 && index !== 5,
    contact: index % 5 !== 4 && index !== 5,
    stills: index % 6 === 5 ? 0 : 3,
}));
export const byId = new Map(works.map(work => [work.id, work]));

export const tasks = [
    { id: "save", name: "沿河的午后 · 保存演示", status: "queued", progress: 0 },
    { id: "export", name: "周末放映 · 导出样片", status: "running", progress: 42 },
    { id: "images", name: "港湾晨光 · 画面缓存", status: "done", progress: 100 },
    { id: "resource", name: "北窗 · 资源演示", status: "failed", progress: 35 },
    { id: "archive", name: "小镇的夏天 · 归档演示", status: "cancelled", progress: 23 },
];

function scene(work, variant) {
    const [background, accent] = work.palette;
    const offset = (Number(work.id) * 41 + variant * 107) % 360;
    return `<path fill="${background}" d="M0 0h800v490H0z"/><circle cx="${235 + offset}" cy="${116 + offset % 90}" r="${58 + offset % 38}" fill="${accent}"/><path fill="${accent}" opacity=".52" d="M0 396l${103 + offset}-176 210 96 384-164v414H0z"/><path fill="${background}" opacity=".5" d="M0 375q250 -165 485 0t402 -30v145H0z"/><path fill="none" stroke="${accent}" opacity=".58" stroke-width="3" d="M0 432q300 -79 800 4"/>`;
}

export function artwork(work, kind = "cover", variant = 0) {
    const count = kind === "contact" ? 6 : 1;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 ${490 * count}">${Array.from({ length: count }, (_, index) => `<g transform="translate(0 ${490 * index})">${scene(work, variant + index)}</g>`).join("")}</svg>`;
    return "data:image/svg+xml," + encodeURIComponent(svg);
}
