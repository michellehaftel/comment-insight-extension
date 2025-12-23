# Troubleshooting Gemini API Model Issues

## Current Issue
All model names are returning 404 errors, suggesting the API key may not have access to these models, or we're using the wrong API endpoint.

## What to Check

1. **Verify API Key Permissions**
   - Go to Google AI Studio: https://aistudio.google.com/app/apikey
   - Check which models your API key has access to
   - Free tier API keys may have limited model access

2. **Try Listing Available Models**
   - The API suggests calling ListModels to see available models
   - You can test this with: `curl "https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_API_KEY"`

3. **Check API Version**
   - We're using `v1beta` endpoint
   - Some models might only be available in `v1` or vice versa

4. **Alternative: Use OpenAI Instead**
   - If Gemini continues to have issues, switch to OpenAI in `config.js`:
     ```javascript
     provider: 'openai',
     model: 'gpt-4o'
     ```
   - Set `OPENAI_API_KEY` in Render environment variables

## Quick Fix Options

1. **Check Render Logs**: View proxy server logs in Render dashboard to see exact error messages
2. **Test API Key Directly**: Use curl or Postman to test the Gemini API directly with your key
3. **Contact Google Support**: If API key has proper permissions but models aren't accessible

