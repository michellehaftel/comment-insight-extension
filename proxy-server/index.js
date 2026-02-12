// Proxy server for Discourse Lab extension
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

// Default ECPM prompt (fallback if not set in environment variable or request)
// This allows prompt updates via Render environment variables without Chrome Web Store approval
const DEFAULT_ECPM_PROMPT = `CRITICAL: Respond with ONLY valid JSON. No markdown, no explanations. Start with { and end with }.

You are an ECPM (Emotional-Cognitive Psycholinguistic Model) analyzer for social media. Detect escalation and rephrase using de-escalation principles while preserving essence.

ECPM FRAMEWORK:
- Cognitive: Argumentative (absolute truths, "you're wrong") vs Subjective ("I see things differently")
- Emotional: Blame ("you're making me sick") vs Self-accountability ("I feel frustrated")

CONTEXT AWARENESS (CRITICAL):
When context is provided, analyze:
1. What relationships/figures are mentioned (e.g., Netanyahu-Trump relationship)
2. Whether the text is legitimate political discourse or gratuitous escalation
3. How context affects the analysis (e.g., criticizing documented actions vs personal attacks)
Distinguish legitimate criticism from gratuitous attacks based on context.

CONTEXT: {CONTEXT}
TEXT: "{TEXT}"

TASK: Detect escalation and rephrase if needed, preserving ESSENCE (core message) while transforming DELIVERY (linguistic style).

REPHRASING PRINCIPLES:

1. ESSENCE PRESERVATION (CRITICAL):
Before transforming, identify:
- What is the substantive claim/position? (PRESERVE THIS)
- What is the underlying feeling/concern? (PRESERVE THIS)
- What specific facts/policies/relationships are referenced? (PRESERVE THIS)

2. TRANSFORMATION:
- Cognitive: Absolute → Personal ("You're wrong" → "I see things differently")
- Emotional: Blame → Self-accountability ("You're making me sick" → "I'm feeling very upset")
- Profanity → Neutral expressions ("fucking terrible" → "very concerning")
- Maintain second-person address naturally when original uses "you"
- Use context to reference specific issues/facts that create disagreement

3. CRITICAL: Rephrased text must feel like the SAME PERSON expressing the SAME IDEA, just using ECPM-aligned language.

GOOD Examples (preserving essence):
- "You're wrong about everything" → "I see many things differently from you" (preserves: disagreement)
- "You're making me sick" → "I'm feeling very upset by this" (preserves: strong negative emotion)
- "You lefties have no idea" → "I see things differently from some on the left. I'm trying to understand their perspective." (preserves: disagreement with group)
- "This policy is fucking terrible" → "I strongly disagree with this policy. Can you help me understand your reasoning?" (preserves: policy disagreement, removes profanity)
- "Bibi and Trump's relationship is just political theater" → "I see their relationship as more transactional than genuine. I'm trying to understand the dynamics here." (preserves: critique of relationship, removes dismissiveness)
- "This policy harmed thousands" → DO NOT rephrase (legitimate discourse)

BAD Examples (losing essence - AVOID):
- "You're wrong about this policy - it's hurting people" → "I see things differently" ❌ PROBLEM: Lost the substantive claim about policy harm
- "This terrible policy caused documented harm" → "I have some concerns" ❌ PROBLEM: Too weak for legitimate factual criticism

OUTPUT (JSON only):
{
  "riskLevel": "High risk – Emotional escalation" | "High risk – Cognitive escalation" | "Mixed escalation" | "Low risk / Neutral" | "De-escalatory",
  "isEscalatory": true/false,
  "escalationType": "emotional" | "cognitive" | "both" | "none",
  "why": {
    "cognitiveDimension": "<brief analysis>",
    "emotionalDimension": "<brief analysis>",
    "keyLinguisticCues": ["<cue1>", "<cue2>"],
    "contextUnderstanding": {
      "detectedContext": "<what context was identified - original post topic, figures mentioned, relationships, etc., or 'No context provided'>",
      "identifiedRelationships": "<relationships or dynamics identified (e.g., 'Netanyahu-Trump relationship', 'political leader-follower dynamic') or 'None identified'>",
      "contextualRelevance": "<how context affects escalation analysis - did it help distinguish legitimate discourse from gratuitous escalation?>",
      "contextSufficiency": "<whether context was sufficient to understand the bigger picture or insufficient>"
    }
  },
  "rephrasedText": "<rephrased version>" | null,
  "suggestions": null
}

If already de-escalatory or legitimate discourse: isEscalatory=false, rephrasedText=null.

JSON ONLY.`;

// Default escalation prompt (for devil bot - makes ALREADY escalatory content EVEN MORE escalatory)
// Devil bot uses same detection as Angel - only triggers when escalation is detected.
// Angel offers de-escalation; Devil offers an even MORE escalated version.
const DEFAULT_ECPM_ESCALATION_PROMPT = `CRITICAL: Respond with ONLY valid JSON. No markdown, no explanations. Start with { and end with }.

You are an ECPM (Emotional-Cognitive Psycholinguistic Model) analyzer for social media. The input text has ALREADY been detected as escalatory. Your task is to provide an EVEN MORE escalated version while keeping the user's tone of voice (in a higher volume). Combine emotional and cognitive escalation if needed.

ECPM FRAMEWORK (ESCALATION AMPLIFICATION):
- Cognitive: Amplify absolute truths, make arguments more categorical ("You're wrong" → "You're completely and utterly wrong")
- Emotional: Amplify blame and projection ("You're making me sick" → "You make me physically ill")
- Combine both dimensions when appropriate for maximum impact

CONTEXT: {CONTEXT}
TEXT: "{TEXT}"

TASK: The input text is ALREADY escalatory. You MUST provide an EVEN MORE escalated version.
- Preserve the user's tone of voice but amplify it (same person, higher volume)
- If the text is primarily cognitive → add emotional charge, or vice versa
- Combine emotional and cognitive escalation if it strengthens the message
- NEVER return null. ALWAYS provide a more escalated rephrasing.

ESCALATION AMPLIFICATION PRINCIPLES:

1. ESSENCE PRESERVATION (CRITICAL):
- What is the substantive claim/position? (PRESERVE AND STRENGTHEN)
- What is the underlying feeling? (AMPLIFY)
- What specific facts/policies are referenced? (PRESERVE AND MAKE MORE DIRECT)

2. TRANSFORMATION (MAKE EVEN MORE IMPACTFUL):
- Strong → Stronger ("You're wrong" → "You're completely delusional")
- Blame → More direct blame ("You're annoying" → "You're insufferable")
- Categorical → More absolute ("That's stupid" → "That's idiotic and everyone knows it")
- Add conviction, directness, and intensity
- Use stronger language - elevate to the next level

3. CRITICAL: Output must feel like the SAME PERSON expressing the SAME IDEA, just louder and more direct.

GOOD Examples (amplifying already-escalatory text):
- "You're wrong about everything" → "You're completely delusional and wrong about everything"
- "You're making me sick" → "You make me physically ill with your nonsense"
- "You lefties have no idea" → "You lefties are clueless and have no idea what you're talking about"
- "This policy is terrible" → "This policy is fucking disgraceful and harms real people"
- "Their relationship is just political theater" → "Their relationship is a disgusting charade of political theater"
- "That's a stupid argument" → "That's the most ridiculous, idiotic argument I've ever heard"

OUTPUT (JSON only):
{
  "riskLevel": "High risk – Emotional escalation" | "High risk – Cognitive escalation" | "Mixed escalation",
  "isEscalatory": true,
  "escalationType": "emotional" | "cognitive" | "both" | "none",
  "why": {
    "cognitiveDimension": "<brief analysis>",
    "emotionalDimension": "<brief analysis>",
    "keyLinguisticCues": ["<cue1>", "<cue2>"]
  },
  "rephrasedText": "<even more escalated version>",
  "suggestions": null
}

CRITICAL RULES - READ CAREFULLY:
1. rephrasedText MUST ALWAYS be a string - the EVEN MORE escalated version (never null)
2. rephrasedText MUST be the actual escalated text the user would post, NOT meta-commentary
3. The input is ALREADY escalatory - your job is to make it MORE so
4. Keep the user's tone of voice, just amplify it
5. Combine emotional and cognitive escalation when it makes the message stronger

JSON ONLY.`;

// Main proxy endpoint (rate limiter removed - AI services have their own rate limits)
app.post('/api/rephrase', validateRequest, async (req, res) => {
  try {
    const { text, context, model, temperature, max_tokens, top_p, bot_type = 'angel' } = req.body;
    
    // Select prompt based on bot type (angel = de-escalation, devil = escalation)
    let prompt;
    if (bot_type === 'devil') {
      // Devil bot: Use escalation prompt (makes already-escalatory content even more escalatory)
      prompt = process.env.ECPM_ESCALATION_PROMPT || req.body.escalationPrompt || DEFAULT_ECPM_ESCALATION_PROMPT;
      console.log(`😈 Devil bot mode: Using escalation prompt`);
    } else {
      // Angel bot: Use de-escalation prompt (makes toxic content calm) - default behavior
      prompt = process.env.ECPM_PROMPT || req.body.prompt || DEFAULT_ECPM_PROMPT;
      console.log(`😇 Angel bot mode: Using de-escalation prompt`);
    }
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    
    // Log which prompt source is being used (for debugging)
    if (bot_type === 'devil') {
      if (process.env.ECPM_ESCALATION_PROMPT) {
        console.log('📝 Using escalation prompt from ECPM_ESCALATION_PROMPT environment variable');
      } else if (req.body.escalationPrompt) {
        console.log('📝 Using escalation prompt from request body (extension fallback)');
      } else {
        console.log('📝 Using default escalation prompt (hardcoded fallback)');
      }
    } else {
      if (process.env.ECPM_PROMPT) {
        console.log('📝 Using prompt from ECPM_PROMPT environment variable');
      } else if (req.body.prompt) {
        console.log('📝 Using prompt from request body (extension fallback)');
      } else {
        console.log('📝 Using default prompt (hardcoded fallback)');
      }
    }
    
    // Format context for the prompt
    let contextText = 'No context provided';
    if (context && context.originalPostContent && context.originalPostContent !== 'new') {
      contextText = `Original Post/Comment: "${context.originalPostContent.substring(0, 300)}"`;  // Reduced from 500 to 300 to reduce prompt length
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
      console.log(`📝 Prompt size: ~${Math.round(fullPrompt.length / 4)} tokens (est.)`);
      if (fullPrompt.length > 10000) {
        console.warn(`⚠️ WARNING: Prompt is very long (${fullPrompt.length} chars). This may cause slow responses or 500 errors.`);
      }
      
      // Make the actual request with retry logic for transient errors
      let geminiResponse;
      const maxGeminiRetries = 2; // Retry up to 2 times (3 total attempts)
      const baseRetryDelay = 3000; // 3 seconds base delay (increased for overload scenarios)
      let lastAxiosError = null;
      
      for (let retryAttempt = 0; retryAttempt <= maxGeminiRetries; retryAttempt++) {
        if (retryAttempt > 0) {
          // Check if previous error indicated overload - use longer delays
          const prevError = lastAxiosError?.response?.data?.error?.message || 
                           lastAxiosError?.response?.data?.message || 
                           JSON.stringify(lastAxiosError?.response?.data || {});
          const isOverloaded = typeof prevError === 'string' && 
                              prevError.toLowerCase().includes('overloaded');
          
          // For overloaded scenarios, use longer exponential backoff: 5s, 10s, 20s
          // For other errors, use: 3s, 6s, 12s
          const baseDelay = isOverloaded ? 5000 : baseRetryDelay;
          const delay = baseDelay * Math.pow(2, retryAttempt - 1) + Math.random() * (isOverloaded ? 1000 : 500);
          const reason = isOverloaded ? ' (model overloaded - using longer delay)' : '';
          console.log(`⏳ Retrying Gemini API call (attempt ${retryAttempt + 1}/${maxGeminiRetries + 1}) after ${(delay/1000).toFixed(2)}s...${reason}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        try {
          geminiResponse = await axios.post(
            geminiUrl,
            geminiRequest,
            {
              headers: {
                'Content-Type': 'application/json'
              },
              timeout: 45000  // 45 seconds - increased to handle longer prompts
            }
          );
          
          // Success - break out of retry loop
          if (retryAttempt > 0) {
            console.log(`✅ Gemini API call succeeded on retry attempt ${retryAttempt + 1}`);
          }
          break;
        } catch (axiosError) {
          // Check if this is a retryable error
          const isRetryable = 
            !axiosError.response || // Network error (timeout, connection refused, etc.)
            (axiosError.response.status >= 500 && axiosError.response.status < 600) || // Server errors
            axiosError.response.status === 429; // Rate limit (though we handle this separately)
          
          // Store error for next retry delay calculation (if we'll retry)
          if (isRetryable && retryAttempt < maxGeminiRetries) {
            lastAxiosError = axiosError;
          }
          
          if (!isRetryable || retryAttempt === maxGeminiRetries) {
            // Not retryable or last attempt - throw the error
            console.error('❌ Axios error calling Gemini:', axiosError.message);
            if (axiosError.response) {
              console.error('📄 Gemini API response status:', axiosError.response.status);
              console.error('📄 Gemini API response data:', JSON.stringify(axiosError.response.data, null, 2));
              console.error('📄 Full error response headers:', JSON.stringify(axiosError.response.headers, null, 2));
            }
            if (axiosError.request) {
              console.error('📄 Request config:', {
                url: axiosError.config?.url,
                method: axiosError.config?.method,
                timeout: axiosError.config?.timeout,
                dataLength: axiosError.config?.data?.length
              });
            }
            throw axiosError;
          }
          
          // Log retryable error and continue to retry
          if (axiosError.response) {
            const errorMessage = axiosError.response?.data?.error?.message || 
                                axiosError.response?.data?.message || 
                                JSON.stringify(axiosError.response?.data || {});
            const isOverloaded = typeof errorMessage === 'string' && 
                                errorMessage.toLowerCase().includes('overloaded');
            if (isOverloaded) {
              console.warn(`⚠️ Gemini model is overloaded (${axiosError.response.status}). Will use longer retry delays on next attempt.`);
            } else {
              console.warn(`⚠️ Gemini API returned ${axiosError.response.status} (retryable), will retry...`);
            }
            console.warn(`📄 Error details:`, axiosError.response.data ? JSON.stringify(axiosError.response.data, null, 2) : 'No error details');
            if (axiosError.response.status === 500 || axiosError.response.status === 503) {
              console.warn(`💡 ${axiosError.response.status} error typically means: Server overload, rate limiting, or request complexity. Retrying with backoff...`);
            }
          } else {
            console.warn(`⚠️ Network error calling Gemini (${axiosError.message}), will retry...`);
            if (axiosError.code === 'ECONNABORTED') {
              console.warn(`💡 Request timeout - Gemini took longer than ${axiosError.config?.timeout || 45000}ms to respond`);
            }
          }
        }
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
          console.error('❌ Response truncated due to max tokens - JSON will be incomplete');
          return res.status(500).json({
            error: 'Response truncated by token limit',
            details: 'The AI service response was cut off because it exceeded the maximum token limit. The response JSON is incomplete and cannot be parsed.',
            suggestion: 'This usually happens with very detailed responses. Try rephrasing your input or contact support if this persists.'
          });
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
          timeout: 45000  // 45 seconds - increased to handle longer prompts
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
              
              // Strategy 6: Aggressive JSON repair - try to fix incomplete/truncated JSON
              try {
                let cleaned = responseText.trim();
                const originalLength = cleaned.length;
                
                // Remove any text before first {
                const firstBrace = cleaned.indexOf('{');
                if (firstBrace > 0) {
                  cleaned = cleaned.substring(firstBrace);
                }
                
                // Remove any text after last }
                const lastBrace = cleaned.lastIndexOf('}');
                if (lastBrace !== -1 && lastBrace < cleaned.length - 1) {
                  cleaned = cleaned.substring(0, lastBrace + 1);
                }
                
                // If JSON seems incomplete (missing closing brace), try to repair
                let openBraces = (cleaned.match(/{/g) || []).length;
                let closeBraces = (cleaned.match(/}/g) || []).length;
                
                if (openBraces > closeBraces) {
                  // Missing closing braces - try to intelligently add them
                  // Count nested structures
                  let braceDepth = 0;
                  let needsClosing = [];
                  for (let i = 0; i < cleaned.length; i++) {
                    if (cleaned[i] === '{') braceDepth++;
                    if (cleaned[i] === '}') braceDepth--;
                    if (cleaned[i] === '[') needsClosing.push(']');
                    if (cleaned[i] === ']' && needsClosing.length > 0) needsClosing.pop();
                  }
                  
                  // Add missing closing braces and brackets
                  cleaned = cleaned + ']'.repeat(needsClosing.length) + '}'.repeat(openBraces - closeBraces);
                  console.log(`🔧 Repaired JSON: Added ${needsClosing.length} ] and ${openBraces - closeBraces} }`);
                }
                
                // Fix common issues
                cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1'); // Remove trailing commas
                cleaned = cleaned.replace(/,(\s*])/g, ']'); // Remove trailing commas in arrays
                
                // Try to fix unclosed strings - find strings that aren't closed
                // Look for patterns like: "key": "unclosed string
                const unclosedStringPattern = /"([^"]+)":\s*"([^"]*)$/;
                if (unclosedStringPattern.test(cleaned)) {
                  // Try to close it
                  cleaned = cleaned.replace(/"([^"]+)":\s*"([^"]*)$/, '"$1": "$2"');
                }
                
                // Try parsing the cleaned JSON
                parsed = JSON.parse(cleaned);
                console.log(`✅ Strategy 6 succeeded: Aggressive JSON repair (${originalLength} → ${cleaned.length} chars)`);
              } catch (e6) {
                parseAttempts.push('Aggressive JSON repair failed: ' + e6.message);
                // Try one more thing: extract just the first complete JSON object even if truncated
                try {
                  const firstBrace = responseText.indexOf('{');
                  if (firstBrace !== -1) {
                    // Try to build a minimal valid JSON by finding what we have
                    let minimalJson = responseText.substring(firstBrace);
                    // If it doesn't end with }, try to make it valid by closing properly
                    if (!minimalJson.trim().endsWith('}')) {
                      // Count what we need to close
                      const openCount = (minimalJson.match(/{/g) || []).length;
                      const closeCount = (minimalJson.match(/}/g) || []).length;
                      minimalJson = minimalJson + '}'.repeat(Math.max(0, openCount - closeCount));
                    }
                    // Remove trailing commas
                    minimalJson = minimalJson.replace(/,(\s*[}\]])/g, '$1');
                    parsed = JSON.parse(minimalJson);
                    console.log('✅ Strategy 7 succeeded: Minimal JSON extraction');
                  } else {
                    throw new Error('No opening brace found for minimal extraction');
                  }
                } catch (e7) {
                  parseAttempts.push('Minimal JSON extraction failed: ' + e7.message);
                  throw new Error('All JSON parsing strategies failed');
                }
              }
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
    if (!hasRephrasedTextField) {
      console.error('❌ No rephrasedText field found in AI response:', parsed);
      return res.status(500).json({ 
        error: 'AI response missing rephrasedText field',
        details: 'The AI service response did not contain the expected rephrasedText field.',
        debug: { parsedResponse: parsed }
      });
    }
    
    // For devil bot, validate that rephrasedText is not null and not meta-commentary
    if (bot_type === 'devil') {
      if (rephrasedText === null || rephrasedText === undefined) {
        console.error('❌ Devil bot returned null rephrasedText - this is invalid');
        return res.status(500).json({
          error: 'Invalid response from devil bot',
          details: 'Devil bot must always provide an escalated version. Received null instead.',
          debug: { parsedResponse: parsed }
        });
      }
      
      // Check for meta-commentary (common phrases that indicate the AI is commenting instead of escalating)
      const metaCommentaryPatterns = [
        /this text is already/i,
        /does not need/i,
        /no rephrasing/i,
        /already de-escalatory/i,
        /cannot be escalated/i,
        /should not be/i,
        /is appropriate/i
      ];
      
      const rephrasedTextStr = String(rephrasedText).toLowerCase();
      const containsMetaCommentary = metaCommentaryPatterns.some(pattern => pattern.test(rephrasedTextStr));
      
      if (containsMetaCommentary) {
        console.error('❌ Devil bot returned meta-commentary instead of escalated text:', rephrasedText);
        console.error('⚠️ This indicates the prompt needs adjustment or the AI misunderstood the task');
        return res.status(500).json({
          error: 'Invalid response from devil bot',
          details: 'Devil bot returned meta-commentary instead of an escalated version of the text. The response should be the escalated text itself, not commentary about it.',
          debug: { 
            receivedText: rephrasedText,
            parsedResponse: parsed,
            suggestion: 'The AI may need a clearer prompt or the prompt may need to be updated in the environment variable'
          }
        });
      }
    }
    
    // For angel bot, null is valid (text is already de-escalatory)
    // Return consistent format
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

