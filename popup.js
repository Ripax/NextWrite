/* =========================================================
   1. ELEMENTS & SETUP
========================================================= */

// --- Layout & Toggles ---
const settingsBtn = document.getElementById("settingsBtn");
const settingsPanel = document.getElementById("settingsPanel");
const closeSettings = document.getElementById("closeSettings");
const popupContainer = document.querySelector(".popup-container");
const themeToggle = document.getElementById("themeToggle");

// --- Status Bar ---
const apiStatusText = document.getElementById("apiStatusText");
// Defines the label span to update text
const statusLabel = apiStatusText.querySelector('.status-label'); 

// --- Inputs & Outputs ---
const inputText = document.getElementById("inputText");
const outputText = document.getElementById("outputText");
const rewriteBtn = document.getElementById("rewriteBtn");
const spinner = document.getElementById("spinner");
const copyBtn = document.getElementById("copyBtn");

// --- Settings: Providers ---
const providerRadios = document.querySelectorAll('input[name="aiProvider"]');
const openaiSettings = document.getElementById("openaiSettings");
const ollamaSettings = document.getElementById("ollamaSettings");

// --- Settings: OpenAI ---
const openaiApiKeyInput = document.getElementById("openaiApiKey");
const saveApiKeyBtn = document.getElementById("saveApiKey");
const chatgptModelSettings = document.getElementById("chatgptModelSettings");
// CORRECTED: Matches your HTML ID "modelSwitcher"
const modelSwitcher = document.getElementById("modelSwitcher"); 

// --- Settings: Ollama ---
const ollamaModelSelect = document.getElementById("ollamaModel");
const temperatureSlider = document.getElementById("temperatureSlider");
const tempValue = document.getElementById("tempValue");

/* =========================================================
   2. STATE VARIABLES
========================================================= */

let activeProvider = "openai";
let currentTemperature = 0.7;
let ollamaWatcher = null;

const OLLAMA_ENDPOINT = "http://localhost:11434/api/generate";
const OLLAMA_TAGS = "http://localhost:11434/api/tags";

/* =========================================================
   3. HELPER FUNCTIONS
========================================================= */

function updateStatus(state, text) {
    // Reset classes
    apiStatusText.classList.remove('error', 'loading');
    
    // Apply state class
    if (state === 'error') apiStatusText.classList.add('error');
    if (state === 'loading') apiStatusText.classList.add('loading');
    
    // Update text content safely
    if (statusLabel) {
        statusLabel.textContent = text;
    }
}

function animatePopupHeight() {
    requestAnimationFrame(() => {
        popupContainer.style.height = "auto";
        popupContainer.style.height = popupContainer.scrollHeight + "px";
    });
}

function applyTheme(theme) {
    const isDark = theme === "dark";
    document.body.classList.toggle("light", !isDark);
    themeToggle.checked = isDark;
}

/* =========================================================
   4. THEME LOGIC
========================================================= */

const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

chrome.storage.local.get(["THEME"], (result) => {
    const savedTheme = result.THEME;
    if (savedTheme) {
        applyTheme(savedTheme);
    } else {
        applyTheme(prefersDark ? "dark" : "light");
    }
});

themeToggle.onchange = () => {
    const theme = themeToggle.checked ? "dark" : "light";
    chrome.storage.local.set({ THEME: theme });
    applyTheme(theme);
};

/* =========================================================
   5. SETTINGS PANELS
========================================================= */

settingsBtn.onclick = () => {
    settingsPanel.classList.toggle("hidden");
    animatePopupHeight();
};

closeSettings.onclick = () => {
    settingsPanel.classList.add("hidden");
    animatePopupHeight();
};

saveApiKeyBtn.onclick = () => {
    const key = openaiApiKeyInput.value.trim();
    if (key) {
        chrome.storage.local.set({ OPENAI_API_KEY: key }, () => {
            const originalText = saveApiKeyBtn.textContent;
            saveApiKeyBtn.textContent = "Saved!";
            setTimeout(() => saveApiKeyBtn.textContent = originalText, 1500);
        });
    }
};

/* =========================================================
   6. PROVIDER SWITCHING
========================================================= */

function updateProviderUI() {
    openaiSettings.classList.toggle("hidden", activeProvider !== "openai");
    chatgptModelSettings.classList.toggle("hidden", activeProvider !== "openai");
    ollamaSettings.classList.toggle("hidden", activeProvider !== "local");

    if (activeProvider === "local") {
        // --- LOCAL ---
        if (!ollamaWatcher) {
            connectOllama(); 
            ollamaWatcher = setInterval(connectOllama, 10000);
        } else {
            const currentModel = ollamaModelSelect.value || "Loading Ollama...";
            updateStatus('ready', currentModel);
        }
    } else {
        // --- OPENAI ---
        if (ollamaWatcher) {
            clearInterval(ollamaWatcher);
            ollamaWatcher = null;
        }
        
        // Grab value from correct selector "modelSwitcher"
        const currentModel = modelSwitcher ? modelSwitcher.value : "gpt-4o-mini";
        updateStatus('ready', currentModel);
    }

    animatePopupHeight();
}

providerRadios.forEach(radio => {
    radio.onchange = () => {
        activeProvider = radio.value;
        chrome.storage.local.set({ AI_PROVIDER: activeProvider });
        updateProviderUI();
    };
});

/* =========================================================
   7. OPENAI MODEL SELECTION
========================================================= */

if (modelSwitcher) {
    modelSwitcher.addEventListener('change', () => {
        const selected = modelSwitcher.value;
        chrome.storage.local.set({ SELECTED_MODEL: selected });
        
        if (activeProvider === "openai") {
            updateStatus('ready', selected);
        }
    });
}

/* =========================================================
   8. OLLAMA LOGIC
========================================================= */

async function connectOllama() {
    try {
        const res = await fetch(OLLAMA_TAGS);
        if (!res.ok) throw new Error("Failed");

        const data = await res.json();
        const models = data.models || [];
        
        const currentSelection = ollamaModelSelect.value;
        ollamaModelSelect.innerHTML = "";
        
        const { OLLAMA_MODEL } = await chrome.storage.local.get("OLLAMA_MODEL");
        let modelFound = false;

        models.forEach(m => {
            const name = m.name || m.model;
            const opt = document.createElement("option");
            opt.value = name;
            opt.textContent = name;
            
            if (name === OLLAMA_MODEL) {
                opt.selected = true;
                modelFound = true;
            }
            ollamaModelSelect.appendChild(opt);
        });

        if (!modelFound && models.length > 0) {
            ollamaModelSelect.value = models[0].name;
            chrome.storage.local.set({ OLLAMA_MODEL: models[0].name });
        }

        updateStatus('ready', ollamaModelSelect.value || "Ollama Ready");
        animatePopupHeight();

    } catch (error) {
        updateStatus('error', "Ollama Offline");
    }
}

ollamaModelSelect.onchange = () => {
    chrome.storage.local.set({ OLLAMA_MODEL: ollamaModelSelect.value });
    updateStatus('ready', ollamaModelSelect.value);
};

/* =========================================================
   9. REWRITE ACTION
========================================================= */

rewriteBtn.onclick = async () => {
    const userText = inputText.value.trim();

    if (!userText) {
        updateStatus('error', "Enter text first");
        setTimeout(() => {
            const currentModel = activeProvider === "openai" ? modelSwitcher.value : ollamaModelSelect.value;
            updateStatus('ready', currentModel);
        }, 2000);
        return;
    }

    spinner.classList.remove("hidden");
    rewriteBtn.disabled = true;
    outputText.value = "";
    copyBtn.classList.add("hidden");
    
    updateStatus('loading', "Generating...");

    const prompt = `Rewrite this professionally:\n\n${userText}`;

    try {
        if (activeProvider === "local") {
            const res = await fetch(OLLAMA_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: ollamaModelSelect.value,
                    prompt,
                    stream: false,
                    options: { temperature: currentTemperature }
                })
            });

            const data = await res.json();
            outputText.value = data.response || "No response";
        } else {
            const response = await chrome.runtime.sendMessage({
                action: "rewrite",
                prompt,
                model: modelSwitcher.value
            });
            
            if (chrome.runtime.lastError) throw new Error(chrome.runtime.lastError.message);
            outputText.value = response?.result || "No response";
        }
        
        const currentModel = activeProvider === "openai" ? modelSwitcher.value : ollamaModelSelect.value;
        updateStatus('ready', currentModel);

    } catch (err) {
        outputText.value = "Error: " + err.message;
        updateStatus('error', "Failed");
    }

    spinner.classList.add("hidden");
    rewriteBtn.disabled = false;
    copyBtn.classList.remove("hidden");
    animatePopupHeight();
};

/* =========================================================
   10. UTILS
========================================================= */

copyBtn.onclick = () => {
    navigator.clipboard.writeText(outputText.value);
    const originalText = copyBtn.textContent;
    copyBtn.textContent = "Copied ✓";
    setTimeout(() => (copyBtn.textContent = originalText), 1200);
};

if (temperatureSlider && tempValue) {
    temperatureSlider.addEventListener("input", () => {
        currentTemperature = Number(temperatureSlider.value);
        tempValue.textContent = `Temperature: ${currentTemperature.toFixed(1)}`;
        chrome.storage.local.set({ OLLAMA_TEMP: currentTemperature });
    });
}

/* =========================================================
   11. INIT
========================================================= */

chrome.storage.local.get(
    ["AI_PROVIDER", "OPENAI_API_KEY", "SELECTED_MODEL", "OLLAMA_TEMP", "THEME"],
    (res) => {
        const savedTheme = res.THEME;
        if (savedTheme) applyTheme(savedTheme);

        openaiApiKeyInput.value = res.OPENAI_API_KEY || "";
        
        if (modelSwitcher) {
            modelSwitcher.value = res.SELECTED_MODEL || "gpt-4o-mini";
        }

        currentTemperature = res.OLLAMA_TEMP ?? 0.7;
        if (temperatureSlider) temperatureSlider.value = currentTemperature;
        if (tempValue) tempValue.textContent = `Temperature: ${currentTemperature}`;

        activeProvider = res.AI_PROVIDER || "openai";
        providerRadios.forEach(r => (r.checked = r.value === activeProvider));

        updateProviderUI(); 
    }
);