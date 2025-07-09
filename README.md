# De-Escalator Chrome Extension

This Chrome Extension detects potentially aggressive messages and offers a polite rephrase. It can be extended to collect data and support research on de-escalation in online spaces.

## Setup

1. Copy `config.example.js` to `config.js`
2. Add your OpenAI API key to `config.js`:
   ```js
   const OPENAI_API_KEY = "sk-...your-key-here...";
   ```
3. Do not commit your API key! `config.js` is in `.gitignore`.
