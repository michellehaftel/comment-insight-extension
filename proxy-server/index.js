// Proxy server for De-Escalator extension
// Forwards AI API requests (OpenAI or Gemini) while keeping API key server-side

const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Determine which API provider to use (defaults to OpenAI, but can use GEMINI_API_KEY if set)
const USE_GEMINI = !!process.env.GEMINI_API_KEY;
const API_PROVIDER = USE_GEMINI ? 'gemini' : 'openai';

// Middleware
app.use(cors({
  origin: '*', // Allow requests from Chrome extension (extension URLs vary)
  credentials: true
}));
app.use(express.json());

// Rate limiting storage (simple in-memory for now)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 20; // 20 requests per minute per IP

// Simple rate limiting middleware
function rateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return next();
  }
  
  const limit = rateLimitMap.get(ip);
  
  if (now > limit.resetTime) {
    // Reset window
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return next();
  }
  
  if (limit.count >= RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({ 
      error: 'Rate limit exceeded. Please try again later.' 
    });
  }
  
  limit.count++;
  next();
}

// Validate request
function validateRequest(req, res, next) {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Invalid request body' });
  }
  
  if (!req.body.text || typeof req.body.text !== 'string' || req.body.text.trim().length === 0) {
    return res.status(400).json({ error: 'Text field is required and must be non-empty' });
  }
  
  // Limit text length to prevent abuse
  if (req.body.text.length > 5000) {
    return res.status(400).json({ error: 'Text too long (max 5000 characters)' });
  }
  
  next();
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Debug endpoint to check API key configuration (helpful for troubleshooting)
app.get('/debug/config', (req, res) => {
  const hasGeminiKey = !!process.env.GEMINI_API_KEY;
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
  const provider = hasGeminiKey ? 'gemini' : 'openai';
  
  res.json({
    provider: provider,
    hasGeminiKey: hasGeminiKey,
    hasOpenAIKey: hasOpenAIKey,
    geminiKeyLength: process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.length : 0,
    openAIKeyLength: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0,
    geminiKeyPrefix: process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 10) + '...' : 'not set',
    openAIKeyPrefix: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 10) + '...' : 'not set'
  });
});

// Main proxy endpoint
app.post('/api/rephrase', rateLimiter, validateRequest, async (req, res) => {
  try {
    const { text, model, temperature, max_tokens, top_p } = req.body;
    
    // Prepare prompt
    const prompt = process.env.ECPM_PROMPT || req.body.prompt;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    
    const fullPrompt = prompt.replace(/\{TEXT\}/g, text);
    
    let responseText = '';
    
    if (USE_GEMINI) {
      // Use Google Gemini API
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.error('❌ GEMINI_API_KEY not configured in environment');
        console.error('   Available env vars:', Object.keys(process.env).filter(k => k.includes('API') || k.includes('KEY')).join(', '));
        return res.status(500).json({ 
          error: 'GEMINI_API_KEY not configured. Please set GEMINI_API_KEY in Render environment variables and redeploy.',
          hint: 'Check /debug/config endpoint to see current configuration'
        });
      }
      
      const geminiModel = model || 'gemini-2.5-flash';
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;
      
      const geminiRequest = {
        contents: [{
          parts: [{
            text: fullPrompt
          }]
        }],
        generationConfig: {
          temperature: temperature || 1.0,
          maxOutputTokens: max_tokens || 2048,
          topP: top_p || 1.0,
          responseMimeType: 'application/json'
        }
      };
      
      console.log(`📝 Forwarding request to Gemini (text length: ${text.length}, model: ${geminiModel})`);
      
      const geminiResponse = await axios.post(
        geminiUrl,
        geminiRequest,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );
      
      responseText = geminiResponse.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      console.log(`✅ Gemini response received (length: ${responseText.length})`);
      
    } else {
      // Use OpenAI API
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        console.error('❌ OPENAI_API_KEY not configured in environment');
        return res.status(500).json({ 
          error: 'Server configuration error. Please contact support.' 
        });
      }
      
      const openaiRequest = {
        model: model || 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: fullPrompt
          }
        ],
        temperature: temperature || 1.0,
        max_tokens: max_tokens || 2048,
        top_p: top_p || 1.0,
        response_format: { type: 'json_object' }
      };
      
      console.log(`📝 Forwarding request to OpenAI (text length: ${text.length}, model: ${openaiRequest.model})`);
      
      const openaiResponse = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        openaiRequest,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          timeout: 30000
        }
      );
      
      responseText = openaiResponse.data.choices[0]?.message?.content || '';
      console.log(`✅ OpenAI response received (length: ${responseText.length})`);
    }
    
    // Parse JSON response
    let parsed;
    try {
      parsed = typeof responseText === 'string' ? JSON.parse(responseText) : responseText;
    } catch (parseError) {
      console.error('❌ Failed to parse AI response as JSON:', parseError);
      console.error('Raw response:', responseText);
      return res.status(500).json({ 
        error: 'Invalid response from AI service' 
      });
    }
    
    // Extract rephrasedText from the response
    // The response should have a rephrasedText field
    let rephrasedText = null;
    if (parsed && typeof parsed === 'object') {
      rephrasedText = parsed.rephrasedText || parsed.rephrased || parsed.text || null;
    }
    
    // If no rephrasedText found, return error
    if (!rephrasedText) {
      console.error('❌ No rephrasedText found in AI response:', parsed);
      return res.status(500).json({ 
        error: 'AI response missing rephrasedText field',
        details: 'The AI service response did not contain the expected rephrasedText field.'
      });
    }
    
    // Return consistent format
    res.json({ rephrasedText });
    
  } catch (error) {
    console.error('❌ Error in proxy:', error.message);
    
    if (error.response) {
      // AI API error
      console.error(`${API_PROVIDER.toUpperCase()} API error:`, error.response.status, error.response.data);
      const errorMessage = error.response.data?.error?.message || 
                          error.response.data?.message ||
                          (typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data));
      return res.status(error.response.status || 500).json({
        error: 'AI service error',
        details: errorMessage
      });
    } else if (error.request) {
      // Request made but no response
      console.error(`No response from ${API_PROVIDER.toUpperCase()}`);
      return res.status(504).json({
        error: 'Request timeout. The AI service did not respond in time.'
      });
    } else {
      // Error setting up request
      return res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Proxy server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🤖 Using API provider: ${API_PROVIDER.toUpperCase()}`);
  if (USE_GEMINI) {
    console.log(`🔑 Gemini API key configured: ${process.env.GEMINI_API_KEY ? 'Yes' : 'No'}`);
  } else {
    console.log(`🔑 OpenAI API key configured: ${process.env.OPENAI_API_KEY ? 'Yes' : 'No'}`);
  }
});

