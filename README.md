# 🕊️ De-Escalator Chrome Extension

A Chrome extension that helps prevent online conflicts by detecting escalating language in social media posts and comments, then offering constructive alternatives.

## ✨ Features

- ✅ **Real-time Escalation Detection** - Identifies potentially aggressive or inflammatory language as you type
- ✅ **Smart Rephrasing** - Offers de-escalated alternatives using the Emotional-Cognitive Psycholinguistic Model (ECPM)
- ✅ **One-Click Replacement** - Replace escalating text with a calmer version instantly
- ✅ **Works Across Platforms** - Supports Twitter/X, Facebook, and other social media platforms
- ✅ **Privacy-First** - All processing happens locally in your browser, no data is sent to external servers

## 🎯 How It Works

The extension uses the **Emotional-Cognitive Psycholinguistic Model (ECPM)** to detect two main dimensions of escalation:

1. **Cognitive Dimension**: Absolute truths vs. Subjective statements
2. **Emotional Dimension**: Blame vs. Self-accountability

When escalating language is detected, it transforms:
- **"You are always wrong!"** → **"I often disagree with your perspective."**
- **"You never listen to me!"** → **"I rarely see you listening to me."**
- **"This is ridiculous!"** → **"I find that challenging to understand."**

## 📦 Installation

### Option 1: Install from Chrome Web Store (Coming Soon)
*The extension will be available on the Chrome Web Store soon.*

### Option 2: Install Manually (Developer Mode)

1. **Download the Extension**
   - Download this repository as a ZIP file and extract it
   - Or clone the repository: `git clone [repository-url]`

2. **Open Chrome Extensions Page**
   - Go to `chrome://extensions/` in your Chrome browser
   - Or click the three dots menu → More Tools → Extensions

3. **Enable Developer Mode**
   - Toggle "Developer mode" in the top-right corner

4. **Load the Extension**
   - Click "Load unpacked"
   - Select the folder containing the extension files
   - The De-Escalator icon should appear in your extensions toolbar

## 🚀 Usage

1. **Navigate to a Social Media Site**
   - Go to Twitter/X, Facebook, or any platform with text input

2. **Start Typing**
   - Begin composing a post or comment

3. **Watch for Warnings**
   - If escalating language is detected, a warning tooltip appears in the bottom-right

4. **Review the Suggestion**
   - Read the suggested rephrased version

5. **Apply or Dismiss**
   - Click **"Rephrase"** to replace your text with the calmer version
   - Click **"Dismiss"** to keep your original text

## 🛠️ Technical Details

- **No API Keys Required** - All detection and rephrasing happens locally
- **Pattern-Based Detection** - Uses regex patterns to identify escalating language
- **Multiple Fallback Methods** - Ensures text replacement works across different platforms
- **Minimal Permissions** - Only requires access to web pages you're actively using

## 📁 Files Structure

```
comment-insight-extension/
├── manifest.json          # Extension configuration
├── content.js            # Main detection and rephrasing logic
├── config.js             # Configuration file (if needed)
├── styles.css            # Tooltip and UI styling
├── popup.html            # Extension popup (optional)
├── icon16.png            # Extension icon (16x16)
├── icon48.png            # Extension icon (48x48)
├── icon128.png           # Extension icon (128x128)
└── README.md             # This file
```

## 🤝 Contributing

Contributions are welcome! This extension is designed to help reduce online conflicts and promote healthier discourse.


## 🔬 Research Foundation

Based on research in political discourse de-escalation and the Emotional-Cognitive Psycholinguistic Model (ECPM).

---

**Note**: This extension is designed to help users communicate more constructively. It does not censor or prevent you from posting - it simply offers alternatives when escalating language is detected.
