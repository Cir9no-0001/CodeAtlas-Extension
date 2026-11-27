/*
LEGAL TAB + CONSENT MODAL
Docs are fetched from the public CodeAtlas-Legal repo.
*/

const LEGAL_BASE = "https://raw.githubusercontent.com/Cir9no-0001/CodeAtlas-Legal/main/";
const LEGAL_DOCS = {
    privacy: "PRIVACY_POLICY.md",
    terms: "TERMS_OF_SERVICE.md",
    eula: "EULA.md",
    dmca: "DMCA_POLICY.md"
};

// Must match "Last updated" in CodeAtlas-Legal. Changing it re-prompts users.
const CURRENT_LEGAL_VERSION = "2026-11";

export function initLegal() {
    const view = document.getElementById("legal-doc-view");
    const links = document.querySelectorAll(".legal-link");

    links.forEach((btn) => {
        btn.addEventListener("click", () => {
            links.forEach((l) => l.classList.toggle("active", l === btn));
            loadLegalDoc(btn.dataset.doc, view);
        });
    });

    loadLegalDoc("privacy", view);
}

// Waits until the user accepts.
export async function ensureConsent() {
    const { legalConsent } = await chrome.storage.local.get("legalConsent");
    if (legalConsent === CURRENT_LEGAL_VERSION) return;

    const modal = document.getElementById("consent-modal");
    const intro = document.getElementById("consent-intro");
    const docView = document.getElementById("consent-doc-view");
    const backBtn = document.getElementById("consent-back-btn");
    const acceptBtn = document.getElementById("consent-accept-btn");

    document.querySelectorAll(".legal-link-inline").forEach((link) => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            intro.hidden = true;
            backBtn.hidden = false;
            loadLegalDoc(link.dataset.doc, docView);
        });
    });
    backBtn.addEventListener("click", () => {
        docView.hidden = true;
        backBtn.hidden = true;
        intro.hidden = false;
    });

    modal.hidden = false;
    await new Promise((resolve) => acceptBtn.addEventListener("click", resolve, { once: true }));
    await chrome.storage.local.set({ legalConsent: CURRENT_LEGAL_VERSION });
    modal.hidden = true;
}

async function loadLegalDoc(docKey, target) {
    target.hidden = false;
    target.textContent = "Loading...";
    try {
        const res = await fetch(LEGAL_BASE + LEGAL_DOCS[docKey], { cache: "no-store" });
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        target.innerHTML = markdownToHtml(await res.text());
    } catch (err) {
        target.textContent = "Couldn't load this document.";
        console.error(err);
    }
}

/*
MARKDOWN RENDERER
Supports: # headings, - and 1. lists, ---, **bold**, `code`, emails, https links.
Every line is HTML-escaped before tags are added, so fetched text can't inject markup.
*/

function markdownToHtml(markdown) {
    const html = [];
    let list = null; // "ul" or "ol" while inside a list

    const closeList = () => {
        if (list) html.push(`</${list}>`);
        list = null;
    };
    const openList = (tag) => {
        if (list === tag) return;
        closeList();
        html.push(`<${tag}>`);
        list = tag;
    };

    for (const raw of markdown.split("\n")) {
        const line = raw.trim();
        const heading = line.match(/^(#{1,3})\s+(.*)$/);
        const bullet = line.match(/^[-*]\s+(.*)$/);
        const numbered = line.match(/^\d+\.\s+(.*)$/);

        if (!line) {
            closeList();
        } else if (heading) {
            closeList();
            const level = heading[1].length;
            html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
        } else if (/^-{3,}$/.test(line)) {
            closeList();
            html.push("<hr>");
        } else if (bullet) {
            openList("ul");
            html.push(`<li>${inline(bullet[1])}</li>`);
        } else if (numbered) {
            openList("ol");
            html.push(`<li>${inline(numbered[1])}</li>`);
        } else {
            closeList();
            html.push(`<p>${inline(line)}</p>`);
        }
    }
    closeList();

    return html.join("");
}

function inline(text) {
    return escapeHtml(text)
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/https:\/\/[^\s<]+/g, (url) => `<a href="${url}" target="_blank" rel="noopener">${url}</a>`)
        .replace(/[\w.+-]+@[\w-]+\.[\w.-]+\w/g, (email) => `<a href="mailto:${email}">${email}</a>`);
}

function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}