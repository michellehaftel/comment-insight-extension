# Google Sheets Integration Setup

This guide will help you set up automatic data logging to Google Sheets for research purposes.

## Step 1: Create a Google Sheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new spreadsheet
3. Name it "De-Escalator Research Data"
4. Set up the following column headers in row 1:

| User ID | Date | Gender | Age | Original Post Content | Original Post Writer | User's Original Content | Rephrase Suggestion | Did User Accept | actual_posted_text | Platform | Context | Escalation Type |
|---------|------|--------|-----|----------------------|---------------------|------------------------|-------------------|-----------------|-------------------|----------|---------|----------------|

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
      data.actual_posted_text || '',
      data.platform || '',
      data.context || '',
      data.escalation_type || ''
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
    actual_posted_text: 'I often disagree with your perspective.',
    platform: 'twitter',
    context: 'https://twitter.com',
    escalation_type: 'cognitive'
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

## Step 6: Verify Column Order

**CRITICAL**: Make sure your Google Sheet column headers are in this EXACT order:

| Column # | Header Name |
|----------|-------------|
| 1 | User ID |
| 2 | Date |
| 3 | Gender |
| 4 | Age |
| 5 | Original Post Content |
| 6 | Original Post Writer |
| 7 | User's Original Content |
| 8 | Rephrase Suggestion |
| 9 | Did User Accept |
| 10 | **actual_posted_text** ← NEW COLUMN |
| 11 | Platform |
| 12 | Context |
| 13 | Escalation Type |

**If columns are out of order, data will appear in the wrong places!**

## Step 7: Test the Integration

1. **Verify your Google Apps Script is updated:**
   - Open Extensions → Apps Script
   - Check that line 37 has: `data.actual_posted_text || '',`
   - If not, update and redeploy (see Step 2-3)

2. **Verify column order in your Google Sheet matches Step 6 above**

3. Reload the extension in Chrome

4. Go to Twitter/X

5. Type escalating text (e.g., "You are such a mistake and I can't believe you exist")

6. Click either "Rephrase" or "Dismiss" (or post the tweet)

7. Check your Google Sheet - you should see a new row with the data in the correct columns!

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

### Wrong data appearing in columns (e.g., "twitter" in actual_posted_text column)?

This means your Google Apps Script `appendRow` array has **12 items instead of 13**, so all data after `did_user_accept` is shifted by one position.

**Critical Fix Steps:**

1. **Open Google Apps Script:**
   - Go to your Google Sheet → Extensions → Apps Script

2. **Count the items in `appendRow` array:**
   - The array should have **exactly 13 items** (one for each column)
   - If it has only 12 items, you're missing `data.actual_posted_text || ''`

3. **Replace the ENTIRE `doPost` function with this exact code:**
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
         data.actual_posted_text || '',  // ← COLUMN 10: This line was missing!
         data.platform || '',
         data.context || '',
         data.escalation_type || ''
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
   ```

4. **VERIFY the array has exactly 13 items:**
   - Count the commas between items in the array
   - Should be 12 commas = 13 items total

5. **Save and Redeploy:**
   - Click **Save** (💾) 
   - Click **Deploy** → **Manage deployments**
   - Click the **pencil icon ✏️** next to your deployment
   - Click **Deploy**
   - Wait 10-15 seconds for deployment to complete

6. **Verify Google Sheet Column Order:**
   - Column 10 must be: `actual_posted_text`
   - Column 11 must be: `Platform`
   - Column 12 must be: `Context`
   - Column 13 must be: `Escalation Type`
   - **IMPORTANT**: This matches your current column order - do NOT rearrange columns!

7. **Test with a new interaction:**
   - The OLD rows will still have wrong data (they can't be fixed)
   - NEW rows should now have correct data in each column

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
- **actual_posted_text**: The actual text that was posted (may differ from original or rephrased if user edited)
- **Platform**: Site where interaction took place (Twitter, Facebook, etc.)
- **Context**: URL of the page where the interaction happened
- **Escalation Type**: Whether the text was cognitive, emotional, both, or other

---

**Need help?** Check the console logs in Chrome DevTools for debugging information.

