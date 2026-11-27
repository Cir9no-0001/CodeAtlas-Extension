/*
SYNC PANEL
Shows sync state and sends start/cancel to background.js. Never runs the sync itself.
*/

import { ACTIVE, ALARM_NAME } from "../lib/constants.js";
import { listRepos } from "../lib/github.js";

const powerButton = document.getElementById("power-button");
const progressEl = document.getElementById("sync-progress");
const lastSyncedEl = document.getElementById("last-synced");
const intervalSelect = document.getElementById("sync-interval");
const repoSelect = document.getElementById("repo-select");
const githubStatus = document.getElementById("github-status");
const leetcodeStatus = document.getElementById("leetcode-status");

let currentStatus = "idle";

export async function initSyncPanel() {
    powerButton.addEventListener("click", () => {
        const type = ACTIVE.includes(currentStatus) ? "SYNC_CANCEL" : "SYNC_START";
        chrome.runtime.sendMessage({ type }).catch(() => {});
    });
    repoSelect.addEventListener("change", () => {
        chrome.storage.local.set({ selectedRepo: repoSelect.value });
    });
    intervalSelect.addEventListener("change", onIntervalChange);

    const { syncState, lastSynced, syncInterval, githubToken } = await chrome.storage.local.get(
        ["syncState", "lastSynced", "syncInterval", "githubToken"]
    );
    renderState(syncState);
    renderLastSynced(lastSynced);
    if (syncInterval) intervalSelect.value = syncInterval;
    if (githubToken) loadRepos(githubToken);
    checkLeetCode();

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local") return;
        if (changes.syncState) renderState(changes.syncState.newValue);
        if (changes.lastSynced) renderLastSynced(changes.lastSynced.newValue);
        if (changes.githubToken?.newValue) loadRepos(changes.githubToken.newValue);
    });
}

export function openAuthWindow() {
    chrome.windows.create({
        url: chrome.runtime.getURL("src/auth/auth.html"),
        type: "popup",
        width: 420,
        height: 300
    });
}

function renderState(state = { status: "idle" }) {
    currentStatus = state.status;
    const active = ACTIVE.includes(state.status);

    powerButton.classList.toggle("running", active);
    powerButton.classList.toggle("failed", state.status === "failed");
    powerButton.setAttribute("aria-label", active ? "Cancel sync" : "Run sync");

    progressEl.hidden = state.status === "idle";
    if (active) progressEl.textContent = `${state.message} (click to cancel)`;
    else if (state.status === "success") progressEl.textContent = "Done";
    else if (state.status === "cancelled") progressEl.textContent = "Cancelled";
    else if (state.status === "failed") progressEl.textContent = state.message;
}

function renderLastSynced(value) {
    const date = new Date(value);
    const text = !value ? "never" : isNaN(date) ? value : date.toLocaleString();
    lastSyncedEl.textContent = `Last synced: ${text}`;
}

async function loadRepos(token) {
    try {
        const repos = await listRepos(token);
        const { selectedRepo, githubUsername } = await chrome.storage.local.get(["selectedRepo", "githubUsername"]);

        repoSelect.replaceChildren(
            new Option("Select a repo...", ""),
            ...repos.map((r) => new Option(r.full_name, r.full_name))
        );
        repoSelect.value = selectedRepo ?? "";
        repoSelect.hidden = false;
        setGithubStatus(`GitHub: ${githubUsername ?? "connected"}`, false);
    } catch (err) {
        repoSelect.hidden = true;
        const msg = err.status === 401 ? "token invalid or expired" : "couldn't load repos";
        setGithubStatus(`GitHub: ${msg}. Click to reconnect`, true);
    }
}

function setGithubStatus(text, bad) {
    githubStatus.textContent = text;
    githubStatus.classList.toggle("status-bad", bad);
    githubStatus.onclick = bad ? openAuthWindow : null;
}

async function checkLeetCode() {
    const cookie = await chrome.cookies.get({ url: "https://leetcode.com", name: "LEETCODE_SESSION" });
    leetcodeStatus.textContent = cookie
        ? "LeetCode: connected"
        : "LeetCode: not logged in. Log in at leetcode.com";
    leetcodeStatus.classList.toggle("status-bad", !cookie);
}

async function onIntervalChange() {
    const value = intervalSelect.value;
    await chrome.storage.local.set({ syncInterval: value });
    if (value === "off") {
        await chrome.alarms.clear(ALARM_NAME);
    } else {
        await chrome.alarms.create(ALARM_NAME, { periodInMinutes: Number(value) });
    }
}