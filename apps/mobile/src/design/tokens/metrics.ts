export const touchTarget = 48;
export const screenGutter = 16;
export const tabBar = { height: 64, gap: 12, inset: 16, maxWidth: 420 };
export const settingsFooter = { top: 8, bottom: 12 };

export const columnsFor = (width: number) => width >= 1000 ? 5 : width >= 720 ? 4 : width >= 540 ? 3 : 2;
