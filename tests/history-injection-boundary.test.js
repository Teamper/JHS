// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { buildActionButtons, buildCarNumCell, buildEditRecordForm, buildNamesCell } from "../src/features/library/history-controller.js";

const HOSTILE = {
    carNum: 'ABC-1"><img src=x onerror=alert(1)>',
    names: '女优1</button><script>alert(1)</script> 女优2',
    url: 'javascript:alert(1)',
    remark: '</textarea><img src=x onerror=alert(2)><textarea>',
};

describe("history HTML injection boundaries", () => {
    it("keeps hostile carNum as inert text in the carNum cell", () => {
        const node = buildCarNumCell(HOSTILE.carNum);
        document.body.appendChild(node);
        expect(document.querySelector("script")).toBeNull();
        expect(document.querySelector("img")).toBeNull();
        const prefix = node.querySelector(".table-link-param");
        expect(prefix?.textContent).toBe("ABC-");
        expect(node.textContent).toContain('1"><img');
    });

    it("keeps hostile names as inert text buttons", () => {
        const node = buildNamesCell(HOSTILE.names);
        document.body.appendChild(node);
        expect(document.querySelector("script")).toBeNull();
        expect(document.querySelector("img")).toBeNull();
        const labels = [ ...node.querySelectorAll(".table-link-param") ].map((button) => button.textContent);
        expect(labels).toContain('女优1</button><script>alert(1)</script>');
    });

    it("stores hostile url/carNum via dataset, never via HTML attributes", () => {
        const node = buildActionButtons(HOSTILE);
        document.body.appendChild(node);
        expect(document.querySelector("script")).toBeNull();
        expect(document.querySelector("img")).toBeNull();
        expect(node.getAttribute("data-car-num")).toBe(HOSTILE.carNum);
        expect(node.getAttribute("data-href")).toBe(HOSTILE.url);
    });

    it("renders a static edit form; hostile values only ever appear as input values", () => {
        const flags = { favorite: false, downloaded: true, watched: false, blocked: false };
        document.body.innerHTML = buildEditRecordForm(flags);
        expect(document.querySelector("script")).toBeNull();
        expect(document.querySelector("img")).toBeNull();
        expect(document.querySelector("#edit-downloaded")?.checked).toBe(true);
        expect(document.querySelector("#edit-remark")?.textContent).toBe("");
        // Back-filling hostile values the way editRecord does must stay inert.
        const remark = document.querySelector("#edit-remark");
        remark.value = HOSTILE.remark;
        const carNum = document.querySelector("#edit-carNum");
        carNum.value = HOSTILE.carNum;
        const url = document.querySelector("#edit-url");
        url.value = HOSTILE.url;
        expect(document.querySelector("script")).toBeNull();
        expect(document.querySelector("img")).toBeNull();
        expect(remark.value).toBe(HOSTILE.remark);
        expect(carNum.value).toBe(HOSTILE.carNum);
        expect(url.value).toBe(HOSTILE.url);
    });
});
