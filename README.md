# 🤖 AI Rewrite Assistant

**AI Rewrite Assistant** is a lightweight browser popup tool that helps you rewrite text instantly using either **ChatGPT (OpenAI)** or a **local Ollama model**.  
Built for speed, privacy, and flexibility — with theme toggle, templates, and provider switching baked in.

> 💙 Love from @HTMLDigger

---

## ✨ Features

- 🔁 Instant text rewriting
- 🤖 ChatGPT (OpenAI) support
- 🖥️ Local AI support via Ollama
- 🎛️ Model switcher (GPT-4o / GPT-4o Mini)
- 🧠 Template-based rewriting
- 🌗 Light / Dark theme toggle
- ⚙️ Built-in settings panel
- 📋 One-click copy output
- 🔐 Secure API key storage
- 🧩 Clean and minimal popup UI

---

## 🧰 Tech Stack

- HTML5
- CSS3
- Vanilla JavaScript
- OpenAI API
- Ollama (local LLM runtime)

---

## 📦 Project Structure

.
├── popup.html # Main UI layout
├── popup.js # Core logic & API handling
├── styles.css # Styling & themes
├── icons/
│ └── ai.png # Extension icon
└── README.md

---

## 🚀 Getting Started

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/your-username/ai-rewrite-assistant.git
cd ai-rewrite-assistant
```

2️⃣ Load as a Browser Extension (Chrome / Edge) 1. Open chrome://extensions 2. Enable Developer mode 3. Click Load unpacked 4. Select the project folder

The popup will now appear in your browser toolbar.

⚙️ Configuration
🔑 OpenAI (ChatGPT) 1. Open Settings (⚙️) 2. Select ChatGPT 3. Paste your OpenAI API Key 4. Click Save

Choose a model:
GPT-4o Mini
GPT-4o

🖥️ Local AI (Ollama)
Install Ollama from
👉 https://ollama.com

    Start Ollama:

```bash
    ollama serve
```

    Pull a model:

```bash
    ollama pull llama3
```

    Open Settings

```bash
    Select Local
    Choose an available Ollama model
    Models are automatically detected from your local Ollama instance.
```

📝 Usage
Paste text into the Input box
(Optional) Select a Template
Click Rewrite
Review the rewritten output
Click Copy to use it anywhere

🎨 Themes
Toggle Light / Dark mode using the switch in the status bar
Theme preference is saved automatically

🔒 Privacy
No text is stored or logged
API keys remain local
Local mode never sends data outside your machine

🛠️ Planned Improvements
Streaming responses
Token usage display
Per-model temperature control
Rewrite history
Keyboard shortcuts

📜 License
MIT License
❤️ Credits
Built with passion by @HTMLDigger

```

```
