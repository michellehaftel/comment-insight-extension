# Setting Up Prompt Management on Render

This guide explains how to manage your ECPM prompt on Render so you can update it **without Chrome Web Store approval**.

## Why This Matters

- **Chrome Web Store Approval**: Required for any changes to extension code (including prompts in `config.js`)
- **Render Environment Variables**: Can be updated instantly without approval
- **Result**: You can iterate on prompts quickly without waiting for Chrome review

## How It Works

The proxy server checks for prompts in this priority order:
1. **`ECPM_PROMPT` environment variable** (on Render) ← **Use this for updates**
2. Request body prompt (from extension `config.js`) ← Fallback
3. Default prompt (hardcoded in proxy server) ← Last resort

## Setup Instructions

### Step 1: Copy Your Current Prompt

1. Open `config.js` in your extension
2. Find the `ECPM_PROMPT` constant (starts around line 38)
3. Copy the entire prompt text (from the backtick after `ECPM_PROMPT = ` to the closing backtick)

### Step 2: Add to Render Environment Variables

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Navigate to your proxy server service
3. Click on **"Environment"** in the left sidebar
4. Click **"Add Environment Variable"**
5. Set:
   - **Key**: `ECPM_PROMPT`
   - **Value**: Paste your entire prompt text (the multi-line string)
6. Click **"Save Changes"**

### Step 3: Restart Your Service

1. In Render, go to your service
2. Click **"Manual Deploy"** → **"Deploy latest commit"**
   - OR click **"Restart"** if you just want to restart without redeploying

### Step 4: Verify It's Working

1. Check your proxy server logs in Render
2. Look for: `📝 Using prompt from ECPM_PROMPT environment variable`
3. Test the extension - it should work normally

## Updating the Prompt (No Chrome Approval Needed!)

Once set up, you can update the prompt anytime:

1. Go to Render → Your service → Environment
2. Find `ECPM_PROMPT`
3. Click the edit icon (pencil)
4. Update the prompt text
5. Save and restart the service

**That's it!** No Chrome Web Store submission needed.

## Troubleshooting

### Extension still uses old prompt
- Make sure you restarted the Render service after setting the environment variable
- Check Render logs for: `📝 Using prompt from ECPM_PROMPT environment variable`
- If you see `📝 Using prompt from request body`, the env var isn't being read

### Environment variable not found
- Make sure the key is exactly `ECPM_PROMPT` (case-sensitive)
- Make sure there are no extra spaces or quotes around the value
- Try redeploying the service (not just restarting)

### Prompt too long for environment variable
- Render supports very long environment variables (up to several MB)
- If you hit limits, you can split the prompt into multiple variables and concatenate them in the proxy server code

## Benefits

✅ **Instant Updates**: Change prompts without waiting for Chrome review  
✅ **A/B Testing**: Easily test different prompt versions  
✅ **Version Control**: Render keeps history of environment variable changes  
✅ **No Code Changes**: Update prompts without touching extension code  
✅ **Rollback**: Easy to revert to previous prompt versions

---

**Note**: The extension code (`config.js`) still contains the prompt as a fallback, but it won't be used if `ECPM_PROMPT` is set on Render.

