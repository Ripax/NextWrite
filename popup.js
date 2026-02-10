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
let currentMode = "rewrite";
let currentTemperature = 0.7;
let ollamaWatcher = null;

const OLLAMA_ENDPOINT = "http://localhost:11434/api/generate";
const OLLAMA_TAGS = "http://localhost:11434/api/tags";

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

saveApiKeyBtn.onclick = () => {
    const key = openaiApiKeyInput.value.trim();
    if (key) {
        chrome.storage.local.set({ OPENAI_API_KEY: key }, () => {
            const originalText = saveApiKeyBtn.textContent;
            saveApiKeyBtn.textContent = "Saved!";
            if (activeProvider === 'openai') checkOpenAIConfig();
            setTimeout(() => saveApiKeyBtn.textContent = originalText, 1500);
        });
    } else {
        chrome.storage.local.remove("OPENAI_API_KEY");
        if (activeProvider === 'openai') updateStatus('error', 'Missing API Key');
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
   8. PROVIDER LOGIC
========================================================= */

function updateProviderUI() {
    openaiSettings.classList.toggle("hidden", activeProvider !== "openai");
    chatgptModelSettings.classList.toggle("hidden", activeProvider !== "openai");
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
        updateStatus('loading', 'Verifying Key...');
        checkOpenAIConfig();
    }
    animatePopupHeight();
}

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

if (modelSwitcher) {
    modelSwitcher.addEventListener('change', () => {
        const selected = modelSwitcher.value;
        chrome.storage.local.set({ SELECTED_MODEL: selected });
        if (activeProvider === "openai") checkOpenAIConfig();
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
            if (activeProvider === 'openai') checkOpenAIConfig();
            else updateStatus('ready', ollamaModelSelect.value);
        }, 2000);
        return;
    }

    spinner.classList.remove("hidden");
    actionBtn.disabled = true;
    outputText.value = "";
    copyBtn.classList.add("hidden");
    
    updateStatus('loading', currentMode === 'rewrite' ? "Rewriting..." : "Thinking...");

    let prompt;
    if (currentMode === 'rewrite') {
        prompt = `Rewrite this professionally, improving grammar and flow:\n\n${userText}`;
    } else {
        prompt = userText;
    }

    try {
        let resultText = "";

        if (activeProvider === "local") {
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
            resultText = data.response || "No response";

        } else {
            const response = await chrome.runtime.sendMessage({
                action: "rewrite",
                prompt: prompt,
                model: modelSwitcher.value
            });
            if (chrome.runtime.lastError) throw new Error(chrome.runtime.lastError.message);
            resultText = response?.result || "No response";
        }
        
        outputText.value = resultText;

        if (resultText && resultText !== "No response") {
            saveToHistory(userText, resultText, currentMode);
        }
        
        if (activeProvider === 'openai') checkOpenAIConfig();
        else updateStatus('ready', ollamaModelSelect.value);

    } catch (err) {
        outputText.value = "Error: " + err.message;
        updateStatus('error', "Failed");
    }

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
    ["AI_PROVIDER", "OPENAI_API_KEY", "SELECTED_MODEL", "OLLAMA_TEMP", "THEME"],
    (res) => {
        const savedTheme = res.THEME;
        if (savedTheme) applyTheme(savedTheme);

        openaiApiKeyInput.value = res.OPENAI_API_KEY || "";
        if (modelSwitcher) modelSwitcher.value = res.SELECTED_MODEL || "gpt-4o-mini";

        currentTemperature = res.OLLAMA_TEMP ?? 0.7;
        if (temperatureSlider) temperatureSlider.value = currentTemperature;
        if (tempValue) tempValue.textContent = `Temperature: ${currentTemperature}`;

        activeProvider = res.AI_PROVIDER || "openai";
        providerRadios.forEach(r => (r.checked = r.value === activeProvider));

        updateProviderUI(); 
        updateModeUI();
    }
);