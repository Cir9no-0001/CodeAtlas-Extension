/*
AUTH POPUP
Checks the pasted token against GitHub, then saves it.
*/

import { getUser } from "../lib/github.js";

const input = document.getElementById("pat-input");
const statusEl = document.getElementById("auth-status");

document.getElementById("auth-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const token = input.value.trim();
    if (!token) {
        statusEl.textContent = "Paste a token first.";
        return;
    }

    statusEl.textContent = "Checking token...";
    try {
        const user = await getUser(token);
        await chrome.storage.local.set({ githubToken: token, githubUsername: user.login });
        statusEl.textContent = `Connected as ${user.login}.`;
        setTimeout(() => window.close(), 800);
    } catch (err) {
        statusEl.textContent = err.status === 401
            ? "Invalid token. Check it and try again."
            : `Couldn't connect: ${err.message}`;
    }
});