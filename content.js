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

// === REPHRASE LOGIC ===
const rephraseMap = {
  "stupid": "unwise",
  "idiot": "person",
  "hate": "dislike",
  "worst": "not ideal",
  "angry": "upset",
  "asshole": "person"
};
function rephraseText(text) {
  return text.replace(/stupid|idiot|hate|worst|angry|asshole/gi, (match) => {
    return rephraseMap[match.toLowerCase()] || match;
  });
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
  console.log('[De-Escalator] Input event detected:', target);
  if (!target) return;
  const text = target.value || target.innerText;
  console.log('[De-Escalator] Input text:', text);
  if (text && text.length > 10 && isAggressive(text)) {
    const suggestion = rephraseText(text);
    console.log('[De-Escalator] Escalation detected! Showing tooltip.', { original: text, suggestion });
    showCustomTooltip(target, text, suggestion);
  } else if (currentTooltip) {
    currentTooltip.remove();
    currentTooltip = null;
  }
});

console.log("\u2705 De-Escalator content.js loaded and listening.");
