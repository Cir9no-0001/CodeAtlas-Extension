/*
DASHBOARD ENTRY
Starts each panel, then runs consent and GitHub auth.
*/

import { initTabs } from "./tabs.js";
import { initSyncPanel, openAuthWindow } from "./sync-panel.js";
import { initLog } from "./log.js";
import { initChangelog } from "./changelog.js";
import { initLegal, ensureConsent } from "./legal.js";
import { initSettings, revertUnsavedBackground } from "./settings.js";

// Wake the worker so it can resume an interrupted run.
chrome.runtime.sendMessage({ type: "WAKE" }).catch(() => {});

initTabs({
    onLeave: (panel) => {
        if (panel === "settings") revertUnsavedBackground();
    }
});
initSettings();
initSyncPanel();
initLog();
initChangelog();
initLegal();

// Consent first, then GitHub auth.
await ensureConsent();
const { githubToken } = await chrome.storage.local.get("githubToken");
if (!githubToken) openAuthWindow();