/*
TABS
Switches the visible panel and tells main.js which tab was left.
*/

export function initTabs({ onLeave } = {}) {
    const tabs = document.querySelectorAll(".nav-tab");
    const panels = document.querySelectorAll(".panel");
    let current = document.querySelector(".nav-tab.active")?.dataset.panel;

    tabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            const target = tab.dataset.panel;
            if (target === current) return;

            onLeave?.(current);
            tabs.forEach((t) => t.classList.toggle("active", t === tab));
            panels.forEach((p) => { p.hidden = p.id !== `panel-${target}`; });
            current = target;
        });
    });
}