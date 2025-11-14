// Background service worker for De-Escalator extension

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
async function handleDataLogging(data) {
  try {
    console.log('📊 Logging interaction data:', data);
    
    // Get user info from storage
    const { userId, userGender, userAge } = await chrome.storage.local.get([
      'userId',
      'userGender',
      'userAge'
    ]);
    
    // Prepare data for Google Sheets
    const logData = {
      user_id: userId || 'unknown',
      date: data.date || new Date().toISOString(),
      gender: userGender || 'unknown',
      age: userAge || 'unknown',
      original_post_content: data.original_post_content || '',
      original_post_writer: data.original_post_writer || '',
      user_original_text: data.user_original_text || '',
      rephrase_suggestion: data.rephrase_suggestion || '',
      did_user_accept: data.did_user_accept || 'no',
      escalation_type: data.escalation_type || 'unknown',
      platform: data.platform || 'unknown',
      context: data.context || ''
    };
    
    console.log('📝 Prepared log data:', logData);
    
    // TODO: Send to Google Sheets
    // Will implement in next step
    await sendToGoogleSheets(logData);
    
  } catch (error) {
    console.error('❌ Error logging data:', error);
  }
}

// Send data to Google Sheets
async function sendToGoogleSheets(data) {
  try {
    // Get Google Sheets URL from config
    // Check if URL is configured
    if (!GOOGLE_SHEETS_URL || GOOGLE_SHEETS_URL.includes('YOUR_')) {
      console.warn('⚠️ Google Sheets URL not configured. Follow GOOGLE_SHEETS_SETUP.md to set it up.');
      // Store locally as backup
      await storeLocally(data);
      return;
    }
    
    console.log('📤 Sending data to Google Sheets...');
    
    // Send to Google Sheets
    const response = await fetch(GOOGLE_SHEETS_URL, {
      method: 'POST',
      mode: 'no-cors', // Required for Google Apps Script
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });
    
    console.log('✅ Data sent to Google Sheets successfully');
    
    // Also store locally as backup
    await storeLocally(data);
    
  } catch (error) {
    console.error('❌ Error sending to Google Sheets:', error);
    // Store locally as backup
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

