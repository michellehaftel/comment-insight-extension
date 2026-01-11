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
      data.sector || '',                     // Column E (5)
      data.country || '',                    // Column F (6)
      data.city || '',                       // Column G (7)
      data.original_post_content || '',      // Column H (8)
      data.original_post_writer || '',       // Column I (9)
      data.user_original_text || '',         // Column J (10)
      data.rephrase_suggestion || '',        // Column K (11)
      data.did_user_accept || '',            // Column L (12)
      data.actual_posted_text || '',         // Column M (13)
      data.delta || '',                      // Column N (14) - Delta between actual_posted_text and rephrase_suggestion
      data.platform || '',                   // Column O (15)
      data.context || '',                    // Column P (16)
      data.escalation_type || ''             // Column Q (17)
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
    sector: 'secular',
    country: 'United States',
    city: 'New York',
    original_post_content: 'This is a test post',
    original_post_writer: '@testuser',
    user_original_text: 'You are always wrong!',
    rephrase_suggestion: 'I often disagree with your perspective.',
    did_user_accept: 'yes',
    actual_posted_text: 'I often disagree with your perspective.', // Should appear in Column M
    delta: '',                                                    // Should appear in Column N
    platform: 'twitter',                                          // Should appear in Column O
    context: 'https://x.com/test',                                // Should appear in Column P
    escalation_type: 'emotional'                                  // Should appear in Column Q
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

