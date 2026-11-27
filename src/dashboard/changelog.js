/*
CHANGELOG TAB
Fetches CHANGELOG.md from the main CodeAtlas repo, cached for 1 hour.
*/

const CHANGELOG_URL = "https://raw.githubusercontent.com/Cir9no-0001/CodeAtlas/main/CHANGELOG.md";
const CACHE_MS = 60 * 60 * 1000;

const container = document.getElementById("changelog-list");

export async function initChangelog() {
    const { changelogCache } = await chrome.storage.local.get("changelogCache");

    if (changelogCache && Date.now() - changelogCache.fetchedAt < CACHE_MS) {
        render(parse(changelogCache.text));
        return;
    }

    try {
        const res = await fetch(CHANGELOG_URL, { cache: "no-store" });
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        const text = await res.text();
        await chrome.storage.local.set({ changelogCache: { text, fetchedAt: Date.now() } });
        render(parse(text));
    } catch (err) {
        if (changelogCache) render(parse(changelogCache.text));
        else container.textContent = "Couldn't load changelog. Check your connection.";
        console.error(err);
    }
}

// Format: "## [0.2.0] — 2026-08-14", then "### Added", then "- item" lines.
function parse(markdown) {
    return markdown.split(/^## /m).slice(1).map((block) => {
        const header = block.split("\n")[0].trim();
        const match = header.match(/^\[([^\]]+)\]\s*—\s*(.+)$/);

        const sections = block.split(/^### /m).slice(1).map((sec) => {
            const [title, ...lines] = sec.split("\n");
            const items = lines
                .map((l) => l.trim())
                .filter((l) => l.startsWith("- "))
                .map((l) => l.slice(2));
            return { title: title.trim(), items };
        }).filter((s) => s.items.length);

        return { version: match ? match[1] : header, date: match ? match[2] : "", sections };
    });
}

function render(entries) {
    if (!entries.length) {
        container.textContent = "No changelog entries found.";
        return;
    }

    container.replaceChildren(...entries.map((entry) => {
        const article = el("article", "changelog-entry");
        article.append(el("h3", "", `v${entry.version}`));
        if (entry.date) article.append(el("p", "changelog-date", entry.date));

        entry.sections.forEach((section) => {
            const div = el("div", "changelog-section");
            const ul = el("ul");
            ul.append(...section.items.map((item) => el("li", "", item)));
            div.append(el("h4", "", section.title), ul);
            article.append(div);
        });
        return article;
    }));
}

function el(tag, className = "", text = "") {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
}