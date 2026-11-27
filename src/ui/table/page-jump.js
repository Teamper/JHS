// @ts-check

/** @param {Element} pagination @param {number} currentPage @param {(page:number)=>void} onPage @param {import("../../core/lifecycle-scope.js").LifecycleScope} scope */
export function mountPageJump(pagination, currentPage, onPage, scope) {
    const document = pagination.ownerDocument;
    const input = document.createElement("input"), button = document.createElement("button"), root = document.createElement("li");
    input.type = "number";
    input.className = "jhs-field jhs-jump-page-input";
    input.id = "jumpPageInput";
    input.placeholder = "页码";
    input.setAttribute("aria-label", "页码");
    input.min = "1";
    input.value = String(currentPage + 1);
    button.type = "button";
    button.className = "jhs-btn jhs-btn--secondary jhs-jump-page-btn";
    button.textContent = "跳转";
    root.id = "gemini-jump-page-control";
    root.append(input, button);
    const submit = () => {
        const page = Number(input.value);
        if (!Number.isInteger(page) || page < 1) { input.focus(); return; }
        onPage(page);
    };
    scope.listen(button, "click", submit);
    scope.listen(input, "keypress", event => {
        if ((/** @type {KeyboardEvent} */ (event)).key !== "Enter") return;
        event.preventDefault();
        submit();
    });
    pagination.append(root);
    scope.addCleanup(() => root.remove());
    return root;
}
