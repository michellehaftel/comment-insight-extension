/**
 * Discourse Lab Extension - Google Apps Script
 * 
 * Copy and paste this ENTIRE code into Google Apps Script:
 * 1. Open your Google Sheet
 * 2. Extensions → Apps Script
 * 3. Delete any existing code
 * 4. Paste this entire file
 * 5. Save and Deploy as Web App
 * 
 * Column Order (must match your Google Sheet):
 * A: user_id
 * B: date
 * C: gender
 * D: age
 * E: sector
 * F: country
 * G: city
 * H: original_post_content
 * I: original_post_writer
 * J: user_original_text
 * K: rephrase_suggestion
 * L: did_user_accept
 * M: actual_posted_text
 * N: delta
 * O: platform
 * P: context
 * Q: escalation_type
 * R: AngelBot/DevilBot
 * S: interaction_id – internal ID linking the "pending" row to the later update (Post/Dismiss). Safe to ignore when analysing data.
 * T: time_to_rephrase_seconds – time spent waiting for the rephrase suggestion (seconds). Blank when not applicable.
 */

// CORS headers so the Chrome extension (or any origin) can POST to this Web App
function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

// Handle preflight OPTIONS request (required for CORS from browser/extension)
function doGet(e) {
  return ContentService
    .createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT)
    .setHeaders(getCorsHeaders());
}

function doPost(e) {
  const cors = getCorsHeaders();
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = JSON.parse(e.postData.contents);

    // Column indices (1-based)
    const TIME_COL = 20; // Column T

    // Update existing row by interaction_id (when user clicks Post or Dismiss)
    if (data.action === 'update' && data.interaction_id) {
      const id = String(data.interaction_id).trim();
      if (!id) {
        return ContentService
          .createTextOutput(JSON.stringify({ success: false, error: 'Missing interaction_id' }))
          .setMimeType(ContentService.MimeType.JSON)
          .setHeaders(cors);
      }
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) {
        return ContentService
          .createTextOutput(JSON.stringify({ success: false, error: 'No data rows in sheet' }))
          .setMimeType(ContentService.MimeType.JSON)
          .setHeaders(cors);
      }
      const idCol = 19; // Column S = interaction_id
      const dataRange = sheet.getRange(2, idCol, lastRow - 1, 1); // Row 2 = first data row; read only col S
      const values = dataRange.getValues();
      let rowIndex = -1;
      for (let i = 0; i < values.length; i++) {
        if (String(values[i][0] || '').trim() === id) {
          rowIndex = i + 2; // +2 because data starts at row 2
          break;
        }
      }
      if (rowIndex === -1) {
        return ContentService
          .createTextOutput(JSON.stringify({ success: false, error: 'Row not found for interaction_id: ' + id }))
          .setMimeType(ContentService.MimeType.JSON)
          .setHeaders(cors);
      }
      if (data.user_original_text) sheet.getRange(rowIndex, 10).setValue(data.user_original_text); // Column J
      if (data.rephrase_suggestion) sheet.getRange(rowIndex, 11).setValue(data.rephrase_suggestion); // Column K
      sheet.getRange(rowIndex, 12).setValue(data.did_user_accept || '');
      sheet.getRange(rowIndex, 13).setValue(data.actual_posted_text || '');
      sheet.getRange(rowIndex, 14).setValue(data.delta || '');
      if (data.time_to_rephrase_seconds !== undefined) {
        sheet.getRange(rowIndex, TIME_COL).setValue(data.time_to_rephrase_seconds || '');
      }
      return ContentService
        .createTextOutput(JSON.stringify({ success: true, message: 'Row updated successfully' }))
        .setMimeType(ContentService.MimeType.JSON)
        .setHeaders(cors);
    }

    // Append new row (escalation detected – tooltip shown)
    sheet.appendRow([
      data.user_id || '',                    // Column A (1)
      data.date || new Date().toISOString(), // Column B (2)
      data.gender || '',                     // Column C (3)
      data.age || '',                        // Column D (4)
      data.sector || '',                     // Column E (5)
      data.country || '',                    // Column F (6)
      data.city || '',                       // Column G (7)
      data.original_post_content || '',      // Column H (8)
      data.original_post_writer || '',       // Column I (9)
      data.user_original_text || '',         // Column J (10)
      data.rephrase_suggestion || '',        // Column K (11)
      data.did_user_accept || '',            // Column L (12)
      data.actual_posted_text || '',         // Column M (13)
      data.delta || '',                      // Column N (14)
      data.platform || '',                   // Column O (15)
      data.context || '',                    // Column P (16)
      data.escalation_type || '',            // Column Q (17)
      data.angel_devil_bot || 'AngelBot',    // Column R (18)
      data.interaction_id || '',             // Column S (19)
      data.time_to_rephrase_seconds || ''   // Column T (20)
    ]);

    // Set header + conditional formatting once (best-effort)
    const props = PropertiesService.getScriptProperties();
    const alreadyApplied = props.getProperty('time_rephrase_format_applied') === 'true';
    if (!alreadyApplied) {
      // Header label
      const headerCell = sheet.getRange(1, TIME_COL);
      if (!headerCell.getValue()) {
        headerCell.setValue('time_to_rephrase_seconds');
      }

      // Conditional formatting: if time > 7 seconds, make font red
      const existingRules = sheet.getConditionalFormatRules();
      const formatRange = sheet.getRange(2, TIME_COL, Math.max(1, sheet.getMaxRows() - 1));
      const alreadyHasRule = existingRules.some(rule => {
        try {
          const ranges = rule.getRanges();
          return ranges && ranges.length > 0 && ranges[0].getColumn() === TIME_COL;
        } catch (err) {
          return false;
        }
      });

      if (!alreadyHasRule) {
        const rule = SpreadsheetApp.newConditionalFormatRule()
          .whenNumberGreaterThan(7)
          .setFontColor('#ff0000')
          .setRanges([formatRange])
          .build();
        sheet.setConditionalFormatRules(existingRules.concat([rule]));
      }

      props.setProperty('time_rephrase_format_applied', 'true');
    }

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, message: 'Data logged successfully' }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders(cors);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders(cors);
  }
}

/**
 * Optional: Test function to verify your script works correctly
 * Run this function to add a test row to your sheet
 */
function testDataOrder() {
  const testData = {
    user_id: 'test_user_123',
    date: new Date().toISOString(),
    gender: 'female',
    age: 25,
    sector: 'secular',
    country: 'United States',
    city: 'New York',
    original_post_content: 'This is a test post',
    original_post_writer: '@testuser',
    user_original_text: 'You are always wrong!',
    rephrase_suggestion: 'I often disagree with your perspective.',
    did_user_accept: 'yes',
    actual_posted_text: 'I often disagree with your perspective.',
    delta: '',
    platform: 'twitter',
    context: 'https://x.com/test',
    escalation_type: 'emotional',
    angel_devil_bot: 'AngelBot',
    interaction_id: 'test-' + Date.now()
  };
  
  const e = {
    postData: {
      contents: JSON.stringify(testData)
    }
  };
  
  const result = doPost(e);
  Logger.log('Test result: ' + result.getContent());
  Logger.log('✅ Check your sheet - a new row should have been added.');
  Logger.log('Verify columns J, K, L, M match the test data above.');
}

