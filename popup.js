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
const statusLabel = apiStatusText.querySelector('.status-label');

// --- Main Interface ---
const inputText = document.getElementById("inputText");
const outputText = document.getElementById("outputText");
const actionBtn = document.getElementById("actionBtn"); // Main Rewrite/Solve button
const spinner = document.getElementById("spinner");
const copyBtn = document.getElementById("copyBtn");

// --- Mode Toggle (Sliding Switch) ---
const appModeToggle = document.getElementById("appModeToggle"); // Checkbox for Rewrite/Solve

// --- Settings: Providers ---
const providerRadios = document.querySelectorAll('input[name="aiProvider"]');
const openaiSettings = document.getElementById("openaiSettings");
const ollamaSettings = document.getElementById("ollamaSettings");

// --- Settings: OpenAI ---
const openaiApiKeyInput = document.getElementById("openaiApiKey");
const saveApiKeyBtn = document.getElementById("saveApiKey");
const chatgptModelSettings = document.getElementById("chatgptModelSettings");
const modelSwitcher = document.getElementById("modelSwitcher");

// --- Settings: Ollama ---
const ollamaModelSelect = document.getElementById("ollamaModel");
const temperatureSlider = document.getElementById("temperatureSlider");
const tempValue = document.getElementById("tempValue");

/* =========================================================
    2. STATE VARIABLES
========================================================= */

let activeProvider = "openai";
let currentMode = "rewrite"; // 'rewrite' or 'solve'
let currentTemperature = 0.7;
let ollamaWatcher = null;

const OLLAMA_ENDPOINT = "http://localhost:11434/api/generate";
const OLLAMA_TAGS = "http://localhost:11434/api/tags";

/* =========================================================
    3. HELPER FUNCTIONS
========================================================= */

/**
 * Updates status bar state (color) and text
 */
function updateStatus(state, text) {
    apiStatusText.classList.remove('error', 'loading');
    
    if (state === 'error') apiStatusText.classList.add('error');
    if (state === 'loading') apiStatusText.classList.add('loading');
    
    if (statusLabel) {
        statusLabel.textContent = text;
        statusLabel.title = text; // Tooltip for long text
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
            // Re-check status immediately if OpenAI is active
            if (activeProvider === 'openai') checkOpenAIConfig();
            setTimeout(() => saveApiKeyBtn.textContent = originalText, 1500);
        });
    } else {
        chrome.storage.local.remove("OPENAI_API_KEY");
        if (activeProvider === 'openai') updateStatus('error', 'Missing API Key');
    }
};

/* =========================================================
    6. MODE SWITCHING (Sliding Toggle Logic)
========================================================= */

if (appModeToggle) {
    appModeToggle.addEventListener('change', () => {
        // If checked -> Solve Mode. If unchecked -> Rewrite Mode.
        currentMode = appModeToggle.checked ? 'solve' : 'rewrite';
        updateModeUI();
    });
}

function updateModeUI() {
    if (currentMode === 'rewrite') {
        actionBtn.textContent = "Rewrite Text";
        inputText.placeholder = "Paste text here to rewrite...";
    } else {
        actionBtn.textContent = "Solve / Ask";
        inputText.placeholder = "Ask a question or paste a problem to solve...";
    }
}

/* =========================================================
    7. PROVIDER LOGIC & STATUS
========================================================= */

function updateProviderUI() {
    // Toggle Visibility
    openaiSettings.classList.toggle("hidden", activeProvider !== "openai");
    chatgptModelSettings.classList.toggle("hidden", activeProvider !== "openai");
    ollamaSettings.classList.toggle("hidden", activeProvider !== "local");

    if (activeProvider === "local") {
        // --- LOCAL OLLAMA ---
        if (ollamaWatcher) clearInterval(ollamaWatcher);
        
        updateStatus('loading', 'Connecting...');
        connectOllama();
        // Poll every 10s to keep status "real"
        ollamaWatcher = setInterval(connectOllama, 10000);
    } else {
        // --- OPENAI ---
        if (ollamaWatcher) {
            clearInterval(ollamaWatcher);
            ollamaWatcher = null;
        }
        updateStatus('loading', 'Verifying Key...');
        checkOpenAIConfig();
    }
    animatePopupHeight();
}

// Helper: Verifies OpenAI Key exists and updates status
function checkOpenAIConfig() {
    chrome.storage.local.get(["OPENAI_API_KEY", "SELECTED_MODEL"], (res) => {
        if (!res.OPENAI_API_KEY) {
            updateStatus('error', 'Missing API Key');
        } else {
            const model = modelSwitcher ? modelSwitcher.value : "gpt-4o-mini";
            updateStatus('ready', model);
        }
    });
}

// Listener for Provider Radio Buttons
providerRadios.forEach(radio => {
    radio.onchange = () => {
        activeProvider = radio.value;
        chrome.storage.local.set({ AI_PROVIDER: activeProvider });
        updateProviderUI();
    };
});

// Listener for OpenAI Model Dropdown
if (modelSwitcher) {
    modelSwitcher.addEventListener('change', () => {
        const selected = modelSwitcher.value;
        chrome.storage.local.set({ SELECTED_MODEL: selected });
        // Update status immediately if active
        if (activeProvider === "openai") checkOpenAIConfig();
    });
}

/* =========================================================
    8. OLLAMA LOGIC
========================================================= */

async function connectOllama() {
    try {
        const res = await fetch(OLLAMA_TAGS);
        if (!res.ok) throw new Error("Ollama Error");

        const data = await res.json();
        const models = data.models || [];
        
        if (models.length > 0) {
            // Save current selection to restore
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

            // Default to first model if preference not found
            if (!modelFound && models.length > 0) {
                ollamaModelSelect.value = models[0].name;
                chrome.storage.local.set({ OLLAMA_MODEL: models[0].name });
            }
            // Green Status
            updateStatus('ready', ollamaModelSelect.value);
        } else {
            updateStatus('loading', 'No Models Found');
        }
        animatePopupHeight();

    } catch (error) {
        // Red Status
        updateStatus('error', 'Ollama Offline');
    }
}

ollamaModelSelect.onchange = () => {
    chrome.storage.local.set({ OLLAMA_MODEL: ollamaModelSelect.value });
    updateStatus('ready', ollamaModelSelect.value);
};

/* =========================================================
    9. MAIN ACTION (REWRITE / SOLVE)
========================================================= */

actionBtn.onclick = async () => {
    const userText = inputText.value.trim();

    if (!userText) {
        updateStatus('error', "Enter text first");
        setTimeout(() => {
            // Restore correct status
            if (activeProvider === 'openai') checkOpenAIConfig();
            else updateStatus('ready', ollamaModelSelect.value);
        }, 2000);
        return;
    }

    // UI Loading State
    spinner.classList.remove("hidden");
    actionBtn.disabled = true;
    outputText.value = "";
    copyBtn.classList.add("hidden");
    
    // Status Bar Message
    updateStatus('loading', currentMode === 'rewrite' ? "Rewriting..." : "Thinking...");

    // Construct Prompt based on Mode
    let prompt;
    if (currentMode === 'rewrite') {
        prompt = `Rewrite this professionally, improving grammar and flow:\n\n${userText}`;
    } else {
        prompt = userText; // Solve mode sends raw input
    }

    try {
        if (activeProvider === "local") {
            // --- OLLAMA REQUEST ---
            const res = await fetch(OLLAMA_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: ollamaModelSelect.value,
                    prompt: prompt,
                    stream: false,
                    options: { temperature: currentTemperature }
                })
            });
            
            if(!res.ok) throw new Error("Ollama connection failed");
            const data = await res.json();
            outputText.value = data.response || "No response";

        } else {
            // --- OPENAI REQUEST (via Background) ---
            const response = await chrome.runtime.sendMessage({
                action: "rewrite", // Keeping action as 'rewrite' (or update bg script to handle generic 'generate')
                prompt: prompt,
                model: modelSwitcher.value
            });
            
            if (chrome.runtime.lastError) throw new Error(chrome.runtime.lastError.message);
            outputText.value = response?.result || "No response";
        }
        
        // Success: Restore Status
        if (activeProvider === 'openai') checkOpenAIConfig();
        else updateStatus('ready', ollamaModelSelect.value);

    } catch (err) {
        outputText.value = "Error: " + err.message;
        updateStatus('error', "Failed");
    }

    // Cleanup UI
    spinner.classList.add("hidden");
    actionBtn.disabled = false;
    copyBtn.classList.remove("hidden");
    animatePopupHeight();
};

/* =========================================================
    10. UTILS (Copy & Temp)
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
    11. INITIALIZATION
========================================================= */

chrome.storage.local.get(
    ["AI_PROVIDER", "OPENAI_API_KEY", "SELECTED_MODEL", "OLLAMA_TEMP", "THEME"],
    (res) => {
        // 1. Theme
        const savedTheme = res.THEME;
        if (savedTheme) applyTheme(savedTheme);

        // 2. Settings Inputs
        openaiApiKeyInput.value = res.OPENAI_API_KEY || "";
        if (modelSwitcher) modelSwitcher.value = res.SELECTED_MODEL || "gpt-4o-mini";

        // 3. Temperature
        currentTemperature = res.OLLAMA_TEMP ?? 0.7;
        if (temperatureSlider) temperatureSlider.value = currentTemperature;
        if (tempValue) tempValue.textContent = `Temperature: ${currentTemperature}`;

        // 4. Provider Selection
        activeProvider = res.AI_PROVIDER || "openai";
        providerRadios.forEach(r => (r.checked = r.value === activeProvider));

        // 5. Start!
        updateProviderUI(); 
        updateModeUI(); // Sets button text correctly on load
    }
);