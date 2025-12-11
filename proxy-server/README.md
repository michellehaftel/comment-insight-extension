# De-Escalator Proxy Server

Proxy server for securely handling OpenAI API calls from the De-Escalator Chrome extension. Keeps API keys server-side and provides rate limiting and monitoring.

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

Add these environment variables:
- `OPENAI_API_KEY` = `sk-your-actual-api-key-here`
- `PORT` = `10000` (Render sets this automatically, but you can override)

**Important**: Never commit `.env` file to Git. Only use Render's environment variables.

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

