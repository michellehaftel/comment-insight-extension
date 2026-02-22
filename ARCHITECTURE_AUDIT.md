# Discourse Lab – Architecture & Robustness Audit

This document summarizes the extension architecture and recent robustness improvements for research deployment.

## 1. Angel & Devil Bots (50/50)

- **Implementation**: `getBotAssignment()` in `content.js` assigns users to Angel or Devil based on hashed `userId` (consistent per user)
- **Storage**: `chrome.storage.local` holds `botType` and `userId`; fallback to `'angel'` if storage is unavailable
- **Both bots** use the same escalation detection (`isEscalating()`); only the suggested rephrase differs (de‑escalation vs. escalation)

## 2. Escalation Detection

- **Research base**: ECPM (Emotional–Cognitive Psycholinguistic Model) with cognitive and emotional dimensions
- **Pattern groups**: Absolute truths, generalized/categorical claims, blame, mocking, dismissive, judging, profanity, insults, polarizing us/them, they-blame
- **Cursing & insults**: Treated as strong signals; any match triggers escalation
- **Tone signals**: Exclamation marks, CAPS, emojis (anger/frustration), cynical phrases (“as if”, “yeah right”)

## 3. Threshold

- **Threshold**: 2.0 (reduced from 2.5) – bias toward showing the tooltip when uncertain
- **Cursing/insults**: Always trigger escalation, regardless of other scores

## 4. Context Awareness

- **Original post**: Content and author extracted from the DOM for replies
- **Platform**: Detected (Twitter/X, Facebook, etc.)
- **API context**: Original post content, author, reply status, and page URL sent to the rephrasing API
- **Context usage**: API prompt instructs the model to consider context for political/topical relevance and rephrasing

## 5. Loading & Performance

- **Debounce**: 300 ms on input/keyup before re-checking
- **API calls**: Retry logic (exponential backoff) for rate limits and transient 500s
- **Detection**: Pure pattern matching; no API call until escalation is detected

## 6. UI & CTAs

- **Offer text**: “Let me offer you a rephrase”
- **Buttons**: “Dismiss” and “Rephrase”
- **Rephrase action**: Replaces text in the field and keeps it editable

## 7. Post-Rephrase Behavior

- **Editable**: `contentEditable` and `readonly`/`disabled` are restored after rephrasing
- **Re-check**: After 2 seconds, `checkForEscalation` runs again on the current text
- **Listeners**: Attached to the current composer; fallbacks if the DOM has changed

## 8. Google Sheets Logging

- **When**: Logged on Dismiss (immediately) and on Post (Rephrase-accepted case)
- **Dismiss**: Logged right away; no wait for post
- **Rephrase**: Stored when accepted; logged with `actual_posted_text` when user posts
- **Backup**: Data stored locally if the Sheets request fails
- **Mode**: `cors` for better debugging and error reporting

## 9. Composer & Post Detection

- **Composer selectors**: Twitter `tweetTextarea` plus fallbacks for `contenteditable`/`role="textbox"`
- **Post button selectors**: Multiple patterns to handle Twitter/X DOM changes
- **Platform**: Currently focused on Twitter/X; design allows extension to other platforms

## Deployment Checklist

- [ ] Reload extension after changes (`chrome://extensions` → ↻)
- [ ] Refresh target tabs after reload
- [ ] Configure `GOOGLE_SHEETS_URL` in `config.js`
- [ ] Complete onboarding (user ID, etc.) so Sheets logging includes user metadata
- [ ] Deploy Google Apps Script from `GOOGLE_APPS_SCRIPT_CODE.js` and use its Web App URL in config
