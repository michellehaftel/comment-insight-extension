// Proxy server for De-Escalator extension
// Forwards OpenAI API requests while keeping API key server-side

const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

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

// Main proxy endpoint
app.post('/api/rephrase', rateLimiter, validateRequest, async (req, res) => {
  try {
    const { text, model, temperature, max_tokens, top_p } = req.body;
    
    // Get API key from environment
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('❌ OPENAI_API_KEY not configured in environment');
      return res.status(500).json({ 
        error: 'Server configuration error. Please contact support.' 
      });
    }
    
    // Prepare OpenAI request
    const prompt = process.env.ECPM_PROMPT || req.body.prompt;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    
    const openaiRequest = {
      model: model || 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: prompt.replace(/\{TEXT\}/g, text)
        }
      ],
      temperature: temperature || 1.0,
      max_tokens: max_tokens || 2048,
      top_p: top_p || 1.0,
      response_format: { type: 'json_object' }
    };
    
    console.log(`📝 Forwarding request to OpenAI (text length: ${text.length}, model: ${openaiRequest.model})`);
    
    // Forward to OpenAI
    const openaiResponse = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      openaiRequest,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: 30000 // 30 second timeout
      }
    );
    
    // Extract and return the response
    const responseText = openaiResponse.data.choices[0]?.message?.content || '';
    
    console.log(`✅ OpenAI response received (length: ${responseText.length})`);
    
    // Parse JSON response from OpenAI
    let parsed;
    try {
      parsed = typeof responseText === 'string' ? JSON.parse(responseText) : responseText;
    } catch (parseError) {
      console.error('❌ Failed to parse OpenAI response as JSON:', parseError);
      return res.status(500).json({ 
        error: 'Invalid response from AI service' 
      });
    }
    
    // Return the parsed response
    res.json(parsed);
    
  } catch (error) {
    console.error('❌ Error in proxy:', error.message);
    
    if (error.response) {
      // OpenAI API error
      console.error('OpenAI API error:', error.response.status, error.response.data);
      return res.status(error.response.status || 500).json({
        error: 'AI service error',
        details: error.response.data?.error?.message || 'Unknown error'
      });
    } else if (error.request) {
      // Request made but no response
      console.error('No response from OpenAI');
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
  console.log(`🔑 API key configured: ${process.env.OPENAI_API_KEY ? 'Yes' : 'No'}`);
});

