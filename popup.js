// Popup script for De-Escalator extension
// Handles API key configuration

document.addEventListener('DOMContentLoaded', async () => {
  const apiKeyInput = document.getElementById('apiKeyInput');
  const saveButton = document.getElementById('saveApiKey');
  const clearButton = document.getElementById('clearApiKey');
  const statusText = document.getElementById('apiKeyStatus');
  
  // Load existing API key on popup open
  try {
    const storage = await chrome.storage.local.get(['openaiApiKey']);
    if (storage.openaiApiKey) {
      // Show masked version: show first 7 chars and last 4 chars
      const key = storage.openaiApiKey;
      if (key.length > 11) {
        apiKeyInput.value = key.substring(0, 7) + '•'.repeat(Math.min(key.length - 11, 20)) + key.substring(key.length - 4);
      } else {
        apiKeyInput.value = '•'.repeat(key.length);
      }
      statusText.textContent = '✅ API key configured';
      statusText.style.color = '#388e3c';
    } else {
      statusText.textContent = '💡 Add your OpenAI API key for AI-powered rephrasing';
      statusText.style.color = '#666';
    }
  } catch (e) {
    console.error('Error loading API key:', e);
    statusText.textContent = '⚠️ Error loading settings';
    statusText.style.color = '#d32f2f';
  }
  
  // Save API key
  saveButton.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
      statusText.textContent = '⚠️ Please enter an API key';
      statusText.style.color = '#d32f2f';
      return;
    }
    
    // Check if it looks like a valid OpenAI API key (starts with sk-)
    if (!apiKey.startsWith('sk-')) {
      statusText.textContent = '⚠️ OpenAI API keys usually start with "sk-"';
      statusText.style.color = '#ff9800';
      // Still allow saving in case user has a different format
    }
    
    try {
      await chrome.storage.local.set({ openaiApiKey: apiKey });
      statusText.textContent = '✅ API key saved!';
      statusText.style.color = '#388e3c';
      
      // Mask the input
      if (apiKey.length > 11) {
        apiKeyInput.value = apiKey.substring(0, 7) + '•'.repeat(Math.min(apiKey.length - 11, 20)) + apiKey.substring(apiKey.length - 4);
      } else {
        apiKeyInput.value = '•'.repeat(apiKey.length);
      }
    } catch (e) {
      console.error('Error saving API key:', e);
      statusText.textContent = '❌ Error saving API key';
      statusText.style.color = '#d32f2f';
    }
  });
  
  // Clear API key
  clearButton.addEventListener('click', async () => {
    try {
      await chrome.storage.local.remove(['openaiApiKey']);
      apiKeyInput.value = '';
      statusText.textContent = '🗑️ API key cleared';
      statusText.style.color = '#666';
    } catch (e) {
      console.error('Error clearing API key:', e);
      statusText.textContent = '❌ Error clearing API key';
      statusText.style.color = '#d32f2f';
    }
  });
  
  // Allow pasting full API key
  apiKeyInput.addEventListener('paste', (e) => {
    setTimeout(() => {
      const pasted = apiKeyInput.value.trim();
      if (pasted.startsWith('sk-') && pasted.length > 20) {
        // Likely a real API key, don't mask yet
        statusText.textContent = '💡 Click "Save API Key" to store';
        statusText.style.color = '#667eea';
      }
    }, 10);
  });
});

