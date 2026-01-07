# Debugging API Issues Guide

## Overview
This guide helps you debug why rephrasing might be returning `null` or failing.

## Debugging Steps

### 1. Check Browser Console
After reloading the extension, open Chrome DevTools (F12) and check the Console tab. Look for these log messages:

#### Successful Flow:
```
🤖 Calling proxy server for rephrasing...
📡 Proxy URL: https://de-escalator-proxy.onrender.com
📝 Text to rephrase: [your text]
📥 Proxy server response received
📄 Full response: {...}
✅ Rephrased text extracted successfully
```

#### Error Indicators:
- `❌ API request failed with status: 500` → Proxy server error
- `❌ Failed to parse AI response as JSON` → Gemini returned invalid JSON
- `ℹ️ Text is already de-escalatory` → API returned null (check why)
- `❌ Error during rephrasing:` → Exception caught

### 2. Check Proxy Server Logs (Render)
1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click on your proxy service (`de-escalator-proxy`)
3. Go to "Logs" tab
4. Look for errors when you trigger a rephrasing request

**What to look for:**
- `❌ GEMINI_API_KEY not configured` → API key missing
- `❌ Failed to parse AI response as JSON` → Gemini returned malformed JSON
- `❌ Gemini returned empty response` → Gemini didn't generate text
- `⚠️ Gemini finish reason: SAFETY` → Content blocked by safety filters

### 3. Test Proxy Server Directly

#### Health Check:
```bash
curl https://de-escalator-proxy.onrender.com/health
```
Should return: `{"status":"ok",...}`

#### Config Check:
```bash
curl https://de-escalator-proxy.onrender.com/debug/config
```
Should show: `{"provider":"gemini","hasGeminiKey":true,...}`

#### Test API Call:
```bash
curl -X POST https://de-escalator-proxy.onrender.com/api/rephrase \
  -H "Content-Type: application/json" \
  -d '{
    "text": "You are wrong about everything",
    "model": "gemini-2.5-flash",
    "prompt": "Your full ECPM_PROMPT here..."
  }'
```

### 4. Common Issues and Fixes

#### Issue 1: API Returns `null` for Escalatory Text
**Symptom:** Console shows `ℹ️ Text is already de-escalatory` for clearly escalatory text

**Possible Causes:**
1. **Prompt issue** - AI incorrectly classifies text as de-escalatory
2. **Context issue** - AI thinks context makes it legitimate
3. **Model issue** - Gemini model not following instructions

**Fix:**
- Check the full API response in console: `📄 Full response: {...}`
- Look at `riskLevel` and `isEscalatory` fields
- Review the prompt in `config.js` - ensure it clearly instructs to rephrase escalatory text

#### Issue 2: 500 Error "Invalid response from AI service"
**Symptom:** `❌ Proxy server error: 500` with "Invalid response from AI service"

**Possible Causes:**
1. Gemini returned empty response
2. Gemini returned non-JSON text
3. JSON parsing failed
4. Safety filters blocked the response

**Fix:**
- Check Render logs for the actual Gemini response
- Verify `GEMINI_API_KEY` is set correctly in Render
- Check if content is being blocked by safety filters
- Try a simpler test case to isolate the issue

#### Issue 3: Network/Timeout Errors
**Symptom:** `⚠️ Request timeout` or `ERR_CONNECTION_REFUSED`

**Possible Causes:**
1. Proxy server is down or sleeping (free tier)
2. Network connectivity issues
3. Timeout too short

**Fix:**
- Check Render service status
- Free tier services sleep after inactivity - wake it up by calling `/health`
- Increase timeout in `config.js` if needed

### 5. Enable Detailed Logging

The extension now logs extensively. Check console for:
- `🔍 DEBUGGING - Response analysis:` - Shows exactly what the API returned
- `📄 Full response:` - Complete JSON response from proxy
- `📝 Context provided:` - What context was sent to the API

### 6. Test with Different Text

Try these test cases to isolate issues:

1. **Simple escalatory:**
   ```
   "You are wrong"
   ```
   Should definitely get a rephrasing.

2. **Complex escalatory:**
   ```
   "You are the worst mistake Israel has ever made"
   ```
   Should get a rephrasing.

3. **Non-escalatory:**
   ```
   "I think we have different perspectives on this issue"
   ```
   Can legitimately return null.

### 7. Verify API Key

1. Go to Render Dashboard → Your Service → Environment
2. Verify `GEMINI_API_KEY` is set
3. Make sure there are no extra spaces or quotes
4. Test with `/debug/config` endpoint

### 8. Check Prompt Format

The prompt must instruct Gemini to return JSON with `rephrasedText` field. Verify in `config.js`:
- Prompt includes JSON format specification
- Prompt clearly states when to set `rephrasedText: null`
- Prompt includes examples

## Getting Help

When asking for help, provide:
1. Full console logs (copy all relevant messages)
2. Render logs from the proxy server
3. The text you're testing with
4. What you expected vs. what happened

## Quick Health Check Script

```javascript
// Run this in browser console to test the proxy
async function testProxy() {
  const testText = "You are wrong about everything";
  console.log('Testing with:', testText);
  
  try {
    const response = await fetch('https://de-escalator-proxy.onrender.com/api/rephrase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: testText,
        model: 'gemini-2.5-flash',
        prompt: '...' // You'll need to include your full prompt here
      })
    });
    
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', data);
  } catch (error) {
    console.error('Error:', error);
  }
}
testProxy();
```

