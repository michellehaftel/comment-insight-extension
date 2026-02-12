# Distribution Checklist

## Files Required for Distribution

The extension is ready to distribute! Here are the required files:

### ✅ Core Files
- `manifest.json` - Extension configuration
- `content.js` - Main logic (escalation detection & rephrasing)
- `config.js` - Configuration placeholder
- `styles.css` - Tooltip styling
- `popup.html` - Extension popup UI

### ✅ Assets
- `icon16.png` - 16x16 icon
- `icon48.png` - 48x48 icon  
- `icon128.png` - 128x128 icon

### ✅ Documentation
- `README.md` - User-facing documentation
- `DISTRIBUTION.md` - This file

## Creating a Distributable ZIP

### Option 1: Manual ZIP Creation

1. Select these files in the extension directory:
   - manifest.json
   - content.js
   - config.js
   - styles.css
   - popup.html
   - icon16.png
   - icon48.png
   - icon128.png
   - README.md

2. Create a ZIP archive named `discourse-lab-extension-v1.0.zip`

3. Users can extract and load via Chrome's "Load unpacked" feature

### Option 2: Command Line (macOS/Linux)

```bash
cd /Users/ido/git_michal/comment-insight-extension
zip -r discourse-lab-extension-v1.0.zip \
  manifest.json \
  content.js \
  config.js \
  styles.css \
  popup.html \
  icon16.png \
  icon48.png \
  icon128.png \
  README.md
```

## Testing the Distribution

1. Create the ZIP file
2. Extract it to a new folder
3. Load the extension in Chrome:
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the extracted folder
4. Test on Twitter/X or Facebook
5. Verify:
   - Escalation detection works
   - Tooltip appears
   - Rephrase button works
   - Text is replaced successfully

## Publishing to Chrome Web Store (Future)

To publish to the Chrome Web Store, you'll need:

1. **Chrome Web Store Developer Account** ($5 one-time fee)
2. **Updated manifest.json** with proper permissions
3. **Privacy Policy** (required if collecting data)
4. **Screenshots** (1280x800 or 640x400)
5. **Promotional Images**:
   - Small promo tile: 440x280
   - Large promo tile: 920x680 (optional)
   - Marquee promo tile: 1400x560 (optional)

### Steps:
1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Click "New Item"
3. Upload the ZIP file
4. Fill in store listing details
5. Submit for review

Review typically takes 1-3 business days.

## Version Control

When updating the extension:
1. Update version number in `manifest.json`
2. Update changelog in `README.md`
3. Create new ZIP with updated version number
4. Tag the git commit with version number

---

**Current Version**: 1.0
**Last Updated**: 2025-11-13

