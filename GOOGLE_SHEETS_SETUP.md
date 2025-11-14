# Google Sheets Integration Setup

This guide will help you set up automatic data logging to Google Sheets for research purposes.

## Step 1: Create a Google Sheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new spreadsheet
3. Name it "De-Escalator Research Data"
4. Set up the following column headers in row 1:

| User ID | Date | Gender | Age | Original Post Content | Original Post Writer | User's Original Content | Rephrase Suggestion | Did User Accept | Platform | Context | Escalation Type |
|---------|------|--------|-----|----------------------|---------------------|------------------------|-------------------|-----------------|----------|---------|----------------|

## Step 2: Create Google Apps Script

1. In your Google Sheet, click **Extensions** → **Apps Script**
2. Delete any existing code
3. Paste the following code:

```javascript
function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = JSON.parse(e.postData.contents);
    
    sheet.appendRow([
      data.user_id || '',
      data.date || new Date().toISOString(),
      data.gender || '',
      data.age || '',
      data.original_post_content || '',
      data.original_post_writer || '',
      data.user_original_text || '',
      data.rephrase_suggestion || '',
      data.did_user_accept || '',
      data.platform || '',
      data.context || ''
    ]);
    
    return ContentService
      .createTextOutput(JSON.stringify({ success: true, message: 'Data logged successfully' }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Test function (optional)
function testPost() {
  const testData = {
    user_id: 'test_user_123',
    date: new Date().toISOString(),
    gender: 'female',
    age: 25,
    original_post_content: 'This is a test post',
    original_post_writer: '@testuser',
    user_original_text: 'You are always wrong!',
    rephrase_suggestion: 'I often disagree with your perspective.',
    did_user_accept: 'yes',
    platform: 'twitter',
    context: 'https://twitter.com'
  };
  
  const e = {
    postData: {
      contents: JSON.stringify(testData)
    }
  };
  
  const result = doPost(e);
  Logger.log(result.getContent());
}
```

4. Click **Save** (💾 icon)
5. Name your project "De-Escalator Data Logger"

## Step 3: Deploy as Web App

1. Click **Deploy** → **New deployment**
2. Click the gear icon ⚙️ next to "Select type"
3. Choose **Web app**
4. Fill in the settings:
   - **Description**: "De-Escalator data logging endpoint"
   - **Execute as**: Me (your email)
   - **Who has access**: Anyone
5. Click **Deploy**
6. **Authorize** the script (you'll need to grant permissions)
7. **Copy the Web App URL** - it will look like:
   ```
   https://script.google.com/macros/s/ABCDEFGHIJKLMNOP.../exec
   ```

## Step 4: Add URL to Extension

1. Open `/Users/ido/git_michal/comment-insight-extension/config.js`
2. Add your Web App URL:

```javascript
// Configuration file for De-Escalator extension
const GOOGLE_SHEETS_URL = "https://script.google.com/macros/s/YOUR_SCRIPT_ID_HERE/exec";
```

3. Save the file

## Step 5: Update background.js

1. Open `/Users/ido/git_michal/comment-insight-extension/background.js`
2. Find the `sendToGoogleSheets` function
3. Replace the TODO section with:

```javascript
async function sendToGoogleSheets(data) {
  try {
    // Get the Google Sheets URL from config
    const GOOGLE_SHEETS_URL = "YOUR_WEB_APP_URL_HERE"; // Replace with your URL
    
    if (!GOOGLE_SHEETS_URL || GOOGLE_SHEETS_URL.includes('YOUR_')) {
      console.warn('⚠️ Google Sheets URL not configured');
      // Store locally as backup
      const { interactionLog = [] } = await chrome.storage.local.get('interactionLog');
      interactionLog.push(data);
      if (interactionLog.length > 100) interactionLog.shift();
      await chrome.storage.local.set({ interactionLog });
      return;
    }
    
    // Send data to Google Sheets
    const response = await fetch(GOOGLE_SHEETS_URL, {
      method: 'POST',
      mode: 'no-cors', // Important for Google Apps Script
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });
    
    console.log('✅ Data sent to Google Sheets successfully');
    
  } catch (error) {
    console.error('❌ Error sending to Google Sheets:', error);
    // Store locally as backup
    const { interactionLog = [] } = await chrome.storage.local.get('interactionLog');
    interactionLog.push(data);
    await chrome.storage.local.set({ interactionLog });
  }
}
```

## Step 6: Test the Integration

1. Reload the extension in Chrome
2. Go to Twitter/X
3. Type escalating text (e.g., "You are always wrong!")
4. Click either "Rephrase" or "Dismiss"
5. Check your Google Sheet - you should see a new row with the data!

## Troubleshooting

### Data not appearing in Google Sheets?

1. Check the Apps Script execution logs:
   - Open Apps Script editor
   - Click **Execution log** (📊 icon)
   - Look for errors

2. Make sure the Web App is deployed:
   - The URL should end with `/exec` not `/dev`

3. Verify permissions:
   - The script needs permission to access your Google Sheet
   - Re-authorize if needed

### Browser console errors?

1. Open Chrome DevTools (F12)
2. Check the Console tab for errors
3. Look for "Google Sheets URL not configured" warning

## Privacy & Ethics

⚠️ **Important Research Ethics Notes:**

1. **Informed Consent**: Make sure participants know their data is being collected
2. **Anonymization**: User IDs are generated randomly - no personal info is collected
3. **Data Security**: Keep your Google Sheet private and secure
4. **IRB Approval**: Get appropriate ethics approval for your research
5. **Data Retention**: Decide how long you'll keep the data

## Data Columns Explained

- **User ID**: Anonymous identifier generated at installation
- **Date**: Timestamp of the interaction
- **Gender**: User-provided demographic
- **Age**: User-provided demographic
- **Original Post Content**: The post/tweet being replied to
- **Original Post Writer**: Author of the original post
- **User's Original Content**: What the user typed (escalating text)
- **Rephrase Suggestion**: What the extension suggested
- **Did User Accept**: "yes" if rephrased, "no" if dismissed
- **Platform**: Site where interaction took place (Twitter, Facebook, etc.)
- **Context**: URL of the page where the interaction happened
- **Escalation Type**: Whether the text was cognitive, emotional, both, or other

---

**Need help?** Check the console logs in Chrome DevTools for debugging information.

