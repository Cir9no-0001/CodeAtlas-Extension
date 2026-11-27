/*
LOG TAB
Renders runLogs from storage. background.js writes them, this only displays.
*/

import { DONE } from "../lib/constants.js";
import { fetchRunLog } from "../lib/providers/githubActions.js";

const list = document.getElementById("log-list");

export async function initLog() {
    const { runLogs = [] } = await chrome.storage.local.get("runLogs");
    render(runLogs);

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && changes.runLogs) render(changes.runLogs.newValue ?? []);
    });
    document.getElementById("clear-log-btn").addEventListener("click", () => {
        chrome.storage.local.set({ runLogs: [] });
    });
}

// Reuse unchanged rows so open logs stay open between updates.
function render(entries) {
    if (!entries.length) {
        const empty = document.createElement("li");
        empty.className = "log-empty";
        empty.textContent = "No runs yet.";
        list.replaceChildren(empty);
        return;
    }

    const existing = new Map([...list.children].map((el) => [el.dataset.id, el]));
    list.replaceChildren(...entries.map((entry) => {
        const key = `${entry.status}|${entry.message}`;
        const old = existing.get(entry.id);
        return old?.dataset.key === key ? old : buildRow(entry, key);
    }));
}

function buildRow(entry, key) {
    const li = document.createElement("li");
    li.className = `log-entry log-${entry.status}`;
    li.dataset.id = entry.id;
    li.dataset.key = key;

    if (!DONE.includes(entry.status)) {
        li.append(...headerCells(entry));
        return li;
    }

    const details = document.createElement("details");
    const summary = document.createElement("summary");
    const pre = document.createElement("pre");
    summary.append(...headerCells(entry));
    pre.className = "log-output";
    pre.textContent = "Loading log...";
    details.append(summary, pre);

    details.addEventListener("toggle", async () => {
        if (!details.open || details.dataset.loaded) return;
        details.dataset.loaded = "true";
        pre.textContent = await loadLogText(entry);
    });

    li.append(details);
    return li;
}

function headerCells(entry) {
    const dt = new Date(entry.timestamp);
    return [
        cell("log-col log-col-date", dt.toLocaleDateString()),
        cell("log-col log-col-time", dt.toLocaleTimeString()),
        cell("log-col log-col-status", entry.status),
        cell("log-message", entry.message)
    ];
}

function cell(className, text) {
    const span = document.createElement("span");
    span.className = className;
    span.textContent = text;
    return span;
}

async function loadLogText(entry) {
    // Entries from before v0.1 stored owner and repo separately.
    const repo = entry.owner ? `${entry.owner}/${entry.repo}` : entry.repo;
    if (!entry.runId || !repo) return "No log available (run never reached GitHub).";

    try {
        const { githubToken } = await chrome.storage.local.get("githubToken");
        return await fetchRunLog(githubToken, repo, entry.runId);
    } catch (err) {
        return [404, 410].includes(err.status)
            ? "Log expired on GitHub's side."
            : `Couldn't load log: ${err.message}`;
    }
}