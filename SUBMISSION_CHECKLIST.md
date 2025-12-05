# Chrome Web Store Submission Checklist ✅

## 🔒 Security Fixes (CRITICAL - MUST DO BEFORE SUBMISSION)

- [x] ✅ Removed hardcoded API key from `config.js`
- [x] ✅ API key now loaded from Chrome storage (user-configurable)
- [x] ✅ Added popup UI for users to enter their own API key
- [x] ✅ Extension works without API key (falls back to local detection)

## 📦 Files to Package

Create a clean ZIP with ONLY these files:
```
de-escalator-store-v1.1.zip should contain:
├── manifest.json
├── background.js
├── content.js
├── config.js
├── popup.html
├── popup.js (NEW - for API key settings)
├── styles.css
├── onboarding.html
├── onboarding.js
├── icon16.png
├── icon48.png
└── icon128.png
```

**Exclude**: `*.md`, `*.zip`, `.git*`, `node_modules`, etc.

## 🖼️ Store Assets Needed

### Required:
- [ ] **Small promotional tile**: 440x280 pixels
- [ ] **At least 1 screenshot**: 1280x800 or 640x400 pixels

### Recommended:
- [ ] **Marquee promotional tile**: 920x680 pixels
- [ ] **Screenshot 2**: Show tooltip in action
- [ ] **Screenshot 3**: Show rephrasing example

### Tips for Screenshots:
1. Show the tooltip appearing on Twitter/X
2. Show before/after text transformation
3. Show the popup settings (optional)
4. Make it clear what the extension does

## 📝 Store Listing Information

All content is prepared in `CHROME_WEB_STORE_GUIDE.md`:
- [x] App name: "De-Escalator"
- [x] Short description (132 chars max)
- [x] Detailed description with features
- [x] Category: Social & Communication
- [x] Privacy Policy created

## 🔗 Privacy Policy

- [x] Privacy policy created: `PRIVACY_POLICY.md`
- [ ] **ACTION NEEDED**: Host `PRIVACY_POLICY.md` online (GitHub Pages, your website, etc.)
- [ ] Get the public URL to paste in store submission form

**Hosting Options:**
- GitHub: Create a repository and enable GitHub Pages
- Google Sites: Free hosting
- Your own website
- Or include as part of extension (less ideal)

## 🚀 Submission Steps

### 1. Prepare ZIP File
```bash
cd /Users/michalhaftel/git_thesis/comment-insight-extension
zip -r de-escalator-store-v1.1.zip manifest.json background.js content.js config.js popup.html popup.js styles.css onboarding.html onboarding.js icon*.png -x "*.git*" "*.DS_Store" "*.md" "*.zip"
```

### 2. Go to Chrome Web Store Developer Dashboard
- Visit: https://chrome.google.com/webstore/devconsole
- Sign in with your Google Developer account

### 3. Click "New Item"
- Upload `de-escalator-store-v1.1.zip`

### 4. Fill Store Listing (see `CHROME_WEB_STORE_GUIDE.md`)
- Copy content from the guide
- Upload screenshots
- Add privacy policy URL

### 5. Distribution
- Choose "Unlisted" first (for testing)
- Or "Public" if ready

### 6. Submit for Review
- Review all information
- Click "Submit for Review"

## ⚠️ Important Notes

1. **API Key**: Extension now requires users to add their own API key via popup
2. **Fallback**: Works without API key (uses local pattern matching)
3. **Permissions**: `<all_urls>` is needed to work across social media platforms
4. **Privacy**: Explain that API calls only happen if user configures an API key

## 📋 Single Purpose Declaration

```
This extension has a single purpose: to detect escalating language in social media text fields and offer constructive alternatives to help users communicate more peacefully. It does not collect personal information or track browsing behavior beyond its core functionality. Optional API integration requires users to provide their own API keys and is used solely for text rephrasing suggestions.
```

## 🎯 Next Steps

1. ✅ Security fixes done (API key removed)
2. ⏳ Create/store screenshots
3. ⏳ Host privacy policy online
4. ⏳ Create ZIP file
5. ⏳ Submit to Chrome Web Store
6. ⏳ Wait for review (1-3 business days)

---

**Ready to submit once you:**
- Create screenshots
- Host privacy policy
- Package the ZIP file

Good luck! 🚀

