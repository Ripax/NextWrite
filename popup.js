/* =========================================================
   1. ELEMENTS & SETUP
========================================================= */

const settingsBtn = document.getElementById("settingsBtn");
const settingsPanel = document.getElementById("settingsPanel");
const closeSettings = document.getElementById("closeSettings");
const popupContainer = document.querySelector(".popup-container");
const themeToggle = document.getElementById("themeToggle");

const apiStatusText = document.getElementById("apiStatusText");
const statusLabel = apiStatusText.querySelector('.status-label'); 

const inputText = document.getElementById("inputText");
const outputText = document.getElementById("outputText");
const rewriteBtn = document.getElementById("rewriteBtn");
const spinner = document.getElementById("spinner");
const copyBtn = document.getElementById("copyBtn");

const providerRadios = document.querySelectorAll('input[name="aiProvider"]');
const openaiSettings = document.getElementById("openaiSettings");
const ollamaSettings = document.getElementById("ollamaSettings");

const openaiApiKeyInput = document.getElementById("openaiApiKey");
const saveApiKeyBtn = document.getElementById("saveApiKey");
const chatgptModelSettings = document.getElementById("chatgptModelSettings");
const modelSwitcher = document.getElementById("modelSwitcher"); 

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
            // Re-check status after saving
            if(activeProvider === 'openai') checkOpenAIConfig();
            setTimeout(() => saveApiKeyBtn.textContent = originalText, 1500);
        });
    } else {
        // If user clears the key
        chrome.storage.local.remove("OPENAI_API_KEY");
        if(activeProvider === 'openai') updateStatus('error', 'Missing API Key');
    }
};

/* =========================================================
   6. PROVIDER SWITCHING & REAL-TIME CHECKS
========================================================= */

function updateProviderUI() {
    // 1. Toggle UI
    openaiSettings.classList.toggle("hidden", activeProvider !== "openai");
    chatgptModelSettings.classList.toggle("hidden", activeProvider !== "openai");
    ollamaSettings.classList.toggle("hidden", activeProvider !== "local");

    // 2. Logic & Status Updates
    if (activeProvider === "local") {
        // --- LOCAL ---
        if (ollamaWatcher) clearInterval(ollamaWatcher);
        
        // Show "Connecting..." Yellow immediately
        updateStatus('loading', 'Connecting...');
        
        // Check immediately
        connectOllama();
        // Poll every 10 seconds
        ollamaWatcher = setInterval(connectOllama, 10000);

    } else {
        // --- OPENAI ---
        if (ollamaWatcher) {
            clearInterval(ollamaWatcher);
            ollamaWatcher = null;
        }
        
        // Show "Verifying..." Yellow immediately
        updateStatus('loading', 'Verifying Key...');
        checkOpenAIConfig();
    }

    animatePopupHeight();
}

// New Function: Check if OpenAI Key exists
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
            // Re-verify key when model changes just to be safe
            checkOpenAIConfig();
        }
    });
}

/* =========================================================
   8. OLLAMA LOGIC (Real Connection Check)
========================================================= */

async function connectOllama() {
    try {
        const res = await fetch(OLLAMA_TAGS);
        
        // If network request failed (404/500), throw error
        if (!res.ok) throw new Error("Ollama Error");

        const data = await res.json();
        const models = data.models || [];
        
        // --- SUCCESS: Update UI to Green ---
        // (Only rebuild dropdown if we actually have models)
        if (models.length > 0) {
             // Save current selection to restore it after rebuilding options
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
            
            // GREEN STATUS
            updateStatus('ready', ollamaModelSelect.value);
        } else {
            // Connected but no models installed
            updateStatus('loading', 'No Models Found');
        }
        
        animatePopupHeight();

    } catch (error) {
        // --- FAIL: Update UI to Red ---
        updateStatus('error', 'Ollama Offline');
        // Hide settings if we can't connect? Optional.
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
            // Restore correct status based on provider
            if (activeProvider === 'openai') checkOpenAIConfig();
            else connectOllama();
        }, 2000);
        return;
    }

    spinner.classList.remove("hidden");
    rewriteBtn.disabled = true;
    outputText.value = "";
    copyBtn.classList.add("hidden");
    
    // Set status to Yellow "Generating..."
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
            
            if(!res.ok) throw new Error("Ollama connection failed");

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
        
        // Success: Restore Green Status
        if (activeProvider === 'openai') checkOpenAIConfig();
        else updateStatus('ready', ollamaModelSelect.value);

    } catch (err) {
        outputText.value = "Error: " + err.message;
        updateStatus('error', "Generation Failed");
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

        // Trigger initial check
        updateProviderUI(); 
    }
);