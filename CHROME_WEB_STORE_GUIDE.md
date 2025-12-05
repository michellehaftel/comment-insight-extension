# Chrome Web Store Submission Guide

## 📋 Pre-Submission Checklist

### ✅ Required Files
- [x] `manifest.json` - Already configured
- [x] Extension icons (16px, 48px, 128px) - Already present
- [x] Privacy Policy - Created (`PRIVACY_POLICY.md`)
- [ ] Screenshots (required for store listing)
- [ ] Promotional images (optional but recommended)

### ⚠️ Important: API Key Security

**CRITICAL**: Before submitting, you need to handle the API key in `config.js`. Options:

1. **Option A (Recommended)**: Remove the hardcoded API key and let users add their own
2. **Option B**: Use Chrome storage sync for user configuration
3. **Option C**: Create a backend service to proxy API calls (more complex)

**Current Issue**: Your `config.js` contains a hardcoded API key. Chrome Web Store reviewers will reject this.

## 🚀 Submission Steps

### Step 1: Prepare Your Extension Package

1. **Remove/secure the API key** from `config.js`
2. **Create a clean ZIP file**:
   ```bash
   zip -r de-escalator-store-v1.1.zip manifest.json background.js content.js config.js popup.html styles.css icon*.png onboarding.html onboarding.js -x "*.git*" "*.DS_Store" "*.md" "*.zip"
   ```

### Step 2: Create Store Listing Assets

#### Required: Screenshots
- **Small promotional tile**: 440x280 pixels (required)
- **Screenshots**: At least 1, up to 5 screenshots
  - Recommended sizes: 1280x800 or 640x400
  - Show the extension in action (tooltip, rephrasing, etc.)

#### Optional but Recommended:
- **Marquee promotional image**: 920x680 pixels
- **Wide promotional tile**: 920x680 pixels (for featured placement)

### Step 3: Write Your Store Listing

#### App Name
```
De-Escalator
```

#### Short Description (132 characters max)
```
Detect and de-escalate aggressive language in social media posts. Transform conflict into constructive dialogue.
```

#### Detailed Description
```
🕊️ Promote Peaceful Online Conversations

De-Escalator helps you communicate more constructively on social media by detecting escalating language and offering calmer alternatives.

✨ KEY FEATURES:

• Real-time Detection - Identifies potentially aggressive or inflammatory language as you type
• Smart Rephrasing - Offers de-escalated alternatives using psychological models
• One-Click Replacement - Replace escalating text with a calmer version instantly
• Works Everywhere - Supports Twitter/X, Facebook, and other social media platforms
• Privacy-First - All processing happens locally in your browser

🎯 HOW IT WORKS:

The extension uses the Emotional-Cognitive Psycholinguistic Model (ECPM) to detect two main dimensions of escalation:

1. Cognitive Dimension: Absolute truths vs. Subjective statements
2. Emotional Dimension: Blame vs. Self-accountability

When escalating language is detected, it transforms aggressive statements into more constructive alternatives while preserving your meaning.

💬 EXAMPLE TRANSFORMATIONS:

• "You are always wrong!" → "I often disagree with your perspective."
• "You never listen to me!" → "I rarely see you listening to me."
• "This is ridiculous!" → "I find that challenging to understand."

🔒 PRIVACY & SECURITY:

• All text analysis happens locally in your browser
• We never store, transmit, or save your text content
• No data collection without your explicit consent
• Minimal permissions - only what's needed to function

🎓 RESEARCH-BACKED:

Based on research in political discourse de-escalation and psycholinguistics, designed to help reduce online conflicts and promote healthier discourse.

Note: This extension is designed to help users communicate more constructively. It does not censor or prevent you from posting - it simply offers alternatives when escalating language is detected.
```

#### Category
```
Social & Communication
```

#### Language
```
English (US)
```

### Step 4: Privacy & Single Purpose

#### Privacy Practices
- Check "Handles user data"
- Select: "This item uses a service in the background"
- Privacy Policy URL: [Your hosted privacy policy URL]

#### Single Purpose Declaration
```
This extension has a single purpose: to detect escalating language in social media text fields and offer constructive alternatives to help users communicate more peacefully. It does not collect personal information or track browsing behavior beyond its core functionality.
```

### Step 5: Submit to Chrome Web Store

1. **Go to Chrome Web Store Developer Dashboard**
   - Visit: https://chrome.google.com/webstore/devconsole
   - Sign in with your Google Developer account

2. **Create New Item**
   - Click "New Item"
   - Upload your ZIP file (`de-escalator-store-v1.1.zip`)

3. **Fill in Store Listing**
   - Use the content from Step 3 above
   - Upload screenshots
   - Add privacy policy URL

4. **Distribution**
   - Choose: "Public" or "Unlisted" (for testing first)
   - Select countries/regions

5. **Submit for Review**
   - Review all information
   - Click "Submit for Review"

## ⏱️ Review Timeline

- **Initial Review**: 1-3 business days
- **Re-review** (if changes needed): 1-2 business days
- First-time publishers may take slightly longer

## 🐛 Common Rejection Reasons

1. **Hardcoded API keys** - Must be removed or user-configurable
2. **Missing Privacy Policy** - Required if handling any user data
3. **Insufficient description** - Need clear explanation of functionality
4. **Permissions justification** - `<all_urls>` needs clear explanation
5. **Missing screenshots** - At least one required

## 📝 After Approval

1. **Monitor reviews** - Respond to user feedback
2. **Update regularly** - Fix bugs, add features
3. **Maintain privacy policy** - Keep it updated

## 🔗 Helpful Links

- [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
- [Chrome Web Store Policies](https://developer.chrome.com/docs/webstore/program-policies/)
- [Extension Best Practices](https://developer.chrome.com/docs/extensions/mv3/security/)

---

**Next Steps**: 
1. Fix the API key issue in `config.js`
2. Create screenshots
3. Host privacy policy online
4. Submit to Chrome Web Store

