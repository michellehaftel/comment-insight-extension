# How to Create a GitHub Release 📦

## Step-by-Step Instructions

### 1. Prepare Your Files
✅ Make sure you've committed all changes:
```bash
git add .
git commit -m "Prepare v1.1 for release - removed hardcoded API key"
git push
```

### 2. Create the Release on GitHub

1. **Go to your repository on GitHub:**
   ```
   https://github.com/michellehaftel/comment-insight-extension
   ```

2. **Click on "Releases"** (on the right sidebar, or go to: `https://github.com/michellehaftel/comment-insight-extension/releases`)

3. **Click "Create a new release"** (or "Draft a new release")

4. **Fill in the release form:**
   - **Tag version**: `v1.1` (this creates a git tag)
   - **Release title**: `De-Escalator v1.1`
   - **Description**: 
     ```
     🎉 First public release!
     
     ✨ Features:
     - Real-time escalation detection
     - AI-powered rephrasing (requires your own OpenAI API key)
     - Local pattern-based fallback
     - Works on Twitter/X, Facebook, and more
     
     📝 Installation:
     1. Download the ZIP file below
     2. Extract it
     3. Go to chrome://extensions/
     4. Enable Developer Mode
     5. Click "Load unpacked" and select the extracted folder
     ```

5. **Attach the ZIP file:**
   - Drag and drop `de-escalator-store-v1.1.zip` into the "Attach binaries" section
   - OR click "selecting them" and browse for the file

6. **Click "Publish release"**

### 3. Get Your Download Link

After publishing, your download link will be:
```
https://github.com/michellehaftel/comment-insight-extension/releases/download/v1.1/de-escalator-store-v1.1.zip
```

✅ The `install.html` page is already configured to use this link!

### 4. (Optional) Host install.html on GitHub Pages

If you want `install.html` to be accessible online:

1. Go to your repo → Settings → Pages
2. Source: Deploy from a branch → main branch → / (root)
3. Save
4. Your install page will be at:
   ```
   https://michellehaftel.github.io/comment-insight-extension/install.html
   ```

### 5. Share the Link

Users can now:
- Download directly: `https://github.com/.../releases/download/v1.1/de-escalator-store-v1.1.zip`
- Or visit your install page (if hosted on GitHub Pages)

---

## Tips

- ✅ **Always create releases for new versions** (v1.1, v1.2, etc.)
- ✅ **Tag names should match version numbers** in `manifest.json`
- ✅ **Include release notes** explaining what's new
- ✅ **Test the download link** after publishing

---

## Future Releases

When you update to v1.2, v2.0, etc.:
1. Update version in `manifest.json`
2. Create new ZIP file
3. Create new release with tag `v2.0`
4. Upload new ZIP
5. Update `install.html` link if needed

