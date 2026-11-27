/*
BACKGROUND SERVICE WORKER
Runs the sync. The dashboard only reads storage and sends start/cancel messages.
*/

import * as provider from "./lib/providers/githubActions.js";
import { ALARM_NAME, ACTIVE } from "./lib/constants.js";

const POLL_MS = 3000;
const MAX_POLL_ERRORS = 5;
const MAX_LOG_ENTRIES = 50;

chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({ url: chrome.runtime.getURL("src/dashboard/dashboard.html") });
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) startSync();
});

chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "SYNC_START") startSync();
    if (message.type === "SYNC_CANCEL") cancelSync();
});

// Resume a run if Chrome killed the worker mid-sync.
resumeSync();

/*
STATE
syncState in storage is the single source of truth. Every change also updates the run's log entry.
*/

async function getState() {
    const { syncState } = await chrome.storage.local.get("syncState");
    return syncState ?? { status: "idle" };
}

async function setState(patch) {
    const state = { ...(await getState()), ...patch, updatedAt: Date.now() };
    await chrome.storage.local.set({ syncState: state });
    if (state.logId) {
        await updateLog(state.logId, {
            status: state.status,
            message: state.message,
            repo: state.repo,
            runId: state.runId
        });
    }
    return state;
}

/*
RUN LOG
*/

async function addLog(repo) {
    const { runLogs = [] } = await chrome.storage.local.get("runLogs");
    const entry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        status: "starting",
        message: `Sync started on ${repo}`,
        repo,
        runId: null
    };
    await chrome.storage.local.set({ runLogs: [entry, ...runLogs].slice(0, MAX_LOG_ENTRIES) });
    return entry.id;
}

async function updateLog(id, patch) {
    const { runLogs = [] } = await chrome.storage.local.get("runLogs");
    const entry = runLogs.find((r) => r.id === id);
    if (!entry) return; // log was cleared mid-run
    Object.assign(entry, patch);
    await chrome.storage.local.set({ runLogs });
}

/*
SYNC
*/

async function startSync() {
    if (ACTIVE.includes((await getState()).status)) return; // already running

    const { githubToken, selectedRepo } = await chrome.storage.local.get(["githubToken", "selectedRepo"]);
    if (!githubToken || !selectedRepo) {
        await setState({ status: "failed", message: "Connect GitHub and pick a repo first.", logId: null });
        return;
    }

    const logId = await addLog(selectedRepo);
    await setState({
        status: "starting",
        message: "Starting...",
        repo: selectedRepo,
        runId: null,
        logId,
        cancelRequested: false
    });

    try {
        const { runId } = await provider.startRun(githubToken, selectedRepo);
        const state = await setState({ status: "queued", message: "Queued...", runId });
        if (state.cancelRequested) await provider.cancelRun(githubToken, selectedRepo, runId);
        await pollRun();
    } catch (err) {
        await setState({ status: "failed", message: err.message });
    }
}

async function cancelSync() {
    const state = await getState();
    if (!ACTIVE.includes(state.status)) return;

    // No run ID yet: flag it, startSync cancels once it has one.
    if (!state.runId) {
        await setState({ cancelRequested: true, message: "Cancelling..." });
        return;
    }

    try {
        const { githubToken } = await chrome.storage.local.get("githubToken");
        await setState({ message: "Cancelling..." });
        await provider.cancelRun(githubToken, state.repo, state.runId);
    } catch (err) {
        await setState({ message: `Cancel failed: ${err.message}` });
    }
}

let polling = false; // stops two poll loops running at once

// Checks the run every 3s. Each storage call also keeps the worker alive.
async function pollRun() {
    if (polling) return;
    polling = true;
    let errors = 0;

    try {
        while (true) {
            const state = await getState();
            if (!ACTIVE.includes(state.status) || !state.runId) return;

            try {
                const { githubToken } = await chrome.storage.local.get("githubToken");
                const run = await provider.getRunStatus(githubToken, state.repo, state.runId);
                errors = 0;

                if (run.status === "completed") {
                    await finishRun(run.conclusion);
                    return;
                }

                const queued = run.status === "queued";
                await setState({
                    status: queued ? "queued" : "running",
                    message: state.cancelRequested ? "Cancelling..." : queued ? "Queued..." : "Running..."
                });
            } catch (err) {
                if (++errors >= MAX_POLL_ERRORS) {
                    await setState({ status: "failed", message: `Lost track of run: ${err.message}` });
                    return;
                }
            }

            await sleep(POLL_MS);
        }
    } finally {
        polling = false;
    }
}

async function finishRun(conclusion) {
    if (conclusion === "success") {
        await setState({ status: "success", message: "Sync completed successfully" });
        await chrome.storage.local.set({ lastSynced: new Date().toISOString() });
    } else if (conclusion === "cancelled") {
        await setState({ status: "cancelled", message: "Sync run cancelled" });
    } else {
        await setState({ status: "failed", message: `Workflow failed (${conclusion})` });
    }
}

async function resumeSync() {
    const state = await getState();
    if (!ACTIVE.includes(state.status)) return;

    if (state.runId) {
        pollRun();
    } else {
        await setState({ status: "failed", message: "Interrupted before the run started." });
    }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}