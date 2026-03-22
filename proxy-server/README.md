# Discourse Lab Proxy Server

Proxy server for securely handling API calls from the Discourse Lab Chrome extension. Keeps API keys server-side and provides rate limiting and monitoring.

## Local Development

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Environment Variables

Create a `.env` file in the `proxy-server` directory:

```bash
cp .env.example .env
```

Edit `.env` and add your OpenAI API key:

```
OPENAI_API_KEY=sk-your-actual-api-key-here
PORT=3000
```

### 3. Run the Server

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

The server will start on `http://localhost:3000`

### 4. Test the Server

Check health endpoint:
```bash
curl http://localhost:3000/health
```

## Deployment to Render

### Step 1: Prepare Your Code

1. Make sure your code is in a Git repository (GitHub, GitLab, or Bitbucket)
2. Ensure `package.json` exists with all dependencies
3. Create `.env.example` file (already done)

### Step 2: Create Render Account

1. Go to [render.com](https://render.com)
2. Sign up or log in
3. Connect your GitHub account (if using GitHub)

### Step 3: Create New Web Service

1. Click "New +" → "Web Service"
2. Connect your repository
3. Select the repository containing this code
4. Configure the service:
   - **Name**: `de-escalator-proxy` (or your preferred name)
   - **Region**: Choose closest to your users
   - **Branch**: `main` (or your default branch)
   - **Root Directory**: `proxy-server` (if proxy-server is in a subdirectory)
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

### Step 4: Set Environment Variables

In Render dashboard, go to your service → "Environment" tab:

**Option 1: Use OpenAI (default)**
- `OPENAI_API_KEY` = `sk-your-actual-api-key-here` (keys start with `sk-`)
- `PORT` = `10000` (Render sets this automatically, but you can override)

**Option 2: Use Google Gemini**
- `GEMINI_API_KEY` = `your-gemini-api-key-here` (keys do NOT start with `sk-`)
- `PORT` = `10000` (Render sets this automatically, but you can override)

**Optional (speed):**
- `PREFERRED_MODEL` = e.g. `gemini-2.5-flash` or `gpt-4o` to force a fast model regardless of what the extension sends.
- `GEMINI_THINKING_BUDGET` = `0` to disable Gemini’s internal “thinking” (fastest), or `1024`–`8192` to limit it (speed/quality tradeoff). Only applies when using Gemini.

**Important Notes:**
- The proxy will automatically use Gemini if `GEMINI_API_KEY` is set, otherwise it uses OpenAI
- Never commit `.env` file to Git. Only use Render's environment variables
- To get a Gemini API key: https://ai.google.dev/
- Gemini API keys have a different format than OpenAI (they don't start with `sk-`)

### Step 5: Deploy

1. Click "Create Web Service"
2. Render will build and deploy your service
3. Wait for deployment to complete (usually 2-3 minutes)
4. Copy your service URL (e.g., `https://de-escalator-proxy.onrender.com`)

### Step 6: Update Extension Configuration

1. Open `config.js` in the extension directory
2. Set `PROXY_SERVER_URL` to your Render service URL:
   ```javascript
   const PROXY_SERVER_URL = "https://de-escalator-proxy.onrender.com";
   ```
3. Update the extension and test

## API Endpoints

### POST /api/rephrase

Main endpoint for rephrasing text.

**Request Body:**
```json
{
  "text": "Text to rephrase",
  "model": "gpt-4o",
  "temperature": 1.0,
  "max_tokens": 2048,
  "top_p": 1.0,
  "prompt": "Full prompt with {TEXT} placeholder"
}
```

**Response:**
```json
{
  "riskLevel": "High risk – Emotional escalation",
  "isEscalatory": true,
  "escalationType": "emotional",
  "rephrasedText": "I feel upset about this situation...",
  ...
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## Rate Limiting

- **Limit**: 20 requests per minute per IP address
- **Window**: 1 minute rolling window
- **Response**: 429 status code when exceeded

## Security Features

- API key stored server-side only (environment variable)
- CORS enabled for extension requests
- Request validation (text length, required fields)
- Rate limiting to prevent abuse
- Error handling for OpenAI API failures

## Monitoring

Check Render dashboard for:
- Logs and errors
- Request metrics
- Deployment status

## What affects rephrase speed?

- **Model** – Yes. With Gemini, the proxy uses `gemini-2.5-flash` by default (fast). Heavier models (e.g. `gemini-2.5-pro`) are slower. With OpenAI it uses `gpt-4o` (also fast). You can force a fast model on the server with `PREFERRED_MODEL=gemini-2.5-flash` (or leave unset to use the extension’s choice).
- **Render** – Yes. On the **free tier**, the service spins down after ~15 minutes of inactivity; the next request can see a **~1 minute cold start**. There can also be ~500–600 ms extra latency. A **paid** web service stays warm and usually has lower latency.
- **API key** – No. The key itself doesn’t affect speed. Which key you set (`GEMINI_API_KEY` vs `OPENAI_API_KEY`) only chooses the provider; both can be fast with the default models above.
- **Context size** – Sending a lot of text (long draft + long original post) increases prompt size and can add a few hundred ms. The extension already truncates to safe limits; keeping context “wide” is fine for quality.

For fastest perceived speed: use a paid Render instance (no cold starts), keep the default fast model (`gemini-2.5-flash` or `gpt-4o`), and ensure `config.js` doesn’t override to a heavier model.

## Step-by-step: Make rephrase faster (Gemini + Render)

Follow these in order if you want lower latency and fewer “slow” or “overloaded” responses.

### 1. Gemini: Enable paid tier (faster, higher rate limits)

1. Open [Google AI Studio](https://aistudio.google.com/) and sign in.
2. Go to **Settings** (gear) or your project’s **API key** / quota page.
3. Find **Quota tier** and click **Set up Billing** (or “Enable billing”).
4. Add a payment method. You only pay for what you use; Tier 1 (paid) gives ~150–300 requests/minute and often better latency than free.
5. Your existing `GEMINI_API_KEY` keeps working; the project’s tier (free vs paid) is what changes.

**Result:** Fewer rate limits and often faster responses. No code or env changes needed.

### 2. Proxy (Render): Set speed-related env vars

In **Render** → your web service → **Environment**:

| Variable | Value | Why |
|----------|--------|-----|
| `PREFERRED_MODEL` | `gemini-2.5-flash` | Force the fast model even if the extension sends something else. |
| `GEMINI_THINKING_BUDGET` | `0` | Turn off Gemini’s “thinking” for this task = faster and cheaper. Use `1024` or `2048` only if you want a bit more reasoning and accept slower responses. |

Save; Render will redeploy. No extension changes needed.

### 3. Render: Avoid cold starts (optional but big impact)

- **Free tier:** The service sleeps after ~15 min of no traffic; the next request can wait ~1 minute (cold start).
- **Paid tier:** Use a paid **Web Service** so the instance stays on. No cold starts and usually lower latency.

In Render: **Settings** → **Instance type** → choose a paid plan if you want 24/7 uptime and no spin-up delay.

### 4. Extension: Prefer the fast model (optional)

In the extension’s `config.js`, set the model to the same one as the proxy so the extension doesn’t request a heavier model:

```javascript
// Use the same fast model as the proxy
const API_CONFIG = {
  model: 'gemini-2.5-flash',  // or 'gpt-4o' if you use OpenAI
  // ... other options
};
```

If you use `PREFERRED_MODEL` on the proxy (step 2), the server overrides this anyway; setting it in `config.js` keeps things consistent.

---

**Summary:** Enable Gemini billing (1), set `PREFERRED_MODEL` and `GEMINI_THINKING_BUDGET=0` on Render (2), and optionally use a paid Render instance (3) and set the same model in `config.js` (4). That gives you the fastest setup without changing the extension code.

## Troubleshooting

### Server won't start

- Check that `OPENAI_API_KEY` is set in environment variables
- Verify Node.js version (requires 18+)
- Check logs in Render dashboard

### Extension can't connect

- Verify proxy server URL in `config.js` matches Render URL
- Check CORS settings (should allow all origins for extensions)
- Verify server is running (check `/health` endpoint)

### OpenAI API errors

- Verify API key is valid and has credits
- Check rate limits on OpenAI account
- Review error logs in Render dashboard

