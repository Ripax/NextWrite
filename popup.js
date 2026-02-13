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

// --- Settings: Tabs & History ---
const tabConfig = document.getElementById("tabConfig");
const tabHistory = document.getElementById("tabHistory");
const settingsConfig = document.getElementById("settingsConfig");
const settingsHistory = document.getElementById("settingsHistory");
const historyList = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");

// --- Main Interface ---
const inputText = document.getElementById("inputText");
const outputText = document.getElementById("outputText");
const actionBtn = document.getElementById("actionBtn"); 
const spinner = document.getElementById("spinner");
const copyBtn = document.getElementById("copyBtn");
const appModeToggle = document.getElementById("appModeToggle");

// --- Settings: Providers ---
const providerRadios = document.querySelectorAll('input[name="aiProvider"]');
const openrouterSettings = document.getElementById("openrouterSettings");
const ollamaSettings = document.getElementById("ollamaSettings");

// --- Settings: OpenRouter ---
const openrouterApiKeyInput = document.getElementById("openrouterApiKey");
const saveApiKeyBtn = document.getElementById("saveApiKey");
const openrouterModelSettings = document.getElementById("openrouterModelSettings");
const openrouterModelSelect = document.getElementById("openrouterModel");

// --- Settings: Visuals ---
const spinnerStyleSelector = document.getElementById("spinnerStyleSelector");

// --- Settings: Ollama ---
const ollamaModelSelect = document.getElementById("ollamaModel");
const temperatureSlider = document.getElementById("temperatureSlider");
const tempValue = document.getElementById("tempValue");

/* =========================================================
   2. STATE VARIABLES
========================================================= */

let activeProvider = "openrouter"; 
let currentMode = "rewrite";
let currentTemperature = 0.7;
let currentSpinnerStyle = "quantum"; // Default
let ollamaWatcher = null;

// --- API ENDPOINTS ---
const OLLAMA_ENDPOINT = "http://localhost:11434/api/generate";
const OLLAMA_TAGS = "http://localhost:11434/api/tags";
const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODELS_ENDPOINT = "https://openrouter.ai/api/v1/models";

/* =========================================================
   3. HELPER FUNCTIONS
========================================================= */

function updateStatus(state, text) {
    apiStatusText.classList.remove('error', 'loading');
    
    if (state === 'error') apiStatusText.classList.add('error');
    if (state === 'loading') apiStatusText.classList.add('loading');
    
    if (statusLabel) {
        statusLabel.textContent = text;
        statusLabel.title = text;
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
    if(themeToggle) themeToggle.checked = isDark;
}

// ✅ NEW: Apply Spinner Style (Updated to include burst and liquid)
function applySpinnerStyle(style) {
    if (!spinner) return;
    // Remove all possible spinner classes but keep 'spinner' and 'hidden'
    spinner.classList.remove("quantum", "wave", "ring", "burst", "liquid");
    
    // Add the selected style
    spinner.classList.add(style);
    currentSpinnerStyle = style;
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
   5. SETTINGS PANELS & TABS
========================================================= */

settingsBtn.onclick = () => {
    settingsPanel.classList.toggle("hidden");
    animatePopupHeight();
};

closeSettings.onclick = () => {
    settingsPanel.classList.add("hidden");
    animatePopupHeight();
};

tabConfig.onclick = () => {
    tabConfig.classList.add("active");
    tabHistory.classList.remove("active");
    settingsConfig.classList.remove("hidden");
    settingsHistory.classList.add("hidden");
};

tabHistory.onclick = () => {
    tabHistory.classList.add("active");
    tabConfig.classList.remove("active");
    settingsHistory.classList.remove("hidden");
    settingsConfig.classList.add("hidden");
    renderHistory();
};

// --- Spinner Selector Listener ---
if (spinnerStyleSelector) {
    spinnerStyleSelector.addEventListener("change", () => {
        const style = spinnerStyleSelector.value;
        applySpinnerStyle(style);
        chrome.storage.local.set({ SPINNER_STYLE: style });
        
        // Brief preview
        spinner.classList.remove("hidden");
        setTimeout(() => spinner.classList.add("hidden"), 1000);
    });
}

saveApiKeyBtn.onclick = () => {
    const key = openrouterApiKeyInput.value.trim();
    if (key) {
        chrome.storage.local.set({ OPENROUTER_API_KEY: key }, () => {
            const originalText = saveApiKeyBtn.textContent;
            saveApiKeyBtn.textContent = "Saved!";
            
            if (activeProvider === 'openrouter') {
                updateStatus('loading', 'Fetching Models...');
                fetchOpenRouterModels(key);
            }
            
            setTimeout(() => saveApiKeyBtn.textContent = originalText, 1500);
        });
    } else {
        chrome.storage.local.remove("OPENROUTER_API_KEY");
        if (activeProvider === 'openrouter') updateStatus('error', 'Missing API Key');
    }
};

/* =========================================================
   6. HISTORY MANAGEMENT
========================================================= */

function saveToHistory(prompt, response, mode) {
    chrome.storage.local.get(["HISTORY"], (res) => {
        let history = res.HISTORY || [];
        const newItem = {
            id: Date.now(),
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            mode: mode,
            prompt: prompt,
            response: response
        };
        history.unshift(newItem);
        if (history.length > 20) history.pop();
        chrome.storage.local.set({ HISTORY: history });
    });
}

function renderHistory() {
    chrome.storage.local.get(["HISTORY"], (res) => {
        const history = res.HISTORY || [];
        historyList.innerHTML = "";

        if (history.length === 0) {
            historyList.innerHTML = '<div class="empty-history">No history yet</div>';
            return;
        }

        history.forEach(item => {
            const el = document.createElement("div");
            el.className = "history-item";
            el.innerHTML = `
                <div class="history-meta">
                    <span>${item.mode}</span>
                    <span>${item.date} ${item.time}</span>
                </div>
                <div class="history-prompt">"${item.prompt}"</div>
                <div class="history-response">${item.response}</div>
            `;
            el.onclick = () => {
                inputText.value = item.prompt;
                outputText.value = item.response;
                settingsPanel.classList.add("hidden");
                copyBtn.classList.remove("hidden");
            };
            historyList.appendChild(el);
        });
    });
}

clearHistoryBtn.onclick = () => {
    chrome.storage.local.remove("HISTORY", () => {
        renderHistory();
        updateStatus('ready', 'History Cleared');
    });
};

/* =========================================================
   7. MODE SWITCHING
========================================================= */

if (appModeToggle) {
    appModeToggle.addEventListener('change', () => {
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
   8. PROVIDER LOGIC & OPENROUTER
========================================================= */

function updateProviderUI() {
    openrouterSettings.classList.toggle("hidden", activeProvider !== "openrouter");
    openrouterModelSettings.classList.toggle("hidden", activeProvider !== "openrouter");
    ollamaSettings.classList.toggle("hidden", activeProvider !== "local");

    if (activeProvider === "local") {
        if (ollamaWatcher) clearInterval(ollamaWatcher);
        updateStatus('loading', 'Connecting...');
        connectOllama();
        ollamaWatcher = setInterval(connectOllama, 10000);
    } else {
        if (ollamaWatcher) {
            clearInterval(ollamaWatcher);
            ollamaWatcher = null;
        }
        checkOpenRouterConfig();
    }
    animatePopupHeight();
}

function checkOpenRouterConfig() {
    chrome.storage.local.get(["OPENROUTER_API_KEY", "OPENROUTER_MODEL"], (res) => {
        if (!res.OPENROUTER_API_KEY) {
            updateStatus('error', 'Missing API Key');
            openrouterModelSelect.innerHTML = '<option disabled selected>Enter API Key first</option>';
        } else {
            if (openrouterModelSelect.options.length <= 1) {
                fetchOpenRouterModels(res.OPENROUTER_API_KEY, res.OPENROUTER_MODEL);
            } else {
                updateStatus('ready', openrouterModelSelect.value);
            }
        }
    });
}

async function fetchOpenRouterModels(apiKey, savedModel = null) {
    try {
        const res = await fetch(OPENROUTER_MODELS_ENDPOINT, {
            headers: { "Authorization": `Bearer ${apiKey}` }
        });
        
        if (!res.ok) throw new Error("Failed to load models");
        
        const data = await res.json();
        const models = data.data.sort((a, b) => a.name.localeCompare(b.name));
        
        openrouterModelSelect.innerHTML = "";
        let isSelected = false;

        models.forEach(model => {
            const option = document.createElement("option");
            option.value = model.id;
            option.textContent = model.name || model.id; 
            
            if (savedModel && model.id === savedModel) {
                option.selected = true;
                isSelected = true;
            }
            openrouterModelSelect.appendChild(option);
        });

        if (!isSelected && models.length > 0) {
            openrouterModelSelect.selectedIndex = 0;
            chrome.storage.local.set({ OPENROUTER_MODEL: models[0].id });
        }

        updateStatus('ready', openrouterModelSelect.value);

    } catch (error) {
        console.error(error);
        openrouterModelSelect.innerHTML = '<option disabled>Error loading models</option>';
        updateStatus('error', 'Model Fetch Failed');
    }
}

providerRadios.forEach(radio => {
    radio.onchange = () => {
        activeProvider = radio.value;
        chrome.storage.local.set({ AI_PROVIDER: activeProvider });
        updateProviderUI();
    };
});

if (openrouterModelSelect) {
    openrouterModelSelect.addEventListener('change', () => {
        const selected = openrouterModelSelect.value;
        chrome.storage.local.set({ OPENROUTER_MODEL: selected });
        updateStatus('ready', selected);
    });
}

/* =========================================================
   9. OLLAMA LOGIC
========================================================= */

async function connectOllama() {
    try {
        const res = await fetch(OLLAMA_TAGS);
        if (!res.ok) throw new Error("Ollama Error");

        const data = await res.json();
        const models = data.models || [];
        
        if (models.length > 0) {
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
            updateStatus('ready', ollamaModelSelect.value);
        } else {
            updateStatus('loading', 'No Models Found');
        }
        animatePopupHeight();

    } catch (error) {
        updateStatus('error', 'Ollama Offline');
    }
}

ollamaModelSelect.onchange = () => {
    chrome.storage.local.set({ OLLAMA_MODEL: ollamaModelSelect.value });
    updateStatus('ready', ollamaModelSelect.value);
};

/* =========================================================
   10. MAIN ACTION
========================================================= */

actionBtn.onclick = async () => {
    const userText = inputText.value.trim();

    if (!userText) {
        updateStatus('error', "Enter text first");
        setTimeout(() => {
            if (activeProvider === 'openrouter') checkOpenRouterConfig();
            else updateStatus('ready', ollamaModelSelect.value);
        }, 2000);
        return;
    }

    // Show Spinner
    spinner.classList.remove("hidden");
    
    actionBtn.disabled = true;
    outputText.value = "";
    copyBtn.classList.add("hidden");
    
    updateStatus('loading', currentMode === 'rewrite' ? "Rewriting..." : "Thinking...");

    let promptSystem = "";
    let promptUser = userText;

    if (currentMode === 'rewrite') {
        promptSystem = "You are a professional editor. Rewrite the following text to improve grammar, flow, and clarity while maintaining the original meaning.";
    } else {
        promptSystem = "You are a helpful AI assistant. Solve the user's problem or answer their question concisely.";
    }

    try {
        let resultText = "";

        if (activeProvider === "local") {
            const promptFull = `${promptSystem}\n\nUser Text:\n${userText}`;
            const res = await fetch(OLLAMA_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: ollamaModelSelect.value,
                    prompt: promptFull,
                    stream: false,
                    options: { temperature: currentTemperature }
                })
            });
            
            if(!res.ok) throw new Error("Ollama connection failed");
            const data = await res.json();
            resultText = data.response || "No response";

        } else {
            const { OPENROUTER_API_KEY, OPENROUTER_MODEL } = await chrome.storage.local.get(["OPENROUTER_API_KEY", "OPENROUTER_MODEL"]);
            
            if (!OPENROUTER_API_KEY) throw new Error("API Key missing");

            const res = await fetch(OPENROUTER_ENDPOINT, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://github.com/HTMLDigger", 
                    "X-Title": "NexText Extension"
                },
                body: JSON.stringify({
                    model: OPENROUTER_MODEL || "openai/gpt-3.5-turbo",
                    messages: [
                        { role: "system", content: promptSystem },
                        { role: "user", content: promptUser }
                    ],
                    temperature: currentTemperature
                })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error?.message || "OpenRouter Error");
            }

            const data = await res.json();
            resultText = data.choices?.[0]?.message?.content || "No response";
        }
        
        outputText.value = resultText;

        if (resultText && resultText !== "No response") {
            saveToHistory(userText, resultText, currentMode);
        }
        
        if (activeProvider === 'openrouter') updateStatus('ready', openrouterModelSelect.value);
        else updateStatus('ready', ollamaModelSelect.value);

    } catch (err) {
        console.error(err);
        outputText.value = "Error: " + err.message;
        updateStatus('error', "Failed");
    }

    // Hide Spinner
    spinner.classList.add("hidden");
    
    actionBtn.disabled = false;
    copyBtn.classList.remove("hidden");
    animatePopupHeight();
};

/* =========================================================
   11. UTILS
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
   12. INIT
========================================================= */

chrome.storage.local.get(
    ["AI_PROVIDER", "OPENROUTER_API_KEY", "OPENROUTER_MODEL", "OLLAMA_TEMP", "THEME", "SPINNER_STYLE"],
    (res) => {
        const savedTheme = res.THEME;
        if (savedTheme) applyTheme(savedTheme);

        openrouterApiKeyInput.value = res.OPENROUTER_API_KEY || "";
        
        currentTemperature = res.OLLAMA_TEMP ?? 0.7;
        if (temperatureSlider) temperatureSlider.value = currentTemperature;
        if (tempValue) tempValue.textContent = `Temperature: ${currentTemperature}`;

        // Initialize Spinner Style
        const savedSpinner = res.SPINNER_STYLE || "quantum";
        applySpinnerStyle(savedSpinner);
        if (spinnerStyleSelector) spinnerStyleSelector.value = savedSpinner;

        activeProvider = res.AI_PROVIDER || "openrouter";
        providerRadios.forEach(r => (r.checked = r.value === activeProvider));

        updateProviderUI(); 
        updateModeUI();
    }
);