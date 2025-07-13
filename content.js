// This content.js script detects input in any contenteditable or textarea
// and displays a basic tooltip warning for potentially aggressive messages.

// === CONFIGURATION ===
const triggerThreshold = 0.7; // Dummy threshold for "aggressiveness"

// === UTILITIES ===
function isAggressive(text) {
  const aggressiveKeywords = ["stupid", "idiot", "hate", "worst", "angry", "asshole"];
  return aggressiveKeywords.some((word) => text.toLowerCase().includes(word));
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

Then rephrase the message to:
Use subjective language (e.g., “I think…”, “In my experience…”),
Reflect self-accountability and acknowledge complexity,
Remove blame and avoid generalizations.

Return the full rephrased sentence that keeps the speaker’s intent but softens tone and promotes respectful, open dialogue`;

// === DEBOUNCE ===
let debounceTimeout = null;
let lastText = "";

async function getRephrasedText(userText) {
  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userText }
      ],
      max_tokens: 100
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
    tooltip.remove();
    currentTooltip = null;
  };
  tooltip.querySelector('#de-dismiss').onclick = () => {
    tooltip.remove();
    currentTooltip = null;
  };
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
    // Call OpenAI API
    const suggestion = await getRephrasedText(cleanText);
    if (suggestion && suggestion !== cleanText) {
      showCustomTooltip(target, text, suggestion);
    } else if (currentTooltip) {
      currentTooltip.remove();
      currentTooltip = null;
    }
  }, 2000);
});

console.log("\u2705 De-Escalator content.js loaded and listening.");
