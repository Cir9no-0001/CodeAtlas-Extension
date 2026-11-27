/*
GITHUB API
All GitHub REST calls go through githubFetch: adds headers, throws GitHubError on non-2xx.
*/

const API = "https://api.github.com";

export class GitHubError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

export async function githubFetch(token, path, { method = "GET", body, raw = false } = {}) {
    const res = await fetch(`${API}${path}`, {
        method,
        cache: "no-store",
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2026-03-10",
            ...(body && { "Content-Type": "application/json" })
        },
        body: body && JSON.stringify(body)
    });

    if (!res.ok) {
        let detail = res.statusText;
        try { detail = (await res.json()).message || detail; } catch { /* non-JSON error body */ }
        throw new GitHubError(res.status, `GitHub ${res.status}: ${detail}`);
    }

    if (raw) return res;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
}

export const getUser = (token) => githubFetch(token, "/user");

export const listRepos = (token) =>
    githubFetch(token, "/user/repos?per_page=100&sort=updated");