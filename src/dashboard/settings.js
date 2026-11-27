/*
SETTINGS TAB
Theme picker and custom background image.
*/

const MAX_BG_DIMENSION = 1280;

const themeButtons = document.querySelectorAll(".theme-option");
const preview = document.getElementById("background-preview");
const upload = document.getElementById("background-upload");

let savedBackground = null;   // committed, in storage
let pendingBackground = null; // uploaded, not saved yet

export async function initSettings() {
    themeButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            applyTheme(btn.dataset.theme);
            chrome.storage.local.set({ selectedTheme: btn.dataset.theme });
        });
    });

    preview.addEventListener("click", () => upload.click());
    upload.addEventListener("change", onUpload);
    document.getElementById("background-save-btn").addEventListener("click", saveBackground);
    document.getElementById("background-reset-btn").addEventListener("click", resetBackground);

    const { selectedTheme, customBackground } = await chrome.storage.local.get(["selectedTheme", "customBackground"]);
    applyTheme(selectedTheme || "default");
    if (customBackground) {
        savedBackground = customBackground;
        renderPreview(savedBackground, "saved");
        applyPageBackground(savedBackground);
    }
}

// Undo an unsaved background when leaving the tab.
export function revertUnsavedBackground() {
    if (!pendingBackground) return;
    pendingBackground = null;
    renderPreview(savedBackground, savedBackground ? "saved" : "");
    applyPageBackground(savedBackground);
}

function applyTheme(theme) {
    if (theme === "default") document.body.removeAttribute("data-theme");
    else document.body.setAttribute("data-theme", theme);
    themeButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.theme === theme));
}

async function onUpload() {
    const file = upload.files[0];
    if (!file) return;
    pendingBackground = await compressImage(file, MAX_BG_DIMENSION);
    renderPreview(pendingBackground, "unsaved");
    applyPageBackground(pendingBackground); // live preview until saved or reverted
    upload.value = ""; // allow re-selecting the same file
}

async function saveBackground() {
    if (!pendingBackground) return;
    await chrome.storage.local.set({ customBackground: pendingBackground });
    savedBackground = pendingBackground;
    pendingBackground = null;
    renderPreview(savedBackground, "saved");
}

async function resetBackground() {
    await chrome.storage.local.remove("customBackground");
    savedBackground = null;
    pendingBackground = null;
    renderPreview(null, "");
    applyPageBackground(null);
}

function applyPageBackground(dataUrl) {
    Object.assign(document.body.style, {
        backgroundImage: dataUrl ? `url(${dataUrl})` : "",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed"
    });
}

function renderPreview(dataUrl, state) {
    preview.classList.remove("unsaved", "saved");
    if (state) preview.classList.add(state);
    preview.style.backgroundImage = dataUrl ? `url(${dataUrl})` : "";
    preview.querySelector(".background-placeholder").hidden = !!dataUrl;
}

// Shrink to 1280px max and save as JPEG so it fits in storage.
function compressImage(file, maxDimension) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
            const canvas = document.createElement("canvas");
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(img.src);
            resolve(canvas.toDataURL("image/jpeg", 0.8));
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
    });
}