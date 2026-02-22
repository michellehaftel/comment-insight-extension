// Background service worker for Discourse Lab extension

// Load shared configuration (Google Sheets URL)
importScripts('config.js');

// Check onboarding status when extension is installed
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('🎉 Extension installed! Opening onboarding...');
    
    // Open onboarding page
    chrome.tabs.create({
      url: chrome.runtime.getURL('onboarding.html')
    });
  } else if (details.reason === 'update') {
    console.log('✅ Extension updated!');
  }
});

// Check onboarding status when browser starts
chrome.runtime.onStartup.addListener(async () => {
  const { onboardingComplete } = await chrome.storage.local.get('onboardingComplete');
  
  if (!onboardingComplete) {
    console.log('⚠️ Onboarding not complete. Opening onboarding page...');
    chrome.tabs.create({
      url: chrome.runtime.getURL('onboarding.html')
    });
  }
});

// Listen for messages from content script (for data logging)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'LOG_INTERACTION') {
    handleDataLogging(message.data);
    sendResponse({ success: true });
  }
  return true; // Keep channel open for async response
});

// Handle data logging to Google Sheets
// Calculate delta (difference) between actual_posted_text and rephrase_suggestion
function calculateDelta(actualText, rephraseText) {
  if (!actualText || !rephraseText) {
    return '';
  }
  
  const actual = actualText.trim();
  const rephrase = rephraseText.trim();
  
  // If they're identical, no delta
  if (actual === rephrase) {
    return '';
  }
  
  // If actual text starts with rephrase text, the delta is what comes after
  if (actual.startsWith(rephrase)) {
    const delta = actual.substring(rephrase.length).trim();
    // Remove leading punctuation/whitespace that might be part of the rephrase
    return delta.replace(/^[.,;:!?\s]+/, '').trim();
  }
  
  // If rephrase text starts with actual text, delta is negative (text was removed)
  if (rephrase.startsWith(actual)) {
    const removed = rephrase.substring(actual.length).trim();
    return `[REMOVED: ${removed}]`;
  }
  
  // Otherwise, return the difference (for now, return what was added)
  // This is a simple implementation - could be enhanced with diff algorithms
  // Use replaceAll to handle cases where rephrase text appears multiple times
  return actual.replaceAll(rephrase, '').trim();
}

// Normalize did_user_accept for the sheet: clear "Accepted" / "Not accepted" / "Pending" / "Not applicable"
function normalizeDidUserAccept(value) {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'yes') return 'Accepted';
  if (v === 'no') return 'Not accepted';
  if (v === 'pending') return 'Pending';
  if (v === 'not_applicable' || v === 'not applicable') return 'Not applicable';
  return value || 'Pending';
}

async function handleDataLogging(data) {
  try {
    console.log('📊 Logging interaction data:', data);

    // Update existing row (when user clicks Post or Dismiss)
    if (data.action === 'update' && data.interaction_id) {
      const delta = calculateDelta(data.actual_posted_text || '', data.rephrase_suggestion || '');
      const updatePayload = {
        action: 'update',
        interaction_id: data.interaction_id,
        did_user_accept: normalizeDidUserAccept(data.did_user_accept),
        actual_posted_text: data.actual_posted_text || '',
        delta: delta
      };
      console.log('📝 Sending update:', updatePayload);
      await sendToGoogleSheets(updatePayload);
      return;
    }

    // Get user info from storage (for new row append)
    const { userId, userGender, userAge, userSector, userCountry, userCountryName, userCity } = await chrome.storage.local.get([
      'userId',
      'userGender',
      'userAge',
      'userSector',
      'userCountry',
      'userCountryName',
      'userCity'
    ]);

    const delta = calculateDelta(data.actual_posted_text || '', data.rephrase_suggestion || '');

    const logData = {
      user_id: userId || 'unknown',
      date: data.date || new Date().toISOString(),
      gender: userGender || 'unknown',
      age: userAge || 'unknown',
      sector: userSector || 'unknown',
      country: userCountryName || userCountry || 'unknown',
      city: userCity || 'unknown',
      original_post_content: data.original_post_content || '',
      original_post_writer: data.original_post_writer || '',
      user_original_text: data.user_original_text || '',
      rephrase_suggestion: data.rephrase_suggestion || '',
      did_user_accept: normalizeDidUserAccept(data.did_user_accept),
      actual_posted_text: data.actual_posted_text || '',
      delta: delta,
      platform: data.platform || 'unknown',
      context: data.context || '',
      escalation_type: data.escalation_type || 'unknown',
      angel_devil_bot: (data.bot_type === 'devil' ? 'DevilBot' : 'AngelBot'),
      interaction_id: data.interaction_id || ''
    };

    console.log('📝 Prepared log data:', logData);
    await sendToGoogleSheets(logData);

  } catch (error) {
    console.error('❌ Error logging data:', error);
  }
}

// Send data to Google Sheets
async function sendToGoogleSheets(data) {
  try {
    if (!GOOGLE_SHEETS_URL || GOOGLE_SHEETS_URL.includes('YOUR_')) {
      console.warn('⚠️ Google Sheets URL not configured. Follow GOOGLE_SHEETS_SETUP.md to set it up.');
      await storeLocally(data);
      return;
    }
    
    console.log('📤 Sending data to Google Sheets...', { user_id: data.user_id, did_user_accept: data.did_user_accept });
    
    // Use text/plain to avoid CORS preflight (Apps Script has no doOptions).
    const response = await fetch(GOOGLE_SHEETS_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(data)
    });
    
    if (response.ok) {
      const result = await response.json().catch(() => ({}));
      console.log('✅ Google Sheets logged:', result.message || 'success');
    } else {
      console.warn('⚠️ Google Sheets responded with status', response.status, '- storing locally');
    }
    await storeLocally(data);
    
  } catch (error) {
    console.error('❌ Google Sheets error:', error.message || error);
    await storeLocally(data);
  }
}

// Store data locally as backup
async function storeLocally(data) {
  try {
    const { interactionLog = [] } = await chrome.storage.local.get('interactionLog');
    interactionLog.push(data);
    
    // Keep only last 100 interactions to avoid storage limits
    if (interactionLog.length > 100) {
      interactionLog.shift();
    }
    
    await chrome.storage.local.set({ interactionLog });
    console.log('💾 Data stored locally. Total interactions:', interactionLog.length);
  } catch (error) {
    console.error('❌ Error storing data locally:', error);
  }
}

