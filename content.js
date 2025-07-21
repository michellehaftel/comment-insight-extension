// This content.js script detects input in any contenteditable or textarea
// and displays a basic tooltip warning for potentially aggressive messages.

// === CONFIGURATION ===
const triggerThreshold = 0.7; // Dummy threshold for "aggressiveness"

// === UTILITIES ===
function isAggressive(text) {
  const aggressiveKeywords = ["stupid", "idiot", "hate", "worst", "angry", "asshole"];
  return aggressiveKeywords.some((word) => text.toLowerCase().includes(word));
}

// === HELPER FUNCTIONS ===
function isTwitter() {
  return window.location.hostname.includes('twitter.com') || window.location.hostname.includes('x.com');
}

function isFacebook() {
  return window.location.hostname.includes('facebook.com');
}

function extractTwitterContext() {
  if (!isTwitter()) return null;
  let context = '';
  // Try to find the original tweet
  const tweet = document.querySelector('[data-testid="tweetText"]');
  if (tweet) {
    context += `Original tweet: ${tweet.textContent}\n\n`;
  }
  // Try to find previous replies
  const replyElements = document.querySelectorAll('[data-testid="tweetText"]');
  if (replyElements.length > 1) {
    context += 'Previous replies:\n';
    for (let i = 1; i < Math.min(replyElements.length, 4); i++) {
      context += `- ${replyElements[i].textContent}\n`;
    }
    context += '\n';
  }
  return context || null;
}

function extractFacebookContext() {
  if (!isFacebook()) return null;
  let context = '';
  // Try to find the original post
  const post = document.querySelector('[role="article"] [data-ad-preview="message"]');
  if (post) {
    context += `Original post: ${post.textContent}\n\n`;
  }
  // Try to find previous comments
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

async function fetchRecentNews(query) {
  // Use the user's query or a default if not provided
  const searchQuery = query || "פוליטיקה ישראלית OR בית המשפט העליון OR נתניהו OR עזה OR בני גנץ OR יאיר לפיד OR רפורמה משפטית";
  const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(searchQuery)}&lang=he&token=7651cce81dbaeb4058d24803c766951f&max=3`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.articles && data.articles.length > 0) {
      return data.articles.map(a => `${a.title} (${a.source.name})`).join('\n');
    }
    return '';
  } catch (e) {
    return '';
  }
}

function getOriginalTweetForReply(target) {
  // Traverse upwards from the reply box to find the nearest tweet text above
  let current = target;
  while (current && current !== document.body) {
    // Look for a tweet text above
    const tweetText = current.querySelector
      ? current.querySelector('[data-testid="tweetText"]')
      : null;
    if (tweetText && tweetText.textContent && tweetText.textContent.trim().length > 0) {
      return tweetText.textContent.trim();
    }
    current = current.parentElement;
  }
  // Fallback: get the first tweetText on the page
  const fallback = document.querySelector('[data-testid="tweetText"]');
  return fallback ? fallback.textContent.trim() : null;
}

function getTwitterContextForInput(target) {
  // If this is a new tweet (not a reply box), only external news
  const isReply = !!target.closest('[role="dialog"]');
  if (!isReply) {
    return { type: 'new', originalTweet: null, repliedComment: null };
  }
  // For a reply, get the tweet being replied to
  const originalTweet = getOriginalTweetForReply(target);
  return { type: 'replyToTweet', originalTweet, repliedComment: null };
}

async function buildApiPayload(userText, target) {
  let messages = [{ role: "system", content: SYSTEM_PROMPT }];

  let newsContext = '';
  if (isTwitter()) {
    const contextInfo = getTwitterContextForInput(target);
    if (contextInfo.type === 'replyToTweet' && contextInfo.originalTweet) {
      newsContext = await fetchRecentNews(contextInfo.originalTweet);
    } else {
      newsContext = await fetchRecentNews();
    }
  } else {
    newsContext = await fetchRecentNews();
  }
  if (newsContext) {
    messages.push({ role: "system", content: "Recent news context: " + newsContext });
  }

  if (isTwitter()) {
    const contextInfo = getTwitterContextForInput(target);
    if (contextInfo.type === 'new') {
      messages.push({ role: "user", content: userText });
    } else if (contextInfo.type === 'replyToTweet') {
      messages.push({
        role: "user",
        content: `Original tweet: ${contextInfo.originalTweet}\nUser comment: ${userText}`
      });
    } else if (contextInfo.type === 'replyToComment') {
      messages.push({
        role: "user",
        content: `Original tweet: ${contextInfo.originalTweet}\nReplied comment: ${contextInfo.repliedComment}\nUser comment: ${userText}`
      });
    } else {
      messages.push({ role: "user", content: userText });
    }
  } else if (isFacebook()) {
    const context = extractFacebookContext();
    if (context) {
      messages.push({ role: "user", content: `Thread context:\n${context}\nUser comment: ${userText}` });
    } else {
      messages.push({ role: "user", content: userText });
    }
  } else {
    messages.push({ role: "user", content: userText });
  }

  return {
    model: "gpt-3.5-turbo",
    messages: messages,
    max_tokens: 150
  };
}

async function getRephrasedText(userText, target) {
  const payload = await buildApiPayload(userText, target);

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify(payload)
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
        target.focus();
        // Move cursor to end
        target.setSelectionRange(target.value.length, target.value.length);
      } else if (target.isContentEditable) {
        target.innerText = suggestionText;
        target.dispatchEvent(new Event('input', { bubbles: true }));
        // Focus and move cursor to end
        const range = document.createRange();
        range.selectNodeContents(target);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        target.focus();
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
  tooltip.className = 'de-escalator-tooltip celebration-tooltip'; // Use base class + new class
  tooltip.style.background = '#fff'; // Explicitly set background to white to override cache
  tooltip.innerHTML = `
    <div class="de-tooltip-content">
      <p class="de-tooltip-title celebration-title">Great job! 🥳</p>
      <p class="celebration-body">You just made the conversation more positive.</p>
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

  const trimmedText = text.trim();

  // --- DEBUG MODE ---
  if (trimmedText.endsWith('#')) {
    debounceTimeout = setTimeout(async () => {
      if (text === lastText) return;
      lastText = text;
      const cleanText = trimmedText.replace(/#+$/, '').trim();

      console.log('[De-Escalator] --- DEBUG MODE: Building API Request ---');
      const apiRequestPayload = await buildApiPayload(cleanText, target);

      console.log('--- OpenAI API Request Payload (not sent) ---');
      console.log(JSON.stringify(apiRequestPayload, null, 2));
      console.log('---------------------------------------------');

    }, 1000);
    return;
  }

  // --- NORMAL MODE ---
  if (trimmedText.endsWith('*')) {
    debounceTimeout = setTimeout(async () => {
      if (text === lastText) return;
      lastText = text;
      const cleanText = trimmedText.replace(/\*+$/, '').trim();
      const suggestion = await getRephrasedText(cleanText, target);
      if (suggestion && suggestion.trim() !== cleanText.trim()) {
        showCustomTooltip(target, text, suggestion);
      } else if (currentTooltip) {
        currentTooltip.remove();
        currentTooltip = null;
      }
    }, 1000);
  }
});

console.log("\u2705 De-Escalator content.js loaded and listening.");
