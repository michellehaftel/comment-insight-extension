# Google Sheets Integration Setup

This guide will help you set up automatic data logging to Google Sheets for research purposes.

## Step 1: Create a Google Sheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new spreadsheet
3. Name it "De-Escalator Research Data"
4. Set up the following column headers in row 1:

| User ID | Date | Gender | Age | Sector | Country | City | Original Post Content | Original Post Writer | User's Original Content | Rephrase Suggestion | Did User Accept | actual_posted_text | Delta | Platform | Context | Escalation Type | is_escalating | bot_type |
|---------|------|--------|-----|--------|---------|------|----------------------|---------------------|------------------------|-------------------|-----------------|-------------------|-------|----------|---------|----------------|---------------|----------|

## Step 2: Create Google Apps Script

**🎯 EASIEST WAY**: Copy the entire ready-to-use script from `GOOGLE_APPS_SCRIPT_CODE.js` file in this repo!

1. In your Google Sheet, click **Extensions** → **Apps Script**
2. Delete any existing code
3. **Copy and paste the ENTIRE code** from `GOOGLE_APPS_SCRIPT_CODE.js` OR paste the following code:

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
      data.sector || '',
      data.country || '',
      data.city || '',
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
| 5 | Sector |
| 6 | Country |
| 7 | City |
| 8 | Original Post Content |
| 9 | Original Post Writer |
| 10 | User's Original Content |
| 11 | Rephrase Suggestion |
| 12 | Did User Accept |
| 13 | **actual_posted_text** |
| 14 | **Delta** |
| 15 | Platform |
| 16 | Context |
| 17 | Escalation Type |
| 18 | **is_escalating** |
| 19 | **bot_type** |

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

3. **Copy this EXACT code** - Replace your entire `doPost` function:
   ```javascript
   function doPost(e) {
     try {
       const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
       const data = JSON.parse(e.postData.contents);
       
       sheet.appendRow([
         data.user_id || '',                    // Column 1
         data.date || new Date().toISOString(), // Column 2
         data.gender || '',                     // Column 3
         data.age || '',                        // Column 4
         data.sector || '',                     // Column 5
         data.country || '',                    // Column 6
         data.city || '',                       // Column 7
         data.original_post_content || '',      // Column 8
         data.original_post_writer || '',       // Column 9
         data.user_original_text || '',         // Column 10
         data.rephrase_suggestion || '',        // Column 11
         data.did_user_accept || '',            // Column 12
         data.actual_posted_text || '',         // Column 13
         data.platform || '',                   // Column 14
         data.context || '',                    // Column 15
         data.escalation_type || ''             // Column 16
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
   
4. **VERIFY BEFORE SAVING** - Check your code matches EXACTLY:
   - Line after `data.did_user_accept || '',` must be: `data.actual_posted_text || '',`
   - **Next line MUST be**: `data.platform || '',` (NOT escalation_type!)
   - **Next line MUST be**: `data.context || '',` (NOT platform!)
   - **Last line MUST be**: `data.escalation_type || ''` (NOT context!)
   - **Count commas in the array**: Should be exactly 12 commas (means 13 items)
   - **❌ WRONG ORDER**: If you see `escalation_type` before `platform`, your order is wrong!
   - **✅ CORRECT ORDER**: `actual_posted_text` → `platform` → `context` → `escalation_type`

5. **Save and Redeploy:**
   - Click **Save** (💾) 
   - Click **Deploy** → **Manage deployments**
   - Click the **pencil icon ✏️** next to your deployment
   - Click **Deploy**
   - Wait 10-15 seconds for deployment to complete

6. **Verify Google Sheet Column Order matches EXACTLY:**
   - Column A (1): `user_id`
   - Column B (2): `date`
   - Column C (3): `gender`
   - Column D (4): `age`
   - Column E (5): `sector`
   - Column F (6): `country`
   - Column G (7): `city`
   - Column H (8): `original_post_content`
   - Column I (9): `original_post_writer`
   - Column J (10): `user_original_text`
   - Column K (11): `rephrase_suggestion`
   - Column L (12): `did_user_accept`
   - Column M (13): `actual_posted_text`
   - Column N (14): `delta`
   - Column O (15): `platform`
   - Column P (16): `context`
   - Column Q (17): `escalation_type`
   - Column R (18): `is_escalating`
   - Column S (19): `bot_type` (A/B testing: "angel" = de-escalation bot, "devil" = escalation bot)
   
   **Make sure your column order matches exactly!**

7. **VERIFY THE SCRIPT WAS ACTUALLY UPDATED:**
   - After saving and redeploying, open the script again
   - Check that `data.actual_posted_text || '',` appears in the array
   - **Common mistake**: People update the script but forget to redeploy!
   - **Double-check deployment**: Deploy → Manage deployments → Your deployment should show the latest version

8. **OPTIONAL: Add a test function to verify your script is correct:**
   
   Add this function to your Google Apps Script to test:
   ```javascript
   function testDataOrder() {
     const testData = {
       user_id: 'test_user',
       date: new Date().toISOString(),
       gender: 'female',
       age: 25,
       sector: 'secular',
       country: 'United States',
       city: 'New York',
       original_post_content: 'Test post',
       original_post_writer: '@test',
       user_original_text: 'You are wrong!',
       rephrase_suggestion: 'I disagree',
       did_user_accept: 'yes',
      actual_posted_text: 'I disagree', // Should go to Column M
      delta: '',                         // Should go to Column N
      platform: 'twitter',              // Should go to Column O
      context: 'https://x.com/test',    // Should go to Column P
      escalation_type: 'emotional',     // Should go to Column Q
      is_escalating: 'Yes',              // Should go to Column R
      bot_type: 'angel'                  // Should go to Column S
     };
     
     const e = {
       postData: {
         contents: JSON.stringify(testData)
       }
     };
     
     const result = doPost(e);
     Logger.log('Test result: ' + result.getContent());
     Logger.log('✅ Check your sheet - a new row should have been added.');
     Logger.log('Verify columns M, N, O, P, Q match the test data above.');
   }
   ```
   
   Then run it: **Run → testDataOrder** and check the execution log and your sheet.

9. **Test with a new interaction:**
   - The OLD rows will still have wrong data (they can't be fixed)
   - Create a NEW test interaction in the extension
   - NEW rows should now show:
     - Column M (`actual_posted_text`): The actual text that was posted
     - Column N (`platform`): "twitter" 
     - Column O (`context`): The URL (e.g., "https://x.com/home")
     - Column P (`escalation_type`): "emotional", "cognitive", or "both"

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
- **Delta**: The difference between actual_posted_text and rephrase_suggestion (shows what text was added/changed by the user after seeing the rephrase)
- **Platform**: Site where interaction took place (Twitter, Facebook, etc.)
- **Context**: URL of the page where the interaction happened
- **Escalation Type**: Whether the user's **original text** (user_original_text) was cognitive, emotional, both, or other, regardless of what they eventually posted
- **is_escalating**: Binary flag ("Yes" or "No") indicating if the user's **original text** (user_original_text) is escalatory, regardless of what they eventually posted. This enables easy calculation of the percentage of escalatory texts the user intended to write per user.
- **bot_type**: A/B testing field indicating which bot was used: "angel" (de-escalation bot - suggests making toxic content calm) or "devil" (escalation bot - suggests making calm content more direct/impactful). Used to compare conversion rates between the two approaches.

---

**Need help?** Check the console logs in Chrome DevTools for debugging information.

