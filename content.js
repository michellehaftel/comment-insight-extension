// This content.js script detects input in any contenteditable or textarea
// and displays a basic tooltip warning for potentially aggressive messages.

// === CONFIGURATION ===
const triggerThreshold = 0.7; // Dummy threshold for "aggressiveness"

// === UTILITIES ===
function isAggressive(text) {
  const aggressiveKeywords = ["stupid", "idiot", "hate", "worst", "angry", "asshole"];
  return aggressiveKeywords.some((word) => text.toLowerCase().includes(word));
}

function isTwitter() {
  return window.location.hostname.includes('twitter.com');
}

function isFacebook() {
  return window.location.hostname.includes('facebook.com');
}

function extractTwitterContext() {
  if (!isTwitter()) return null;
  let context = '';
  // Try to find the original tweet (the main post in the thread)
  const tweet = document.querySelector('[data-testid="tweet"]');
  if (tweet) {
    context += `Original tweet: ${tweet.textContent}\n\n`;
  }
  // Try to find previous tweets (up to 3)
  const tweetElements = document.querySelectorAll('[data-testid="tweet"]');
  if (tweetElements.length > 0) {
    context += 'Previous tweets:\n';
    for (let i = 0; i < Math.min(tweetElements.length, 3); i++) {
      context += `- ${tweetElements[i].textContent}\n`;
    }
    context += '\n';
  }
  return context || null;
}

function extractFacebookContext() {
  if (!isFacebook()) return null;
  let context = '';
  // Try to find the original post (the main post in the thread)
  const post = document.querySelector('[role="article"] [data-ad-preview="message"]');
  if (post) {
    context += `Original post: ${post.textContent}\n\n`;
  }
  // Try to find previous comments (up to 3)
  const commentElements = document.querySelectorAll('[aria-label="Comment"] [data-ad-preview="message"]');
  if (commentElements.length > 0) {
    context += 'Previous comments:\n';
    for (let i = 0; i < Math.min(commentElements.length, 3); i++) {
      context += `- ${commentElements[i].textContent}\n`;
    }
    context += '\n';
  }
  return context || null;
}

// === TIPPY.JS LOADER ===
function loadTippyJs(callback) {
  if (window.tippy) return callback();
  const script = document.createElement('script');
  script.src = 'https://unpkg.com/@popperjs/core@2/dist/umd/popper.min.js';
  script.onload = () => {
    const tippyScript = document.createElement('script');
    tippyScript.src = 'https://unpkg.com/tippy.js@6/dist/tippy-bundle.umd.min.js';
    tippyScript.onload = callback;
    document.head.appendChild(tippyScript);
  };
  document.head.appendChild(script);
  // Add Tippy CSS
  if (!document.getElementById('tippy-css')) {
    const link = document.createElement('link');
    link.id = 'tippy-css';
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/tippy.js@6/dist/tippy.css';
    document.head.appendChild(link);
  }
}

// === OPENAI API CONFIG ===
// OPENAI_API_KEY is now loaded from config.js
if (typeof OPENAI_API_KEY === 'undefined') {
  alert('OPENAI_API_KEY is not set. Please create config.js with your API key.');
}
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const SYSTEM_PROMPT = `You are a de-escalation assistant trained to rewrite user messages that may escalate political or sensitive conversations. Based on the Emotional-Cognitive Psycholinguistic Model (ECPM), detect:
Cognitive escalation — absolute or generalized statements (e.g., “they always…”, “you are wrong”) that present a single truth.
Emotional escalation — accusatory or blaming language (e.g., “you just want to…”, “they are all…”) that projects negative feelings onto others.

If the message is escalatory, rephrase it to:
- Use subjective language (e.g., “I think…”, “In my experience…”)
- Reflect self-accountability and acknowledge complexity
- Remove blame and avoid generalizations

If the message is NOT escalatory, return it unchanged.
Return ONLY the full rephrased sentence (or the original if not escalatory), with no explanation.`;

// === DEBOUNCE ===
let debounceTimeout = null;
let lastText = "";

async function fetchRecentNews() {
  const url = `https://newsapi.org/v2/everything?q=Israel+Supreme+Court+OR+Netanyahu+trial+OR+Gaza+OR+October+7+OR+hostages+OR+Qatar-gate+OR+Lapid+OR+Gantz+OR+Regev+OR+Gotlib+OR+Udda+OR+Golan+OR+Benette&language=en&sortBy=publishedAt&domains=haaretz.com,ynet.co.il,israelhayom.co.il,cnn.com,bbc.co.uk&apiKey=4e2e399f21f74686808ecb302dee2b32`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.articles && data.articles.length > 0) {
      // Take top 3 headlines
      return data.articles.slice(0, 3).map(a => `${a.title} (${a.source.name})`).join('\\n');
    }
    return '';
  } catch (e) {
    return '';
  }
}

async function getRephrasedText(userText) {
  let messages = [
    { role: "system", content: SYSTEM_PROMPT }
  ];

  // Fetch news context
  const newsContext = await fetchRecentNews();
  if (newsContext) {
    messages.push({ role: "system", content: "Recent news context: " + newsContext });
  }

  if (isTwitter()) {
    const context = extractTwitterContext();
    if (context) {
      messages.push({
        role: "user", 
        content: `Thread context:\n${context}\nUser comment: ${userText}`
      });
    } else {
      messages.push({ role: "user", content: userText });
    }
  } else if (isFacebook()) {
    const context = extractFacebookContext();
    if (context) {
      messages.push({
        role: "user", 
        content: `Thread context:\n${context}\nUser comment: ${userText}`
      });
    } else {
      messages.push({ role: "user", content: userText });
    }
  } else {
    messages.push({ role: "user", content: userText });
  }
  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: messages,
      max_tokens: 150
    })
  });
  const data = await response.json();
  if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
    return data.choices[0].message.content.trim();
  } else {
    return userText; // fallback
  }
}

// === TOOLTIP UTILITIES ===
let currentTooltip = null;
function showCustomTooltip(target, originalText, suggestionText) {
  // Remove existing tooltip if any
  if (currentTooltip) {
    currentTooltip.remove();
    currentTooltip = null;
  }
  const tooltip = document.createElement('div');
  tooltip.className = 'de-escalator-tooltip';
  tooltip.innerHTML = `
    <div class="de-tooltip-content">
      <p class="de-tooltip-title">This might escalate the conversation.</p>
      <p class="de-tooltip-label">Suggested Rephrase:</p>
      <p class="de-tooltip-suggestion">"${suggestionText}"</p>
      <div class="de-tooltip-actions">
        <button id="de-accept" class="de-tooltip-btn de-accept">Accept</button>
        <button id="de-dismiss" class="de-tooltip-btn de-dismiss">Dismiss</button>
      </div>
    </div>
  `;
  tooltip.style.position = 'fixed';
  tooltip.style.zIndex = 99999;
  document.body.appendChild(tooltip);
  currentTooltip = tooltip;

  // Position tooltip after it's rendered and styled
  const rect = target.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  let top = rect.top - tooltipRect.height - 8;
  let left = rect.left + (rect.width - tooltipRect.width) / 2;
  if (top < 0) {
    top = rect.bottom + 8;
  }
  if (left < 0) left = 8;
  if (left + tooltipRect.width > window.innerWidth) {
    left = window.innerWidth - tooltipRect.width - 8;
  }
  tooltip.style.top = `${top}px`;
  tooltip.style.left = `${left}px`;

  // Button actions
  tooltip.querySelector('#de-accept').onclick = () => {
    if (target) {
      if (target.tagName === "TEXTAREA" || target.tagName === "INPUT") {
        target.value = suggestionText;
        target.dispatchEvent(new Event('input', { bubbles: true }));
      } else if (target.isContentEditable) {
        target.innerText = suggestionText;
        target.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }

    // Example data object
    const logData = {
      user_id: "anonymous_hash", // You can generate or store a unique ID per user
      gender: localStorage.getItem('gender') || "unknown",
      age: localStorage.getItem('age') || "unknown",
      original_text: originalText,
      rephrased_text: suggestionText,
      accepted: true,
      escalation_type: "cognitive", // or "emotional", set based on your logic
      platform: isTwitter() ? "twitter" : "other",
      context: isTwitter() ? extractTwitterContext() : ""
    };
    logToGoogleSheet(logData);

    tooltip.remove();
    currentTooltip = null;

    // Add a short delay before showing the celebration tooltip
    setTimeout(() => {
      showCelebrationTooltip(target);
    }, 100); // 100ms delay ensures the previous tooltip is gone
  };
  tooltip.querySelector('#de-dismiss').onclick = () => {
    tooltip.remove();
    currentTooltip = null;
  };
}

function showCelebrationTooltip(target) {
  // Remove any existing tooltip
  if (currentTooltip) {
    currentTooltip.remove();
    currentTooltip = null;
  }
  const tooltip = document.createElement('div');
  tooltip.className = 'de-escalator-tooltip';
  tooltip.innerHTML = `
    <div class="de-tooltip-content">
      <p class="de-tooltip-title" style="color:#1976d2;font-size:18px;">Great job! 🥳</p>
      <p style="margin:0;color:#333;">You just made the conversation more positive.</p>
    </div>
  `;
  tooltip.style.position = 'fixed';
  tooltip.style.zIndex = 99999;
  document.body.appendChild(tooltip);
  currentTooltip = tooltip;
  // Position tooltip above the target
  const rect = target.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  let top = rect.top - tooltipRect.height - 8;
  let left = rect.left + (rect.width - tooltipRect.width) / 2;
  if (top < 0) {
    top = rect.bottom + 8;
  }
  if (left < 0) left = 8;
  if (left + tooltipRect.width > window.innerWidth) {
    left = window.innerWidth - tooltipRect.width - 8;
  }
  tooltip.style.top = `${top}px`;
  tooltip.style.left = `${left}px`;
  // Auto-dismiss after 2 seconds
  setTimeout(() => {
    if (tooltip.parentNode) tooltip.remove();
    if (currentTooltip === tooltip) currentTooltip = null;
  }, 2000);
}

function logToGoogleSheet(data) {
  fetch('https://script.google.com/macros/s/AKfycbz3kufdIMV__9-Otv7DaiqZJrV5CtiUY8M7nreSX1FHN0uetloLRsi83SniULJF-hyH/exec', {
    method: 'POST',
    mode: 'no-cors', // Required for Google Apps Script web apps
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
}

// === MAIN LOGIC ===
document.addEventListener("input", (e) => {
  const target = e.target;
  if (!target) return;
  const text = target.value || target.innerText;
  if (debounceTimeout) clearTimeout(debounceTimeout);
  if (!text || text.length <= 10) return;
  // Only trigger if text ends with '*'
  if (!text.trim().endsWith('*')) return;
  debounceTimeout = setTimeout(async () => {
    // Only trigger if text changed
    if (text === lastText) return;
    lastText = text;
    // Remove trailing '*' before sending to API
    const cleanText = text.replace(/\*+$/, '').trim();
    // Call OpenAI API with all context (user, thread, news)
    const suggestion = await getRephrasedText(cleanText);
    // Only show tooltip if the AI's suggestion is different (i.e., escalation detected)
    if (
      suggestion &&
      suggestion.trim() !== cleanText.trim()
    ) {
      showCustomTooltip(target, text, suggestion);
    } else if (currentTooltip) {
      currentTooltip.remove();
      currentTooltip = null;
    }
  }, 1000);
});

console.log("\u2705 De-Escalator content.js loaded and listening.");
