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
const RATE_LIMIT_MAX_REQUESTS = 100; // 100 requests per minute per IP (increased for better UX)

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

// Main proxy endpoint (rate limiter removed - AI services have their own rate limits)
app.post('/api/rephrase', validateRequest, async (req, res) => {
  try {
    const { text, context, model, temperature, max_tokens, top_p } = req.body;
    
    // Prepare prompt
    const prompt = process.env.ECPM_PROMPT || req.body.prompt;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    
    // Format context for the prompt
    let contextText = 'No context provided';
    if (context && context.originalPostContent && context.originalPostContent !== 'new') {
      contextText = `Original Post/Comment: "${context.originalPostContent.substring(0, 500)}"`;
      if (context.originalPostWriter && context.originalPostWriter !== 'new') {
        contextText += `\nAuthor: ${context.originalPostWriter}`;
      }
      if (context.isReply) {
        contextText += `\nContext Type: Reply to the above post/comment`;
      } else {
        contextText += `\nContext Type: Original post (not a reply)`;
      }
    } else {
      contextText = 'No context provided - this appears to be an original post (not a reply)';
    }
    
    // Replace placeholders in prompt
    let fullPrompt = prompt.replace(/\{TEXT\}/g, text);
    fullPrompt = fullPrompt.replace(/\{CONTEXT\}/g, contextText);
    
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
      // Use v1beta - this is the correct API version for current models
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;
      
      // Build request - use responseMimeType to request JSON format
      // Note: responseSchema might not be supported by all models, so we rely on prompt instructions + responseMimeType
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
      console.log(`📝 Prompt length: ${fullPrompt.length}`);
      
      // Make the actual request
      let geminiResponse;
      try {
        geminiResponse = await axios.post(
          geminiUrl,
          geminiRequest,
          {
            headers: {
              'Content-Type': 'application/json'
            },
            timeout: 30000
          }
        );
      } catch (axiosError) {
        console.error('❌ Axios error calling Gemini:', axiosError.message);
        if (axiosError.response) {
          console.error('📄 Gemini API response status:', axiosError.response.status);
          console.error('📄 Gemini API response data:', JSON.stringify(axiosError.response.data, null, 2));
        }
        throw axiosError;
      }
      
      console.log(`📄 Full Gemini response structure:`, JSON.stringify(geminiResponse.data, null, 2));
      
      // Check if we have candidates
      if (!geminiResponse.data.candidates || geminiResponse.data.candidates.length === 0) {
        console.error('❌ Gemini returned no candidates');
        console.error('📄 Full response:', JSON.stringify(geminiResponse.data, null, 2));
        return res.status(500).json({
          error: 'AI service returned no response',
          details: 'Gemini API returned an empty candidates array'
        });
      }
      
      const candidate = geminiResponse.data.candidates[0];
      
      // Check finish reason
      if (candidate.finishReason && candidate.finishReason !== 'STOP') {
        console.error(`⚠️ Gemini finish reason: ${candidate.finishReason}`);
        if (candidate.finishReason === 'SAFETY') {
          return res.status(500).json({
            error: 'Content was blocked by safety filters',
            details: 'The AI service blocked the response due to content safety policies.'
          });
        }
        if (candidate.finishReason === 'MAX_TOKENS') {
          console.warn('⚠️ Response truncated due to max tokens');
        }
      }
      
      responseText = candidate.content?.parts?.[0]?.text || '';
      console.log(`✅ Gemini response received (length: ${responseText.length})`);
      
      // ===== DETAILED LOGGING FOR MANUAL VALIDATION =====
      console.log('\n' + '='.repeat(80));
      console.log('🔍 RAW GEMINI RESPONSE FOR MANUAL VALIDATION');
      console.log('='.repeat(80));
      console.log('📄 Response Length:', responseText.length);
      console.log('📄 Response Type:', typeof responseText);
      console.log('📄 Starts with {?', responseText.trim().startsWith('{'));
      console.log('📄 Ends with }?', responseText.trim().endsWith('}'));
      console.log('📄 Contains markdown code blocks?', responseText.includes('```'));
      console.log('\n📄 FIRST 500 CHARACTERS:');
      console.log('-'.repeat(80));
      console.log(responseText.substring(0, 500));
      console.log('-'.repeat(80));
      console.log('\n📄 LAST 500 CHARACTERS:');
      console.log('-'.repeat(80));
      console.log(responseText.substring(Math.max(0, responseText.length - 500)));
      console.log('-'.repeat(80));
      console.log('\n📄 FULL RESPONSE (COMPLETE):');
      console.log('='.repeat(80));
      console.log(responseText);
      console.log('='.repeat(80));
      console.log('\n📄 FULL GEMINI RESPONSE STRUCTURE (raw API response):');
      console.log(JSON.stringify(geminiResponse.data, null, 2));
      console.log('='.repeat(80) + '\n');
      // ===== END DETAILED LOGGING =====
      
      // Log response structure for debugging
      if (!responseText || responseText.trim().length === 0) {
        console.error('❌ Gemini returned empty response');
        console.error('Full Gemini response structure:', JSON.stringify(geminiResponse.data, null, 2));
        
        // Check for finish reasons that indicate errors
        const finishReason = geminiResponse.data.candidates?.[0]?.finishReason;
        if (finishReason && finishReason !== 'STOP') {
          console.error(`⚠️ Gemini finish reason: ${finishReason}`);
          if (finishReason === 'SAFETY') {
            return res.status(500).json({
              error: 'Content was blocked by safety filters',
              details: 'The AI service blocked the response due to content safety policies.'
            });
          }
        }
        
        return res.status(500).json({
          error: 'AI service returned empty response',
          details: 'The AI service did not generate any text in the response.'
        });
      }
      
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
    
    // Parse JSON response - ULTRA-ROBUST parsing with multiple fallback strategies
    // Gemini might return JSON wrapped in markdown, with extra text, malformed, etc.
    let parsed;
    let parseAttempts = [];
    
    try {
      // Strategy 1: Direct parse (if response is pure JSON)
      try {
        parsed = JSON.parse(responseText.trim());
        console.log('✅ Strategy 1 succeeded: Direct JSON parse');
      } catch (e1) {
        parseAttempts.push('Direct parse failed: ' + e1.message);
        
        // Strategy 2: Extract from markdown code blocks (```json ... ```)
      try {
        const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/s);
        if (jsonMatch && jsonMatch[1]) {
          parsed = JSON.parse(jsonMatch[1].trim());
          console.log('✅ Strategy 2 succeeded: Extracted from markdown code block');
        } else {
          throw new Error('No code block match found');
        }
      } catch (e2) {
        parseAttempts.push('Code block extraction failed: ' + e2.message);
        
        // Strategy 3: Find first complete JSON object in text (most common case)
        try {
          const firstBrace = responseText.indexOf('{');
          if (firstBrace !== -1) {
            // Start from first brace and find matching closing brace
            let braceCount = 0;
            let lastBrace = -1;
            for (let i = firstBrace; i < responseText.length; i++) {
              if (responseText[i] === '{') braceCount++;
              if (responseText[i] === '}') {
                braceCount--;
                if (braceCount === 0) {
                  lastBrace = i;
                  break;
                }
              }
            }
            
            if (lastBrace !== -1) {
              const jsonCandidate = responseText.substring(firstBrace, lastBrace + 1);
              parsed = JSON.parse(jsonCandidate);
              console.log('✅ Strategy 3 succeeded: Extracted JSON object from text');
            } else {
              throw new Error('Could not find matching closing brace');
            }
          } else {
            throw new Error('No opening brace found');
          }
        } catch (e3) {
          parseAttempts.push('Object extraction failed: ' + e3.message);
          
          // Strategy 4: Try to fix common JSON issues (trailing commas, etc.)
          try {
            let cleaned = responseText.trim();
            // Remove markdown code block markers
            cleaned = cleaned.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
            // Find JSON object
            const objMatch = cleaned.match(/\{[\s\S]*\}/);
            if (objMatch) {
              let jsonStr = objMatch[0];
              // Fix trailing commas before } or ]
              jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
              // Fix trailing commas in arrays
              jsonStr = jsonStr.replace(/,(\s*])/g, ']');
              parsed = JSON.parse(jsonStr);
              console.log('✅ Strategy 4 succeeded: Fixed common JSON issues');
            } else {
              throw new Error('No JSON object found after cleaning');
            }
          } catch (e4) {
            parseAttempts.push('JSON fixing failed: ' + e4.message);
            
            // Strategy 5: Try to extract JSON from text that might have explanation
            try {
              // Look for common JSON start patterns
              const patterns = [
                /\{[\s\S]{20,10000}\}/,  // General JSON object (20-10000 chars)
                /\{"rephrasedText"[\s\S]*\}/,  // JSON starting with our expected field
                /\{"riskLevel"[\s\S]*\}/,  // JSON starting with riskLevel
              ];
              
              for (const pattern of patterns) {
                const match = responseText.match(pattern);
                if (match) {
                  try {
                    parsed = JSON.parse(match[0]);
                    console.log('✅ Strategy 5 succeeded: Pattern-based extraction');
                    break;
                  } catch (parseErr) {
                    continue;
                  }
                }
              }
              
              if (!parsed) {
                throw new Error('All pattern extractions failed');
              }
            } catch (e5) {
              parseAttempts.push('Pattern extraction failed: ' + e5.message);
              throw new Error('All JSON parsing strategies failed');
            }
          }
        }
      }
    }
    
    // If we still don't have parsed JSON, throw error with all attempts logged
    if (!parsed) {
      const parseError = new Error('Failed to parse JSON after all strategies');
      parseError.attempts = parseAttempts;
      throw parseError;
    }
    
    console.log('✅ Successfully parsed JSON response');
    } catch (parseError) {
      // Handle JSON parsing errors specifically
      console.error('❌ FAILED TO PARSE JSON AFTER ALL STRATEGIES');
      console.error('Parse error:', parseError.message);
      if (parseError.attempts) {
        console.error('All parse attempts:', parseError.attempts);
      }
      console.error('Raw response (first 2000 chars):', responseText.substring(0, 2000));
      console.error('Raw response length:', responseText.length);
      console.error('Response type:', typeof responseText);
      console.error('Response starts with:', responseText.substring(0, 100));
      console.error('Response ends with:', responseText.substring(Math.max(0, responseText.length - 100)));
      console.error('FULL RESPONSE FOR DEBUGGING:', responseText);
      
      // Check if response is empty
      if (!responseText || responseText.trim().length === 0) {
        return res.status(500).json({ 
          error: 'Invalid response from AI service',
          details: 'AI service returned an empty response'
        });
      }
      
      // Return detailed error with full response for debugging
      const errorResponse = {
        error: 'Invalid response from AI service',
        details: 'AI service response is not valid JSON. All parsing strategies failed.',
        debug: { 
          responsePreview: responseText.substring(0, 1000),
          responseLength: responseText.length,
          parseError: parseError.message,
          parseAttempts: parseError.attempts || parseAttempts,
          responseStart: responseText.substring(0, 100),
          responseEnd: responseText.substring(Math.max(0, responseText.length - 100)),
          hasCodeBlocks: responseText.includes('```'),
          hasJsonStart: responseText.trim().startsWith('{'),
          hasJsonEnd: responseText.trim().endsWith('}')
        }
      };
      
      return res.status(500).json(errorResponse);
    }
    
    // Extract rephrasedText from the response
    // The response should have a rephrasedText field (can be null if text is already de-escalatory)
    let rephrasedText = null;
    let hasRephrasedTextField = false;
    
    if (parsed && typeof parsed === 'object') {
      // Check if rephrasedText field exists (even if null)
      if ('rephrasedText' in parsed) {
        hasRephrasedTextField = true;
        rephrasedText = parsed.rephrasedText;
      } else if ('rephrased' in parsed) {
        hasRephrasedTextField = true;
        rephrasedText = parsed.rephrased;
      } else if ('text' in parsed) {
        hasRephrasedTextField = true;
        rephrasedText = parsed.text;
      }
    }
    
    // If rephrasedText field doesn't exist at all, return error
    // But if it's null (meaning text is already de-escalatory), that's valid
    if (!hasRephrasedTextField) {
      console.error('❌ No rephrasedText field found in AI response:', parsed);
      return res.status(500).json({ 
        error: 'AI response missing rephrasedText field',
        details: 'The AI service response did not contain the expected rephrasedText field.',
        debug: { parsedResponse: parsed }
      });
    }
    
    // Return consistent format (rephrasedText can be null if text is already de-escalatory)
    res.json({ rephrasedText });
    
  } catch (error) {
    console.error('❌ Error in proxy:', error.message);
    
    if (error.response) {
      // AI API error - handle rate limits specifically
      const status = error.response.status;
      console.error(`${API_PROVIDER.toUpperCase()} API error:`, status, error.response.data);
      
      if (status === 429) {
        // Rate limit from AI service - return helpful message
        return res.status(429).json({
          error: 'AI service rate limit exceeded',
          details: 'The AI service is temporarily busy. Please try again in a moment.',
          retryAfter: 60 // Suggest waiting 60 seconds
        });
      }
      
      const errorMessage = error.response.data?.error?.message || 
                          error.response.data?.message ||
                          (typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data));
      return res.status(status || 500).json({
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

