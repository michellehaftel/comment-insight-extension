/**
 * De-Escalator Extension - Google Apps Script
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
 * E: original_post_content
 * F: original_post_writer
 * G: user_original_text
 * H: rephrase_suggestion
 * I: did_user_accept
 * J: actual_posted_text
 * K: platform
 * L: context
 * M: escalation_type
 */

function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = JSON.parse(e.postData.contents);
    
    sheet.appendRow([
      data.user_id || '',                    // Column A (1)
      data.date || new Date().toISOString(), // Column B (2)
      data.gender || '',                     // Column C (3)
      data.age || '',                        // Column D (4)
      data.original_post_content || '',      // Column E (5)
      data.original_post_writer || '',       // Column F (6)
      data.user_original_text || '',         // Column G (7)
      data.rephrase_suggestion || '',        // Column H (8)
      data.did_user_accept || '',            // Column I (9)
      data.actual_posted_text || '',         // Column J (10)
      data.platform || '',                   // Column K (11)
      data.context || '',                    // Column L (12)
      data.escalation_type || ''             // Column M (13)
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
    original_post_content: 'This is a test post',
    original_post_writer: '@testuser',
    user_original_text: 'You are always wrong!',
    rephrase_suggestion: 'I often disagree with your perspective.',
    did_user_accept: 'yes',
    actual_posted_text: 'I often disagree with your perspective.', // Should appear in Column J
    platform: 'twitter',                                          // Should appear in Column K
    context: 'https://x.com/test',                                // Should appear in Column L
    escalation_type: 'emotional'                                  // Should appear in Column M
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

