/*
GITHUB ACTIONS PROVIDER
Runs a sync through the user's own workflow. Replace this file when the backend ships.
*/

import { githubFetch } from "../github.js";
import "../../../vendor/sealedbox.js"; // defines globalThis.encryptSecret

const WORKFLOW_FILE = "leetcode.yml";

export async function startRun(token, repo) {
    await uploadLeetCodeSecret(token, repo);

    const { default_branch } = await githubFetch(token, `/repos/${repo}`);
    const dispatch = await githubFetch(
        token,
        `/repos/${repo}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
        { method: "POST", body: { ref: default_branch, return_run_details: true } }
    );

    if (!dispatch?.workflow_run_id) throw new Error("GitHub didn't return a run ID.");
    return { runId: dispatch.workflow_run_id };
}

export const getRunStatus = (token, repo, runId) =>
    githubFetch(token, `/repos/${repo}/actions/runs/${runId}`);

export const cancelRun = (token, repo, runId) =>
    githubFetch(token, `/repos/${repo}/actions/runs/${runId}/cancel`, { method: "POST" });

export async function fetchRunLog(token, repo, runId) {
    const { jobs } = await githubFetch(token, `/repos/${repo}/actions/runs/${runId}/jobs`);
    if (!jobs?.length) return "No job found for this run.";
    const res = await githubFetch(token, `/repos/${repo}/actions/jobs/${jobs[0].id}/logs`, { raw: true });
    return res.text();
}

async function uploadLeetCodeSecret(token, repo) {
    const cookie = await chrome.cookies.get({ url: "https://leetcode.com", name: "LEETCODE_SESSION" });
    if (!cookie) throw new Error("Not logged into LeetCode. Log in at leetcode.com first.");

    const { key, key_id } = await githubFetch(token, `/repos/${repo}/actions/secrets/public-key`);
    await githubFetch(token, `/repos/${repo}/actions/secrets/LEETCODE_SESSION`, {
        method: "PUT",
        body: { encrypted_value: globalThis.encryptSecret(cookie.value, key), key_id }
    });
}