# Complete Setup Walkthrough - After Adding Sector, Country, City Fields

This guide walks you through updating everything after adding the new demographic fields (Sector, Country, City).

---

## 📋 Quick Checklist

- [ ] Update Google Sheet column headers
- [ ] Update Google Apps Script code
- [ ] Redeploy Google Apps Script
- [ ] Verify Render is running (no changes needed)
- [ ] Reload Chrome extension
- [ ] Test the onboarding form
- [ ] Test data logging

---

## 🔧 Step-by-Step Instructions

### Part 1: Google Sheets Setup

#### Step 1.1: Update Column Headers

1. **Open your Google Sheet** (or create a new one if you don't have one yet)
   - Go to [Google Sheets](https://sheets.google.com)
   - Open your "De-Escalator Research Data" sheet

2. **Update Row 1 (Header Row)** with these exact column headers in this exact order:

   | A | B | C | D | E | F | G | H | I | J | K | L | M | N | O | P |
   |---|---||---||---||---||---||---||---||---||---||---||---||---||---|
   | User ID | Date | Gender | Age | **Sector** | **Country** | **City** | Original Post Content | Original Post Writer | User's Original Content | Rephrase Suggestion | Did User Accept | actual_posted_text | Platform | Context | Escalation Type |

   **Important**: The new columns (Sector, Country, City) must be inserted between "Age" (column D) and "Original Post Content" (column H).

3. **If you have existing data**: 
   - You may want to insert 3 new columns after column D (Age)
   - Right-click on column E → Insert 3 columns
   - Add the headers: Sector, Country, City
   - Existing data rows will have empty values for these columns (that's OK)

---

#### Step 1.2: Update Google Apps Script

1. **Open Apps Script**:
   - In your Google Sheet, click **Extensions** → **Apps Script**
   - This opens the script editor

2. **Replace the entire code**:
   - Select all existing code (Cmd+A or Ctrl+A)
   - Delete it
   - **Copy the ENTIRE contents** from `GOOGLE_APPS_SCRIPT_CODE.js` in this repo
   - Paste it into the Apps Script editor

   **OR** manually update the `sheet.appendRow([...])` array to match this:

   ```javascript
   sheet.appendRow([
     data.user_id || '',                    // Column A (1)
     data.date || new Date().toISOString(), // Column B (2)
     data.gender || '',                     // Column C (3)
     data.age || '',                        // Column D (4)
     data.sector || '',                     // Column E (5) ← NEW
     data.country || '',                    // Column F (6) ← NEW
     data.city || '',                       // Column G (7) ← NEW
     data.original_post_content || '',      // Column H (8)
     data.original_post_writer || '',       // Column I (9)
     data.user_original_text || '',         // Column J (10)
     data.rephrase_suggestion || '',        // Column K (11)
     data.did_user_accept || '',            // Column L (12)
     data.actual_posted_text || '',         // Column M (13)
     data.platform || '',                   // Column N (14)
     data.context || '',                    // Column O (15)
     data.escalation_type || ''             // Column P (16)
   ]);
   ```

3. **Save the script**:
   - Click the **Save** icon (💾) or press Cmd+S / Ctrl+S
   - Name your project if prompted: "De-Escalator Data Logger"

---

#### Step 1.3: Redeploy the Web App

**⚠️ CRITICAL**: You MUST redeploy after updating the script, or the changes won't take effect!

1. **Deploy the updated script**:
   - Click **Deploy** → **Manage deployments**
   - You should see your existing deployment listed
   - Click the **pencil icon ✏️** next to your deployment
   - (If you don't have a deployment, click **Deploy** → **New deployment** → Select **Web app**)

2. **Deployment settings**:
   - **Description**: "De-Escalator data logging endpoint (Updated with Sector/Country/City)"
   - **Execute as**: Me (your email)
   - **Who has access**: Anyone
   - **Version**: New version (or leave as "New version")

3. **Deploy**:
   - Click **Deploy**
   - Wait 10-15 seconds for deployment to complete
   - You should see a success message

4. **Copy the Web App URL** (if creating a new deployment):
   - Copy the URL that looks like:
     ```
     https://script.google.com/macros/s/ABCDEFGHIJKLMNOP.../exec
     ```
   - You'll need this for `config.js` (see Part 2)

---

#### Step 1.4: Verify Column Count

**Double-check that your `appendRow` array has exactly 16 items** (one for each column):

1. In Apps Script, count the items in the `sheet.appendRow([...])` array
2. Should be: user_id, date, gender, age, **sector, country, city**, original_post_content, original_post_writer, user_original_text, rephrase_suggestion, did_user_accept, actual_posted_text, platform, context, escalation_type
3. **Total: 16 items** ✅

---

### Part 2: Render (Proxy Server)

**✅ NO CHANGES NEEDED!**

The Render proxy server (`proxy-server/index.js`) doesn't need any updates. It only handles:
- Receiving rephrasing requests from the extension
- Calling the Gemini API
- Returning rephrased text

The new demographic fields (Sector, Country, City) are only sent to Google Sheets, not to the Render proxy server.

**Just verify your Render service is running**:
- Go to [Render Dashboard](https://dashboard.render.com)
- Check that your proxy server service shows "Live" status
- That's it! ✅

---

### Part 3: Chrome Extension

#### Step 3.1: Verify config.js

1. **Open `config.js`** in your extension folder
2. **Check `GOOGLE_SHEETS_URL`**:
   - Should point to your Google Apps Script Web App URL
   - Format: `https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec`
   - If you created a new deployment, update this URL

3. **Check `PROXY_SERVER_URL`**:
   - Should be: `https://de-escalator-proxy.onrender.com` (or your Render URL)
   - No changes needed unless you deployed to a different Render service

---

#### Step 3.2: Reload the Extension

1. **Open Chrome Extensions page**:
   - Go to `chrome://extensions/`
   - Or: Chrome menu → Extensions → Manage Extensions

2. **Enable Developer Mode** (if not already enabled):
   - Toggle "Developer mode" in the top right

3. **Reload the extension**:
   - Find "De-Escalator" in the list
   - Click the **reload icon** (🔄) next to it
   - Or toggle it off and back on

---

#### Step 3.3: Test the Onboarding Form

1. **Clear extension data** (to trigger onboarding):
   - Go to `chrome://extensions/`
   - Find "De-Escalator"
   - Click **Details**
   - Scroll down to **Storage**
   - Click **Clear site data** (or just uninstall/reinstall the extension)

2. **Trigger onboarding**:
   - Click the extension icon
   - Or reload any page where the extension is active
   - The onboarding form should appear

3. **Fill out the form**:
   - Gender: Select any option
   - Age: Enter a number (13-120)
   - **Sector**: Select from dropdown (e.g., "Secular", "Traditional", etc.)
   - **Country**: Select from dropdown (e.g., "United States", "Israel", etc.)
   - **City**: Type a city name (e.g., "New York", "Tel Aviv")
   - Click "Get Started"

4. **Verify data is saved**:
   - Open Chrome DevTools (F12)
   - Go to **Application** tab → **Storage** → **Local Storage**
   - Look for entries like `userSector`, `userCountry`, `userCity`
   - They should contain the values you entered

---

#### Step 3.4: Test Data Logging

1. **Go to Twitter/X**:
   - Navigate to https://twitter.com or https://x.com
   - Make sure you're logged in

2. **Trigger an escalation**:
   - Start typing a reply or new tweet
   - Type something escalatory like: "You are such a mistake"
   - Wait for the escalation tooltip to appear

3. **Accept or dismiss the rephrase**:
   - Click "Rephrase" or "Dismiss"
   - Or just post the tweet

4. **Check Google Sheets**:
   - Open your Google Sheet
   - Scroll to the bottom
   - You should see a new row with data
   - **Verify the new columns** (Sector, Country, City) have values:
     - Should match what you entered during onboarding
     - Example: "secular" | "United States" | "New York"

5. **Check the browser console** (optional):
   - Open DevTools (F12)
   - Go to **Console** tab
   - Look for messages like:
     - `✅ Data sent to Google Sheets successfully`
     - `📊 Logging interaction data:`
     - Should show `sector`, `country`, `city` in the logged data

---

## ✅ Verification Checklist

After completing all steps, verify:

- [ ] Google Sheet has 16 columns in the correct order
- [ ] Google Apps Script `appendRow` has 16 items
- [ ] Google Apps Script is deployed (not just saved)
- [ ] Render service is running (status: Live)
- [ ] Extension is reloaded in Chrome
- [ ] Onboarding form shows Sector, Country, City fields
- [ ] Onboarding data saves correctly
- [ ] New interaction data appears in Google Sheets
- [ ] New columns (Sector, Country, City) are populated in new rows

---

## 🐛 Troubleshooting

### Problem: Data appears in wrong columns

**Solution**:
1. Double-check your Google Sheet column headers match exactly (16 columns)
2. Count the items in your `sheet.appendRow([...])` array (must be 16)
3. Make sure you **redeployed** the Apps Script (not just saved)
4. Clear browser cache and reload extension

### Problem: Sector/Country/City are empty in Google Sheets

**Solution**:
1. Check that you completed onboarding after reloading the extension
2. Check Chrome DevTools → Application → Local Storage for `userSector`, `userCountry`, `userCity`
3. If empty, clear extension data and go through onboarding again
4. Verify `background.js` is reading these values (check console logs)

### Problem: Extension shows old onboarding form (no new fields)

**Solution**:
1. Make sure you reloaded the extension in `chrome://extensions/`
2. Clear extension storage/data
3. Restart Chrome browser
4. Reinstall the extension if needed

### Problem: "Script error" in Google Apps Script

**Solution**:
1. Check the Apps Script execution log:
   - In Apps Script editor, click **Execution log** (📊 icon)
   - Look for error messages
2. Verify the `appendRow` array syntax is correct (commas, brackets)
3. Make sure all 16 items are present

---

## 📝 Summary

**What changed:**
- Added 3 new fields to onboarding: Sector, Country, City
- Updated Google Sheet to have 16 columns (was 13)
- Updated Google Apps Script to handle 16 columns
- Updated extension code to save/load new fields

**What didn't change:**
- Render proxy server (no changes needed)
- API configuration (no changes needed)
- Extension manifest (no changes needed)

**Action items:**
1. ✅ Update Google Sheet headers
2. ✅ Update & redeploy Google Apps Script
3. ✅ Reload Chrome extension
4. ✅ Test onboarding
5. ✅ Test data logging

---

**Need help?** Check `GOOGLE_SHEETS_SETUP.md` for more detailed documentation.

